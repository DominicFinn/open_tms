import { createEvent } from '../../events/createEvent.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { createPickupStop, linkOrdersToShipment } from '../shipments/linkOrdersToShipment.js';
import { assignMatchingLane } from '../shipments/assignMatchingLane.js';
import { Command } from '../types.js';
import { loadProfileFor } from './shipmentLoadRules.js';

/**
 * Creates one draft shipment carrying `orders`, inside the caller's transaction: the first order's
 * customer, a pickup at the first origin, every order linked to its pickup and drop, ending at the
 * last drop, on a matching lane when one fits. Shared by CombineOrdersIntoShipmentCommand and
 * ShipOrdersTogetherCommand (#329). `orders` must be loaded with customer, trackableUnits (with
 * lineItems) and unit-less lineItems, oldest first. Returns the shipment id.
 */
export async function combineOrdersIntoNewShipment(
  tx: TransactionClient,
  command: Command<unknown>,
  orders: any[],
  emit: EmitFn,
): Promise<string> {
    const firstOrder = orders[0];
    const timestamp = Date.now().toString(36).toUpperCase().slice(-6);
    const reference = `SH-BATCH-${timestamp}`;

    const shipment = await tx.shipment.create({
      data: {
        orgId: command.orgId,
        reference,
        customerId: firstOrder.customerId,
        originId: firstOrder.originId!,
        destinationId: firstOrder.destinationId!,
        items: [],
        status: 'draft',
        ...loadProfileFor(orders),
      },
    });

    emit(createEvent({
      orgId: command.orgId,
      actorId: command.actorId,
      correlationId: command.metadata.correlationId,
      source: command.metadata.source,
      type: EVENT_TYPES.SHIPMENT_CREATED,
      entityType: 'shipment',
      entityId: shipment.id,
      payload: {
        shipmentReference: reference,
        customerId: firstOrder.customerId,
        originId: firstOrder.originId,
        destinationId: firstOrder.destinationId,
        status: 'draft',
      },
    }));

    await createPickupStop(tx, shipment.id, shipment.originId!);

    await linkOrdersToShipment(
      tx,
      shipment,
      orders,
      {
        orgId: command.orgId,
        actorId: command.actorId,
        correlationId: command.metadata.correlationId,
        source: command.metadata.source,
      },
      () => `Order combined into batch shipment ${reference} with ${orders.length} orders`,
      emit,
      { batchOrderIds: orders.map((o) => o.id) },
    );

    // With orders bound for different places, the shipment ends at its last drop, not at the first
    // order's destination: checkpoints and the route header measure towards it (#324).
    const finalStop = await tx.shipmentStop.findFirst({
      where: { shipmentId: shipment.id, shipment: { orgId: command.orgId } },
      orderBy: { sequenceNumber: 'desc' },
      select: { locationId: true },
    });
    if (finalStop && finalStop.locationId !== shipment.destinationId) {
      await tx.shipment.update({ where: { id: shipment.id, orgId: command.orgId }, data: { destinationId: finalStop.locationId } });
    }

    await assignMatchingLane(tx, command.orgId, shipment);

    return shipment.id;
}
