/**
 * AddOrdersToShipmentCommand — links order(s) that are already known-eligible
 * onto an existing shipment and emits ORDER_ASSIGNED_TO_SHIPMENT per order.
 *
 * Extracted from OrderConversionService.addOrdersToShipment, which used to
 * run linkOrdersToShipment inside a bare prisma.$transaction with a no-op
 * emit — so ORDER_ASSIGNED_TO_SHIPMENT, despite having a working, tested
 * projection, was never emitted for orders manually added to an existing
 * shipment (#266, the sibling gap to #264).
 *
 * Eligibility filtering (shipment status, origin/customer/service-level/
 * hazmat/temp-control match) stays in OrderConversionService as a soft
 * pre-dispatch check, same as combineIntoShipment does with
 * checkCompatibility — this command trusts the orderIds it's given and just
 * re-reads the shipment and those orders fresh inside its own transaction.
 */

import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { assertCanAdd } from './shipmentLoadRules.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { linkOrdersToShipment } from '../shipments/linkOrdersToShipment.js';
import { Command } from '../types.js';

export interface AddOrdersToShipmentPayload {
  shipmentId: string;
  orderIds: string[];
}

export interface AddOrdersToShipmentResult {
  shipmentId: string;
  addedOrderIds: string[];
}

export const ADD_ORDERS_TO_SHIPMENT = 'shipment.add_orders';

export class AddOrdersToShipmentCommandHandler extends BaseCommandHandler<AddOrdersToShipmentPayload, AddOrdersToShipmentResult> {
  readonly commandType = ADD_ORDERS_TO_SHIPMENT;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<AddOrdersToShipmentPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<AddOrdersToShipmentResult> {
    const { shipmentId, orderIds } = command.payload;

    const shipment = await tx.shipment.findFirst({
      where: { id: shipmentId, orgId: command.orgId },
    });
    if (!shipment) throw new Error('Shipment not found');

    const orders = await tx.order.findMany({
      where: { id: { in: orderIds }, orgId: command.orgId },
      include: {
        trackableUnits: { include: { lineItems: true }, orderBy: { sequenceNumber: 'asc' } },
        lineItems: { where: { trackableUnitId: null } },
      },
    });
    if (orders.length === 0) throw new Error('No valid orders to add');

    const existingOrderCount = await tx.orderShipment.count({ where: { shipmentId, shipment: { orgId: command.orgId } } });
    const serviceLevel = assertCanAdd(shipment, existingOrderCount, orders);
    if (shipment.serviceLevel !== serviceLevel) {
      await tx.shipment.update({ where: { id: shipmentId, orgId: command.orgId }, data: { serviceLevel } });
    }

    const { stopsCreated } = await linkOrdersToShipment(
      tx,
      shipment,
      orders,
      {
        orgId: command.orgId,
        actorId: command.actorId,
        correlationId: command.metadata.correlationId,
        source: command.metadata.source,
      },
      () => `Order manually added to shipment ${shipment.reference}`,
      emit,
    );

    if (stopsCreated > 0) {
      await keepDestinationLast(tx, command.orgId, shipment);
      // The stops changed: the projection refreshes its counts and a custom route is re-planned.
      emit(this.createEvent(command, {
        type: EVENT_TYPES.SHIPMENT_UPDATED,
        entityType: 'shipment',
        entityId: shipment.id,
        payload: { shipmentReference: shipment.reference, stopsAdded: stopsCreated },
      }));
    }

    return { shipmentId: shipment.id, addedOrderIds: orders.map((o) => o.id) };
  }
}

/**
 * New drops are appended after the existing stops; the shipment's destination stays its last stop,
 * so the new drops sit before it, and the stops are renumbered 1..n.
 */
async function keepDestinationLast(
  tx: TransactionClient,
  orgId: string,
  shipment: { id: string; destinationId: string | null },
): Promise<void> {
  if (!shipment.destinationId) return;
  const stops = await tx.shipmentStop.findMany({
    where: { shipmentId: shipment.id, shipment: { orgId } },
    orderBy: { sequenceNumber: 'desc' },
    select: { id: true, locationId: true, sequenceNumber: true },
  });
  const last = stops[0];
  const destination = stops.find((st) => st.locationId === shipment.destinationId);
  if (!last || !destination || destination.id === last.id) return;

  // Renumber 1..n with the destination last, so stop numbers stay contiguous. Sequence numbers are
  // unique per shipment, so move them all out of the way first.
  const ordered = [...stops].reverse().filter((st) => st.id !== destination.id).concat(destination);
  await tx.shipmentStop.updateMany({ where: { shipmentId: shipment.id, shipment: { orgId } }, data: { sequenceNumber: { increment: 100000 } } });
  for (const [i, st] of ordered.entries()) {
    await tx.shipmentStop.update({ where: { id: st.id, shipment: { orgId } }, data: { sequenceNumber: i + 1 } });
  }
}
