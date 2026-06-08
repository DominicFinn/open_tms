/**
 * DeleteLineItemCommand — removes an OrderLineItem. Phase 4 promoted from
 * direct repo call so the read model picks up the change via the projection.
 */

import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface DeleteLineItemPayload {
  id: string;
}

export const DELETE_LINE_ITEM = 'order_line_item.delete';

export class DeleteLineItemCommandHandler extends BaseCommandHandler<DeleteLineItemPayload, { id: string }> {
  readonly commandType = DELETE_LINE_ITEM;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<DeleteLineItemPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string }> {
    const { id } = command.payload;

    const existing = await tx.orderLineItem.findUniqueOrThrow({
      where: { id },
      select: { id: true, orderId: true, sku: true, trackableUnitId: true },
    });

    await tx.orderLineItem.delete({ where: { id } });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.ORDER_LINE_ITEM_DELETED,
      entityType: 'order_line_item',
      entityId: id,
      payload: {
        orderId: existing.orderId,
        sku: existing.sku,
        trackableUnitId: existing.trackableUnitId,
      },
    }));

    return { id };
  }
}
