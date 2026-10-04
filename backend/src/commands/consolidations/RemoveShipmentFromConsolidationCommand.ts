import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';
import { loadDraftConsolidation, rebuildConsolidationStops, releaseShipment, shipmentUpdatedEvents } from './consolidationMembership.js';

export interface RemoveShipmentFromConsolidationPayload {
  id: string;
  shipmentId: string;
}

export const REMOVE_SHIPMENT_FROM_CONSOLIDATION = 'consolidation.remove_shipment';

export class RemoveShipmentFromConsolidationCommandHandler extends BaseCommandHandler<RemoveShipmentFromConsolidationPayload, { stopCount: number }> {
  readonly commandType = REMOVE_SHIPMENT_FROM_CONSOLIDATION;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<RemoveShipmentFromConsolidationPayload>,
    tx: TransactionClient,
    emit: EmitFn,
  ): Promise<{ stopCount: number }> {
    const { orgId } = command;
    const { id, shipmentId } = command.payload;

    await loadDraftConsolidation(tx, orgId, id);
    await releaseShipment(tx, orgId, id, shipmentId);
    const { stopCount, changedShipmentIds } = await rebuildConsolidationStops(tx, orgId, id);

    emit(this.createEvent(command, {
      type: EVENT_TYPES.CONSOLIDATION_SHIPMENT_REMOVED,
      entityType: 'consolidation',
      entityId: id,
      payload: { shipmentId, stopCount },
    }));
    for (const e of shipmentUpdatedEvents(changedShipmentIds, ['consolidation'], id)) {
      emit(this.createEvent(command, e));
    }
    return { stopCount };
  }
}
