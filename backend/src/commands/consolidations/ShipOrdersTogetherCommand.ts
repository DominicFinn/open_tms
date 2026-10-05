import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';
import { combineOrdersIntoNewShipment } from '../orders/combineOrdersIntoNewShipment.js';
import { attachShipments, ConsolidationRuleError, rebuildConsolidationStops, shipmentUpdatedEvents } from './consolidationMembership.js';
import { newReference } from './CreateConsolidationCommand.js';

export interface ShipOrdersTogetherPayload {
  orderIds: string[];
}

export interface ShipOrdersTogetherResult {
  consolidationId: string;
  reference: string;
  shipmentIds: string[];
}

export const SHIP_ORDERS_TOGETHER = 'consolidation.ship_orders_together';

const UNSHIPPABLE = new Set(['assigned', 'cancelled', 'delivered']);

interface OrderFacts {
  orderNumber: string;
  customerId: string;
  status: string;
  serviceLevel: string;
  originId: string | null;
  destinationId: string | null;
}

/**
 * Why these orders can't go out on one truck as a consolidation, or null when they can.
 *
 * BUSINESS RULE: one truck can carry several customers' LTL freight, but each customer's freight
 * is its own shipment (#325), so this is only for orders spanning customers; one customer's
 * orders make one shipment instead. FTL fills the truck, so it never shares one.
 */
export function shipTogetherRefusal(orders: OrderFacts[]): string | null {
  const blocked = orders.filter((o) => UNSHIPPABLE.has(o.status)).map((o) => o.orderNumber);
  if (blocked.length > 0) return `Only available orders can be shipped: ${blocked.join(', ')}.`;
  const ftl = orders.filter((o) => o.serviceLevel === 'FTL').map((o) => o.orderNumber);
  if (ftl.length > 0) return `FTL orders ship on their own shipment: ${ftl.join(', ')}.`;
  const unrouted = orders.filter((o) => !o.originId || !o.destinationId).map((o) => o.orderNumber);
  if (unrouted.length > 0) return `Orders need a pickup and a drop: ${unrouted.join(', ')}.`;
  if (new Set(orders.map((o) => o.customerId)).size < 2) return 'These orders are all for one customer, so they make one shipment, not a consolidation.';
  return null;
}

/**
 * Ships several customers' orders on one truck: one draft shipment per customer, all on a new
 * draft consolidation, in a single transaction so a refusal leaves nothing half-built.
 */
export class ShipOrdersTogetherCommandHandler extends BaseCommandHandler<ShipOrdersTogetherPayload, ShipOrdersTogetherResult> {
  readonly commandType = SHIP_ORDERS_TOGETHER;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(command: Command<ShipOrdersTogetherPayload>, tx: TransactionClient, emit: EmitFn): Promise<ShipOrdersTogetherResult> {
    const { orgId } = command;
    const orderIds = [...new Set(command.payload.orderIds)];

    const orders = await tx.order.findMany({
      where: { id: { in: orderIds }, orgId, archived: false },
      include: {
        customer: { select: { id: true, name: true } },
        trackableUnits: { include: { lineItems: true }, orderBy: { sequenceNumber: 'asc' } },
        lineItems: { where: { trackableUnitId: null } },
      },
      orderBy: { createdAt: 'asc' },
    });
    if (orders.length !== orderIds.length) throw new Error('Order not found');

    const refusal = shipTogetherRefusal(orders);
    if (refusal) throw new ConsolidationRuleError(refusal);

    const byCustomer = new Map<string, typeof orders>();
    for (const o of orders) byCustomer.set(o.customerId, [...(byCustomer.get(o.customerId) ?? []), o]);

    const shipmentIds: string[] = [];
    for (const group of byCustomer.values()) {
      shipmentIds.push(await combineOrdersIntoNewShipment(tx, command, group, emit));
    }

    const consolidation = await tx.consolidation.create({ data: { orgId, reference: newReference(new Date()) } });
    await attachShipments(tx, orgId, consolidation.id, shipmentIds);
    const { stopCount, changedShipmentIds } = await rebuildConsolidationStops(tx, orgId, consolidation.id);

    emit(this.createEvent(command, {
      type: EVENT_TYPES.CONSOLIDATION_CREATED,
      entityType: 'consolidation',
      entityId: consolidation.id,
      payload: { reference: consolidation.reference, shipmentIds, stopCount, orderIds },
    }));
    for (const e of shipmentUpdatedEvents(changedShipmentIds, ['consolidation'], consolidation.id)) emit(this.createEvent(command, e));

    return { consolidationId: consolidation.id, reference: consolidation.reference, shipmentIds };
  }
}
