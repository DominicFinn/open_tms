/**
 * UpdateLineItemCommand — edit the fields of an existing OrderLineItem.
 * Useful when an operator/customer needs to correct quantity, weight, dims,
 * hazmat detail, or any of the other Phase 1 fields without deleting and
 * recreating the line.
 *
 * Emits order_line_item.updated with a `changes` diff for audit.
 */

import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface UpdateLineItemPayload {
  id: string;
  data: {
    description?: string | null;
    quantity?: number;
    unitOfMeasure?: string;
    weight?: number | null;
    weightUnit?: string;
    length?: number | null;
    width?: number | null;
    height?: number | null;
    dimUnit?: string;
    unitPriceCents?: number | null;
    totalPriceCents?: number | null;
    priceCurrency?: string;
    freightClass?: string | null;
    nmfcCode?: string | null;
    hazmat?: boolean;
    unNumber?: string | null;
    hazmatClass?: string | null;
    packingGroup?: string | null;
    properShippingName?: string | null;
    hsCode?: string | null;
    countryOfOrigin?: string | null;
    temperature?: string | null;
    tempMinC?: number | null;
    tempMaxC?: number | null;
  };
}

export const UPDATE_LINE_ITEM = 'order_line_item.update';

export class UpdateLineItemCommandHandler extends BaseCommandHandler<UpdateLineItemPayload, { id: string }> {
  readonly commandType = UPDATE_LINE_ITEM;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<UpdateLineItemPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string }> {
    const { id, data } = command.payload;

    const previous = await tx.orderLineItem.findUniqueOrThrow({ where: { id } });
    const updated = await tx.orderLineItem.update({ where: { id }, data });

    const changes: Record<string, { before: unknown; after: unknown }> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && (previous as any)[key] !== value) {
        changes[key] = { before: (previous as any)[key], after: value };
      }
    }

    emit(this.createEvent(command, {
      type: EVENT_TYPES.ORDER_LINE_ITEM_UPDATED,
      entityType: 'order_line_item',
      entityId: id,
      payload: {
        orderId: updated.orderId,
        sku: updated.sku,
        trackableUnitId: updated.trackableUnitId,
        changes,
      },
    }));

    return { id };
  }
}
