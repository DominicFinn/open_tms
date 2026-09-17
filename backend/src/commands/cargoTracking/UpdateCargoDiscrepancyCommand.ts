import { PrismaClient, CargoDiscrepancy } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';
import { CargoScopeError } from './cargoReconciliation.js';

export interface UpdateCargoDiscrepancyPayload {
  id: string;
  status?: 'open' | 'investigating' | 'resolved' | 'dismissed';
  resolvedBy?: string;
  resolution?: string;
  notes?: string;
  severity?: 'critical' | 'high' | 'medium' | 'low';
}

export const UPDATE_CARGO_DISCREPANCY = 'cargo.update_discrepancy';

export class UpdateCargoDiscrepancyCommandHandler extends BaseCommandHandler<UpdateCargoDiscrepancyPayload, CargoDiscrepancy> {
  readonly commandType = UPDATE_CARGO_DISCREPANCY;
  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) { super(prisma, eventBus); }

  protected async handle(command: Command<UpdateCargoDiscrepancyPayload>, tx: TransactionClient, emit: EmitFn) {
    const { id, ...changes } = command.payload;
    const existing = await tx.cargoDiscrepancy.findFirst({ where: { id, orgId: command.orgId } });
    if (!existing) throw new CargoScopeError('Discrepancy not found');

    // Resolving an already-resolved discrepancy is a plain edit, not a second resolution.
    const resolving = changes.status === 'resolved' && existing.status !== 'resolved';

    const updated = await tx.cargoDiscrepancy.update({
      where: { id },
      data: {
        ...changes,
        ...(resolving ? { resolvedAt: new Date(), resolvedBy: changes.resolvedBy ?? command.actorId } : {}),
      },
      include: {
        trackableUnit: { include: { order: true } },
        expectedStop: { include: { location: true } },
        actualStop: { include: { location: true } },
      },
    });

    if (resolving) {
      emit(this.createEvent(command, {
        type: EVENT_TYPES.CARGO_DISCREPANCY_RESOLVED,
        entityType: 'cargo_discrepancy',
        entityId: id,
        payload: {
          shipmentId: updated.shipmentId,
          trackableUnitId: updated.trackableUnitId,
          unitIdentifier: updated.trackableUnit.identifier,
          unitType: updated.trackableUnit.unitType,
          discrepancyType: updated.discrepancyType,
          resolution: changes.resolution,
        },
      }));
    }

    return updated;
  }
}
