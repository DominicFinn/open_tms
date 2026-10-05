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
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';
import { combineOrdersIntoNewShipment } from './combineOrdersIntoNewShipment.js';

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
      where: { id: { in: orderIds }, orgId: command.orgId, archived: false },
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

    return { shipmentId: await combineOrdersIntoNewShipment(tx, command, orders, emit) };
  }
}
