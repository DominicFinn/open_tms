/**
 * CreateLineItemCommand — adds an OrderLineItem to an existing order
 * (optionally also linked to a TrackableUnit). Phase 4 promoted this from a
 * direct-repo call so it emits order_line_item.created and the OrderProjection
 * stays in sync.
 *
 * Distinct from AddLineItemToUnitCommand: that one requires a unitId; this
 * one is for the order-flat case (and lets the caller specify a unit too if
 * they want).
 */

import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';
import { CreateOrderLineItemDTO } from '../../repositories/OrdersRepository.js';

export interface CreateLineItemPayload {
  orderId: string;
  trackableUnitId?: string | null;
  item: CreateOrderLineItemDTO;
}

export const CREATE_LINE_ITEM = 'order_line_item.create';

export class CreateLineItemCommandHandler extends BaseCommandHandler<CreateLineItemPayload, { id: string }> {
  readonly commandType = CREATE_LINE_ITEM;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<CreateLineItemPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string }> {
    const { orderId, trackableUnitId, item } = command.payload;

    // Verify the order exists (cheap guard so we don't write orphans).
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      select: { id: true, orderNumber: true },
    });

    if (trackableUnitId) {
      const unit = await tx.trackableUnit.findUniqueOrThrow({
        where: { id: trackableUnitId },
        select: { orderId: true },
      });
      if (unit.orderId !== orderId) {
        throw new Error(`Trackable unit ${trackableUnitId} does not belong to order ${orderId}`);
      }
    }

    const created = await tx.orderLineItem.create({
      data: {
        orderId,
        trackableUnitId: trackableUnitId ?? undefined,
        sku: item.sku,
        description: item.description,
        quantity: item.quantity,
        weight: item.weight,
        weightUnit: item.weightUnit,
        length: item.length,
        width: item.width,
        height: item.height,
        dimUnit: item.dimUnit,
        hazmat: item.hazmat,
        temperature: item.temperature,
        unitOfMeasure: item.unitOfMeasure,
        unitPriceCents: item.unitPriceCents,
        totalPriceCents: item.totalPriceCents,
        priceCurrency: item.priceCurrency,
        freightClass: item.freightClass,
        nmfcCode: item.nmfcCode,
        unNumber: item.unNumber,
        hazmatClass: item.hazmatClass,
        packingGroup: item.packingGroup,
        properShippingName: item.properShippingName,
        hsCode: item.hsCode,
        countryOfOrigin: item.countryOfOrigin,
        tempMinC: item.tempMinC,
        tempMaxC: item.tempMaxC,
      },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.ORDER_LINE_ITEM_CREATED,
      entityType: 'order_line_item',
      entityId: created.id,
      payload: {
        orderId,
        orderReference: order.orderNumber,
        trackableUnitId: trackableUnitId ?? null,
        sku: created.sku,
        quantity: created.quantity,
      },
    }));

    return { id: created.id };
  }
}
