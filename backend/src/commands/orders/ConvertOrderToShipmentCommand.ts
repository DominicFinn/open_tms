/**
 * ConvertOrderToShipmentCommand — manually converts a single order into a
 * brand-new draft shipment and emits SHIPMENT_CREATED + (per order)
 * ORDER_ASSIGNED_TO_SHIPMENT.
 *
 * Extracted from OrderConversionService.convertOrder, which used to write
 * the Shipment row via a bare prisma.$transaction with no command dispatch —
 * so the new shipment never got a ShipmentReadModel row, and never tripped
 * AutoTenderHandler/SlaEvaluationHandler, both of which subscribe to
 * SHIPMENT_CREATED (#264).
 */

import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { linkOrdersToShipment } from '../shipments/linkOrdersToShipment.js';
import { Command } from '../types.js';

export interface ConvertOrderToShipmentPayload {
  orderId: string;
}

export interface ConvertOrderToShipmentResult {
  shipmentId: string;
}

export const CONVERT_ORDER_TO_SHIPMENT = 'order.convert_to_shipment';

export class ConvertOrderToShipmentCommandHandler extends BaseCommandHandler<ConvertOrderToShipmentPayload, ConvertOrderToShipmentResult> {
  readonly commandType = CONVERT_ORDER_TO_SHIPMENT;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<ConvertOrderToShipmentPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<ConvertOrderToShipmentResult> {
    const { orderId } = command.payload;

    // Re-read inside the transaction — the caller's own lookup (used only to
    // resolve orgId for the command envelope) is stale by the time we get here.
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        customer: { select: { id: true, name: true } },
        trackableUnits: { include: { lineItems: true } },
        lineItems: { where: { trackableUnitId: null } },
      },
    });

    if (!order) throw new Error('Order not found');
    if (order.status === 'assigned') {
      throw new Error(`Order already ${order.status}`);
    }
    if (!order.originId || !order.destinationId) {
      throw new Error('Order missing origin or destination');
    }

    const reference = `SH-${order.orderNumber}`;

    const shipment = await tx.shipment.create({
      data: {
        // Multi-tenancy: copy orgId from the source Order so the shipment
        // lands in the same tenant.
        orgId: order.orgId,
        reference,
        customerId: order.customerId,
        originId: order.originId,
        destinationId: order.destinationId,
        pickupDate: order.requestedPickupDate || undefined,
        deliveryDate: order.requestedDeliveryDate || undefined,
        items: [],
        status: 'draft',
      },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.SHIPMENT_CREATED,
      entityType: 'shipment',
      entityId: shipment.id,
      orgId: order.orgId,
      payload: {
        shipmentReference: reference,
        customerId: order.customerId,
        originId: order.originId,
        destinationId: order.destinationId,
        status: 'draft',
      },
    }));

    await linkOrdersToShipment(
      tx,
      shipment,
      [order],
      {
        orgId: order.orgId,
        actorId: command.actorId,
        correlationId: command.metadata.correlationId,
        source: command.metadata.source,
      },
      () => `Order converted to shipment ${reference}`,
      emit,
    );

    return { shipmentId: shipment.id };
  }
}
