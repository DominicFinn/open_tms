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

    emit(this.createEvent(command, {
      type: EVENT_TYPES.TRACKABLE_UNIT_LINE_ITEM_MOVED,
      entityType: 'trackable_unit',
      entityId: targetUnitId ?? lineItem.trackableUnitId ?? lineItem.orderId,
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
