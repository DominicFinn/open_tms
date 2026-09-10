/**
 * CombineOrdersIntoShipmentCommand — combines multiple compatible orders
 * into one new draft shipment and emits SHIPMENT_CREATED + (per order)
 * ORDER_ASSIGNED_TO_SHIPMENT.
 *
 * Extracted from OrderConversionService.combineIntoShipment (#264) — see
 * ConvertOrderToShipmentCommand's doc comment for why this needed to move
 * off a bare prisma.$transaction and onto the command bus. Compatibility
 * checking (checkCompatibility) stays in OrderConversionService as a
 * pre-dispatch read — it was already a soft pre-check run outside any
 * transaction before this change, so moving the write into a command
 * doesn't weaken it.
 */

import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { linkOrdersToShipment } from '../shipments/linkOrdersToShipment.js';
import { Command } from '../types.js';

export interface CombineOrdersIntoShipmentPayload {
  orderIds: string[];
}

export interface CombineOrdersIntoShipmentResult {
  shipmentId: string;
}

export const COMBINE_ORDERS_INTO_SHIPMENT = 'order.combine_into_shipment';

export class CombineOrdersIntoShipmentCommandHandler extends BaseCommandHandler<CombineOrdersIntoShipmentPayload, CombineOrdersIntoShipmentResult> {
  readonly commandType = COMBINE_ORDERS_INTO_SHIPMENT;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<CombineOrdersIntoShipmentPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<CombineOrdersIntoShipmentResult> {
    const { orderIds } = command.payload;

    const orders = await tx.order.findMany({
      where: { id: { in: orderIds }, archived: false },
      include: {
        customer: { select: { id: true, name: true } },
        trackableUnits: { include: { lineItems: true }, orderBy: { sequenceNumber: 'asc' } },
        lineItems: { where: { trackableUnitId: null } },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (orders.length === 0) {
      throw new Error('No valid orders found');
    }

    const firstOrder = orders[0];
    const timestamp = Date.now().toString(36).toUpperCase().slice(-6);
    const reference = `SH-BATCH-${timestamp}`;

    const shipment = await tx.shipment.create({
      data: {
        orgId: firstOrder.orgId,
        reference,
        customerId: firstOrder.customerId,
        originId: firstOrder.originId!,
        destinationId: firstOrder.destinationId!,
        items: [],
        status: 'draft',
      },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.SHIPMENT_CREATED,
      entityType: 'shipment',
      entityId: shipment.id,
      orgId: firstOrder.orgId,
      payload: {
        shipmentReference: reference,
        customerId: firstOrder.customerId,
        originId: firstOrder.originId,
        destinationId: firstOrder.destinationId,
        status: 'draft',
      },
    }));

    await linkOrdersToShipment(
      tx,
      shipment,
      orders,
      {
        orgId: firstOrder.orgId,
        actorId: command.actorId,
        correlationId: command.metadata.correlationId,
        source: command.metadata.source,
      },
      () => `Order combined into batch shipment ${reference} with ${orders.length} orders`,
      emit,
      { batchOrderIds: orderIds },
    );

    return { shipmentId: shipment.id };
  }
}
