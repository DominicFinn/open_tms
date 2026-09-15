/**
 * linkOrdersToShipment — shared linking mechanics for attaching order(s) to a
 * shipment: appends items, finds-or-creates a delivery stop per unique
 * destination, links via OrderShipment, flips each order to 'assigned',
 * audit-logs it, and emits ORDER_ASSIGNED_TO_SHIPMENT per order.
 *
 * Used by every order→shipment command that creates or reuses a shipment
 * (convert, combine, manual add-to-existing-shipment) so stop/status/audit/
 * event mechanics live in exactly one place. Caller owns the transaction,
 * the emit function's eventual persistence, and any pre-validation
 * (shipment status, origin/customer match, etc).
 */

import { Prisma } from '@prisma/client';
import { createEvent } from '../../events/createEvent.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { EmitFn, TransactionClient } from '../BaseCommandHandler.js';

export interface LinkableShipment {
  id: string;
  reference: string;
  items: Prisma.JsonValue;
}

export interface LinkOrdersToShipmentContext {
  orgId: string;
  actorId: string | null;
  correlationId?: string;
  source?: string;
}

export async function linkOrdersToShipment(
  tx: TransactionClient,
  shipment: LinkableShipment,
  orders: any[],
  ctx: LinkOrdersToShipmentContext,
  describe: (order: any) => string,
  emit: EmitFn,
  extraChanges?: Record<string, unknown>,
): Promise<void> {
  const existingItems = Array.isArray(shipment.items) ? (shipment.items as any[]) : [];
  const newItems = buildItemsPayload(orders);
  await tx.shipment.update({
    where: { id: shipment.id },
    data: { items: [...existingItems, ...newItems] },
  });

  const maxSeq = await tx.shipmentStop.aggregate({
    where: { shipmentId: shipment.id },
    _max: { sequenceNumber: true },
  });
  let nextSeq = (maxSeq._max.sequenceNumber || 0) + 1;

  const userId = ctx.actorId ?? undefined;

  for (const order of orders) {
    let stop = await tx.shipmentStop.findFirst({
      where: { shipmentId: shipment.id, locationId: order.destinationId! },
    });
    if (!stop) {
      stop = await tx.shipmentStop.create({
        data: {
          shipmentId: shipment.id,
          locationId: order.destinationId!,
          sequenceNumber: nextSeq++,
          stopType: 'delivery',
          status: 'pending',
        },
      });
    }

    await tx.orderShipment.create({
      data: { orderId: order.id, shipmentId: shipment.id },
    });

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: 'assigned',
        deliveryStopId: stop.id,
      },
    });

    await tx.auditLog.create({
      data: {
        entityType: 'order',
        entityId: order.id,
        orderId: order.id,
        action: 'delivery_status_changed',
        description: describe(order),
        changes: {
          before: { status: order.status },
          after: { status: 'assigned' },
          ...extraChanges,
        },
        userId,
      },
    });

    emit(createEvent({
      type: EVENT_TYPES.ORDER_ASSIGNED_TO_SHIPMENT,
      orgId: ctx.orgId,
      actorId: ctx.actorId,
      entityType: 'order',
      entityId: order.id,
      payload: {
        orderReference: order.orderNumber,
        shipmentId: shipment.id,
        shipmentReference: shipment.reference,
      },
      correlationId: ctx.correlationId,
      source: ctx.source,
    }));
  }
}

function buildItemsPayload(orders: any[]): any[] {
  return orders.map((order) => ({
    orderId: order.id,
    orderNumber: order.orderNumber,
    trackableUnits: (order.trackableUnits || []).map((unit: any) => ({
      unitId: unit.id,
      identifier: unit.identifier,
      unitType: unit.unitType,
      items: (unit.lineItems || []).map((item: any) => ({
        sku: item.sku,
        description: item.description,
        quantity: item.quantity,
        weight: item.weight,
        weightUnit: item.weightUnit,
      })),
    })),
    legacyItems: (order.lineItems || [])
      .filter((item: any) => !item.trackableUnitId)
      .map((item: any) => ({
        sku: item.sku,
        description: item.description,
        quantity: item.quantity,
        weight: item.weight,
        weightUnit: item.weightUnit,
      })),
  }));
}
