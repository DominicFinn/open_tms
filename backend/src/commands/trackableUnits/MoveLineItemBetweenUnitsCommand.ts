/**
 * MoveLineItemBetweenUnitsCommand — reassigns an existing OrderLineItem from
 * one TrackableUnit to another (or to "no unit" when targetUnitId is null).
 * Used by the drag-and-drop handling-units editor.
 *
 * Both units must belong to the same order.
 */

import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface MoveLineItemBetweenUnitsPayload {
  lineItemId: string;
  /** target unit id; null means "detach from any unit" */
  targetUnitId: string | null;
}

export const MOVE_LINE_ITEM_BETWEEN_UNITS = 'trackable_unit.move_line_item';

export class MoveLineItemBetweenUnitsCommandHandler extends BaseCommandHandler<MoveLineItemBetweenUnitsPayload, { id: string }> {
  readonly commandType = MOVE_LINE_ITEM_BETWEEN_UNITS;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<MoveLineItemBetweenUnitsPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string }> {
    const { lineItemId, targetUnitId } = command.payload;

    const lineItem = await tx.orderLineItem.findUniqueOrThrow({
      where: { id: lineItemId },
      select: { id: true, orderId: true, trackableUnitId: true, sku: true },
    });

    if (targetUnitId) {
      const target = await tx.trackableUnit.findUniqueOrThrow({
        where: { id: targetUnitId },
        select: { orderId: true },
      });
      if (target.orderId !== lineItem.orderId) {
        throw new Error(`Cannot move line item across orders (source order ${lineItem.orderId}, target order ${target.orderId})`);
      }
    }

    await tx.orderLineItem.update({
      where: { id: lineItemId },
      data: { trackableUnitId: targetUnitId },
    });

    // The event's entity is the line item being moved — its identity is what
    // downstream handlers should look up if they want richer detail. Previous
    // code stamped entityType=trackable_unit with an entityId that could fall
    // through to the orderId when both source and target were null, which
    // would mis-route any handler that did `prisma.trackableUnit.findUnique`.
    emit(this.createEvent(command, {
      type: EVENT_TYPES.TRACKABLE_UNIT_LINE_ITEM_MOVED,
      entityType: 'order_line_item',
      entityId: lineItemId,
      payload: {
        orderId: lineItem.orderId,
        lineItemId,
        sku: lineItem.sku,
        fromUnitId: lineItem.trackableUnitId,
        toUnitId: targetUnitId,
      },
    }));

    return { id: lineItemId };
  }
}
