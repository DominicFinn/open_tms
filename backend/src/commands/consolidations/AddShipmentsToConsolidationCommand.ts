import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';
import { attachShipments, loadDraftConsolidation, rebuildConsolidationStops } from './consolidationMembership.js';

export interface AddShipmentsToConsolidationPayload {
  id: string;
  shipmentIds: string[];
}

export const ADD_SHIPMENTS_TO_CONSOLIDATION = 'consolidation.add_shipments';

export class AddShipmentsToConsolidationCommandHandler extends BaseCommandHandler<AddShipmentsToConsolidationPayload, { stopCount: number }> {
  readonly commandType = ADD_SHIPMENTS_TO_CONSOLIDATION;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<AddShipmentsToConsolidationPayload>,
    tx: TransactionClient,
    emit: EmitFn,
  ): Promise<{ stopCount: number }> {
    const { orgId } = command;
    const { id, shipmentIds } = command.payload;

    await loadDraftConsolidation(tx, orgId, id);
    await attachShipments(tx, orgId, id, shipmentIds);
    const stopCount = await rebuildConsolidationStops(tx, orgId, id);

    for (const shipmentId of new Set(shipmentIds)) {
      emit(this.createEvent(command, {
        type: EVENT_TYPES.CONSOLIDATION_SHIPMENT_ADDED,
        entityType: 'consolidation',
        entityId: id,
        payload: { shipmentId, stopCount },
      }));
    }
    return { stopCount };
  }
}
