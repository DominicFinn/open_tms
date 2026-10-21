import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';
import { setHandlingUnitState } from './handlingUnitState.js';

export interface MoveHandlingUnitPayload {
  handlingUnitId: string;
  binId: string;
  qualityStatus?: string;
  /** Why it moved, e.g. "rma". Carried on the event. */
  reason: string;
  referenceId?: string | null;
}

export const MOVE_HANDLING_UNIT = 'handling_unit.move';

const QUALITY_STATUSES = new Set(['available', 'hold', 'quarantine', 'damaged']);

/**
 * Moves a handling unit to a bin, and optionally sets its quality, outside the putaway flow (#357).
 * Returns use it, by event, now that a unit's bin and quality live on the warehouse side.
 *
 * Concurrency: last write wins on the unit's location, as with putaway and staging. The bin is
 * read inside the transaction, so a bin from another org or a deleted one is refused.
 */
export class MoveHandlingUnitCommandHandler extends BaseCommandHandler<MoveHandlingUnitPayload, { handlingUnitId: string }> {
  readonly commandType = MOVE_HANDLING_UNIT;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<MoveHandlingUnitPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ handlingUnitId: string }> {
    const p = command.payload;
    if (p.qualityStatus !== undefined && !QUALITY_STATUSES.has(p.qualityStatus)) {
      throw new Error(`Unknown quality status ${p.qualityStatus}`);
    }

    const bin = await tx.warehouseBin.findFirst({ where: { id: p.binId, orgId: command.orgId }, select: { id: true, zoneId: true } });
    if (!bin) throw new Error(`Bin ${p.binId} not found`);

    const moved = await setHandlingUnitState(tx, command.orgId, p.handlingUnitId, {
      currentBinId: bin.id,
      currentZoneId: bin.zoneId,
      ...(p.qualityStatus !== undefined ? { qualityStatus: p.qualityStatus } : {}),
    });
    if (moved === 0) throw new Error(`Handling unit ${p.handlingUnitId} not found`);

    emit(this.createEvent(command, {
      type: EVENT_TYPES.HANDLING_UNIT_MOVED,
      entityType: 'handling_unit',
      entityId: p.handlingUnitId,
      payload: {
        binId: bin.id,
        zoneId: bin.zoneId,
        qualityStatus: p.qualityStatus ?? null,
        reason: p.reason,
        referenceId: p.referenceId ?? null,
      },
    }));

    return { handlingUnitId: p.handlingUnitId };
  }
}
