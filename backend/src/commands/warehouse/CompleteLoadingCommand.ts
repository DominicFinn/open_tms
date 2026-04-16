import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface CompleteLoadingPayload {
  /** Staging assignment IDs to mark as loaded */
  assignmentIds: string[];
  shipmentId?: string | null;
}

export const COMPLETE_LOADING = 'loading.complete';

export class CompleteLoadingCommandHandler extends BaseCommandHandler<
  CompleteLoadingPayload,
  { loadedCount: number; shipmentId: string | null }
> {
  readonly commandType = COMPLETE_LOADING;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<CompleteLoadingPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ loadedCount: number; shipmentId: string | null }> {
    const p = command.payload;

    if (p.assignmentIds.length === 0) throw new Error('No assignments to load');

    const assignments = await tx.stagingAssignment.findMany({
      where: { id: { in: p.assignmentIds } },
    });

    if (assignments.length !== p.assignmentIds.length) {
      throw new Error(`Some assignments not found (expected ${p.assignmentIds.length}, found ${assignments.length})`);
    }

    const notStaged = assignments.filter(a => a.status !== 'staged' && a.status !== 'loading');
    if (notStaged.length > 0) {
      throw new Error(`${notStaged.length} assignment(s) are not in staged/loading status`);
    }

    // Mark all as loaded
    await tx.stagingAssignment.updateMany({
      where: { id: { in: p.assignmentIds } },
      data: {
        status: 'loaded',
        shipmentId: p.shipmentId ?? undefined,
      },
    });

    // Clear the units from their staging bins (they're now on the vehicle)
    const unitIds = assignments.map(a => a.trackableUnitId);
    await tx.trackableUnit.updateMany({
      where: { id: { in: unitIds } },
      data: { currentBinId: null, currentZoneId: null },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.LOADING_COMPLETED,
      entityType: 'staging_assignment',
      entityId: p.assignmentIds[0],
      payload: {
        assignmentIds: p.assignmentIds,
        loadedCount: assignments.length,
        shipmentId: p.shipmentId,
        orderIds: [...new Set(assignments.map(a => a.orderId))],
      },
    }));

    return { loadedCount: assignments.length, shipmentId: p.shipmentId ?? null };
  }
}
