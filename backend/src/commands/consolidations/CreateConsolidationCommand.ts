import { randomBytes } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';
import { allocateConsolidationCost, allocationEvents } from './allocateConsolidationCost.js';
import { attachShipments, pushCarrierToShipments, rebuildConsolidationStops, shipmentUpdatedEvents } from './consolidationMembership.js';

export interface CreateConsolidationPayload {
  shipmentIds: string[];
  carrierId?: string | null;
  notes?: string | null;
  carrierRateCents?: number | null;
  currency?: string;
}

export const CREATE_CONSOLIDATION = 'consolidation.create';

function newReference(now: Date): string {
  const day = now.toISOString().slice(2, 10).replace(/-/g, '');
  return `CON-${day}-${randomBytes(3).toString('hex').toUpperCase()}`;
}

export class CreateConsolidationCommandHandler extends BaseCommandHandler<CreateConsolidationPayload, { id: string; reference: string }> {
  readonly commandType = CREATE_CONSOLIDATION;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<CreateConsolidationPayload>,
    tx: TransactionClient,
    emit: EmitFn,
  ): Promise<{ id: string; reference: string }> {
    const { orgId } = command;
    const { shipmentIds, carrierId, notes, carrierRateCents, currency } = command.payload;

    if (carrierId) {
      const carrier = await tx.carrier.findFirst({ where: { id: carrierId, orgId }, select: { id: true } });
      if (!carrier) throw new Error('Carrier not found');
    }

    const consolidation = await tx.consolidation.create({
      data: { orgId, reference: newReference(new Date()), carrierId: carrierId ?? null, notes: notes ?? null, carrierRateCents: carrierRateCents ?? null, currency: currency ?? 'USD' },
    });
    await attachShipments(tx, orgId, consolidation.id, shipmentIds);
    const carried = await pushCarrierToShipments(tx, orgId, carrierId, shipmentIds);
    const { stopCount, changedShipmentIds } = await rebuildConsolidationStops(tx, orgId, consolidation.id);
    const allocation = carrierRateCents != null ? await allocateConsolidationCost(tx, orgId, consolidation.id) : null;

    emit(this.createEvent(command, {
      type: EVENT_TYPES.CONSOLIDATION_CREATED,
      entityType: 'consolidation',
      entityId: consolidation.id,
      payload: { reference: consolidation.reference, shipmentIds, stopCount },
    }));
    for (const e of shipmentUpdatedEvents([...carried, ...changedShipmentIds], ['consolidation'], consolidation.id)) {
      emit(this.createEvent(command, e));
    }
    if (allocation) for (const e of allocationEvents(consolidation.id, allocation)) emit(this.createEvent(command, e));

    return { id: consolidation.id, reference: consolidation.reference };
  }
}
