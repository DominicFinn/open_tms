import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';
import { DeliveryStatus, deliveryEvent } from './orderDeliveryEvents.js';
import { findOriginStop } from '../../services/tracking/journeyStops.js';

export interface RecordStopOrdersDeliveryPayload {
  stopId: string;
  /** The stop's new status: 'arrived', 'in_progress' or 'completed'. */
  status: string;
  method: string;
  /** When it happened (device time for tracking), ISO. */
  occurredAt: string;
}

export const RECORD_STOP_ORDERS_DELIVERY = 'order.record_stop_delivery';

export class ShipmentStopNotFoundError extends Error {
  constructor() {
    super('Shipment stop not found');
    this.name = 'ShipmentStopNotFoundError';
  }
}

// deliveryStatus is null until an order starts moving; Prisma's notIn doesn't reliably match NULL
// rows, so the still-active states are listed explicitly.
const ACTIVE_DELIVERY = [{ deliveryStatus: null }, { deliveryStatus: 'in_transit' }, { deliveryStatus: 'exception' }];

/**
 * Moves a shipment stop to a new status and the orders it affects with it (#325).
 *
 * BUSINESS RULES:
 * - Completing a pickup (leaving it) puts the not-yet-moving orders collected there in transit
 *   (#329; orders with no pickup stop count as collected at the first pickup). It never delivers
 *   anything: before #325 this marked orders delivered if their delivery stop was the origin (#307).
 * - Arriving at a delivery stop puts its not-yet-moving orders in transit.
 * - Completing a delivery stop delivers its active orders. A refusal afterwards is a delivery
 *   exception raised against the order, not a reversal here.
 *
 * Each order that changes emits its own event (see orderDeliveryEvents), stamped with
 * `occurredAt`.
 */
export class RecordStopOrdersDeliveryCommandHandler extends BaseCommandHandler<RecordStopOrdersDeliveryPayload, { ordersUpdated: number; shipmentId: string }> {
  readonly commandType = RECORD_STOP_ORDERS_DELIVERY;
  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) { super(prisma, eventBus); }

  protected async handle(command: Command<RecordStopOrdersDeliveryPayload>, tx: TransactionClient, emit: EmitFn) {
    const { stopId, status, method } = command.payload;
    const occurredAt = new Date(command.payload.occurredAt);
    const orgId = command.orgId;

    const stop = await tx.shipmentStop.findFirst({
      where: { id: stopId, shipment: { orgId } },
      include: {
        location: { select: { name: true } },
        shipment: {
          select: {
            originId: true,
            stops: { select: { id: true, locationId: true, sequenceNumber: true, status: true, actualArrival: true, actualDeparture: true } },
          },
        },
      },
    });
    if (!stop) throw new ShipmentStopNotFoundError();

    const reached = status === 'arrived' || status === 'in_progress' || status === 'completed';
    await tx.shipmentStop.update({
      where: { id: stopId, shipment: { orgId } },
      data: {
        status,
        actualArrival: reached ? (stop.actualArrival ?? occurredAt) : stop.actualArrival,
        actualDeparture: status === 'completed' ? occurredAt : stop.actualDeparture,
      },
    });

    const firstPickup = findOriginStop(stop.shipment.stops, stop.shipment.originId);
    const isPickup = stop.stopType === 'pickup' || stop.id === firstPickup?.id;
    const change = ordersToChange(isPickup, status);
    if (!change) return { ordersUpdated: 0, shipmentId: stop.shipmentId };

    const orders = await tx.order.findMany({
      where: {
        orgId,
        ...(change.scope === 'pickup'
          ? {
            orderShipments: { some: { shipmentId: stop.shipmentId } },
            // The orders collected here; orders linked before multi-pickup have no pickup stop and
            // were collected at the first one (#329).
            AND: [{ OR: [{ pickupStopId: stopId }, ...(stop.id === firstPickup?.id ? [{ pickupStopId: null }] : [])] }],
          }
          : { deliveryStopId: stopId }),
        OR: change.from === 'unmoved' ? [{ deliveryStatus: null }] : ACTIVE_DELIVERY,
      },
      select: { id: true, orderNumber: true, deliveryStatus: true },
    });

    for (const order of orders) {
      await tx.order.update({
        where: { id: order.id, orgId },
        data: {
          deliveryStatus: change.to,
          deliveryMethod: method,
          ...(change.to === 'delivered' ? { deliveredAt: occurredAt, deliveryConfirmedBy: 'system:shipment_stop_completed' } : {}),
        },
      });
      await tx.auditLog.create({
        data: {
          orgId,
          entityType: 'order',
          entityId: order.id,
          orderId: order.id,
          action: 'delivery_status_changed',
          description: change.to === 'delivered'
            ? `Order delivered at stop (${stop.location?.name || 'unknown'}) via ${method}`
            : `Order in transit - stop ${status} (${stop.location?.name || 'unknown'}) via ${method}`,
          changes: { before: { deliveryStatus: order.deliveryStatus }, after: { deliveryStatus: change.to } },
        },
      });

      const event = deliveryEvent({
        orderNumber: order.orderNumber,
        previousStatus: order.deliveryStatus,
        newStatus: change.to,
        method,
        occurredAt,
        shipmentId: stop.shipmentId,
        stopId,
      });
      emit(this.createEvent(command, { type: event.type, entityType: 'order', entityId: order.id, payload: event.payload }));
    }

    return { ordersUpdated: orders.length, shipmentId: stop.shipmentId };
  }
}

interface OrderChange {
  scope: 'pickup' | 'stop';
  from: 'unmoved' | 'active';
  to: DeliveryStatus;
}

function ordersToChange(isPickup: boolean, status: string): OrderChange | null {
  if (isPickup) return status === 'completed' ? { scope: 'pickup', from: 'unmoved', to: 'in_transit' } : null;
  if (status === 'completed') return { scope: 'stop', from: 'active', to: 'delivered' };
  if (status === 'arrived' || status === 'in_progress') return { scope: 'stop', from: 'unmoved', to: 'in_transit' };
  return null;
}
