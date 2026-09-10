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
      () => `Order manually added to shipment ${shipment.reference}`,
      emit,
    );

    return { shipmentId: shipment.id, addedOrderIds: orders.map((o) => o.id) };
  }
}
