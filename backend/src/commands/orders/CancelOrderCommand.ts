import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface CancelOrderPayload {
  id: string;
}

export const CANCEL_ORDER = 'order.cancel';

// Orders can only be cancelled before they're linked to a shipment. Once
// assigned, the order is physically committed to a shipment — a
// post-assignment problem is a delivery exception (deliveryStatus =
// 'exception'), handled by a person, not a status flip here.
const CANCELLABLE_STATUSES = ['pending', 'verified', 'issue'];

export class CancelOrderCommandHandler extends BaseCommandHandler<CancelOrderPayload, { id: string }> {
  readonly commandType = CANCEL_ORDER;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<CancelOrderPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string }> {
    const { id } = command.payload;

    const existing = await tx.order.findFirstOrThrow({ where: { id } });

    if (!CANCELLABLE_STATUSES.includes(existing.status)) {
      throw new Error(
        `Cannot cancel an order with status "${existing.status}". Orders can only be cancelled before ` +
        `they're assigned to a shipment — once assigned, use a delivery exception instead.`
      );
    }

    const order = await tx.order.update({
      where: { id },
      data: { status: 'cancelled' },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.ORDER_STATUS_CHANGED,
      entityType: 'order',
      entityId: id,
      payload: {
        orderReference: order.orderNumber,
        previousStatus: existing.status,
        newStatus: 'cancelled',
      },
    }));

    return { id };
  }
}
