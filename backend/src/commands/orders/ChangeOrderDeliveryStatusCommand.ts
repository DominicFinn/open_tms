import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';
import { DeliveryStatus, deliveryEvent } from './orderDeliveryEvents.js';

export interface ChangeOrderDeliveryStatusPayload {
  orderId: string;
  deliveryStatus: DeliveryStatus;
  deliveryMethod?: string;
  /** Free text (a name, a team, a system id): goes to the order and audit log, never an event. */
  deliveryConfirmedBy?: string;
  deliveryNotes?: string;
  exceptionType?: string;
  exceptionNotes?: string;
}

export const CHANGE_ORDER_DELIVERY_STATUS = 'order.change_delivery_status';

export class OrderNotFoundError extends Error {
  constructor() {
    super('Order not found');
    this.name = 'OrderNotFoundError';
  }
}

/** A manual delivery status change on one order: in transit, delivered, or a delivery exception. */
export class ChangeOrderDeliveryStatusCommandHandler extends BaseCommandHandler<ChangeOrderDeliveryStatusPayload, { orderId: string }> {
  readonly commandType = CHANGE_ORDER_DELIVERY_STATUS;
  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) { super(prisma, eventBus); }

  protected async handle(command: Command<ChangeOrderDeliveryStatusPayload>, tx: TransactionClient, emit: EmitFn) {
    const p = command.payload;
    const order = await tx.order.findFirst({ where: { id: p.orderId, orgId: command.orgId } });
    if (!order) throw new OrderNotFoundError();

    const now = new Date();
    await tx.order.update({
      where: { id: p.orderId, orgId: command.orgId },
      data: {
        deliveryStatus: p.deliveryStatus,
        deliveryMethod: p.deliveryMethod,
        deliveryConfirmedBy: p.deliveryConfirmedBy,
        deliveryNotes: p.deliveryNotes,
        ...(p.deliveryStatus === 'delivered' ? { deliveredAt: now } : {}),
        ...(p.deliveryStatus === 'exception' ? { exceptionType: p.exceptionType, exceptionNotes: p.exceptionNotes } : {}),
      },
    });

    await tx.auditLog.create({
      data: {
        orgId: command.orgId,
        entityType: 'order',
        entityId: p.orderId,
        orderId: p.orderId,
        action: 'delivery_status_changed',
        description: `Delivery status changed from ${order.deliveryStatus} to ${p.deliveryStatus}${p.deliveryMethod ? ` via ${p.deliveryMethod}` : ''}`,
        changes: {
          before: { deliveryStatus: order.deliveryStatus },
          after: {
            deliveryStatus: p.deliveryStatus,
            ...(p.deliveryMethod && { deliveryMethod: p.deliveryMethod }),
            ...(p.exceptionType && { exceptionType: p.exceptionType }),
          },
        },
        // deliveryConfirmedBy is free text, not a User id (#250), so it goes in userName.
        userName: p.deliveryConfirmedBy || undefined,
      },
    });

    const event = deliveryEvent({
      orderNumber: order.orderNumber,
      previousStatus: order.deliveryStatus,
      newStatus: p.deliveryStatus,
      method: p.deliveryMethod,
      occurredAt: now,
      exceptionType: p.exceptionType,
    });
    emit(this.createEvent(command, { type: event.type, entityType: 'order', entityId: p.orderId, payload: event.payload }));

    return { orderId: p.orderId };
  }
}

export interface ResolveOrderDeliveryExceptionPayload {
  orderId: string;
  resolvedBy?: string;
  notes?: string;
}

export const RESOLVE_ORDER_DELIVERY_EXCEPTION = 'order.resolve_delivery_exception';

export class OrderNotInExceptionError extends Error {
  constructor() {
    super('Order is not in exception status');
    this.name = 'OrderNotInExceptionError';
  }
}

/** Clears a delivery exception and puts the order back in transit. */
export class ResolveOrderDeliveryExceptionCommandHandler extends BaseCommandHandler<ResolveOrderDeliveryExceptionPayload, { orderId: string }> {
  readonly commandType = RESOLVE_ORDER_DELIVERY_EXCEPTION;
  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) { super(prisma, eventBus); }

  protected async handle(command: Command<ResolveOrderDeliveryExceptionPayload>, tx: TransactionClient, emit: EmitFn) {
    const { orderId, resolvedBy, notes } = command.payload;
    const order = await tx.order.findFirst({ where: { id: orderId, orgId: command.orgId } });
    if (!order) throw new OrderNotFoundError();
    if (order.deliveryStatus !== 'exception') throw new OrderNotInExceptionError();

    await tx.order.update({
      where: { id: orderId, orgId: command.orgId },
      data: {
        deliveryStatus: 'in_transit',
        exceptionResolvedAt: new Date(),
        deliveryNotes: notes ? `${order.deliveryNotes || ''}\n\nException resolved: ${notes}` : order.deliveryNotes,
      },
    });

    await tx.auditLog.create({
      data: {
        orgId: command.orgId,
        entityType: 'order',
        entityId: orderId,
        orderId,
        action: 'exception_resolved',
        description: `Exception resolved, status changed from exception to in_transit${notes ? `: ${notes}` : ''}`,
        changes: {
          before: { deliveryStatus: 'exception', exceptionType: order.exceptionType },
          after: { deliveryStatus: 'in_transit' },
        },
        userName: resolvedBy || undefined,
      },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.ORDER_EXCEPTION_RESOLVED,
      entityType: 'order',
      entityId: orderId,
      payload: { orderReference: order.orderNumber, previousStatus: 'exception', newStatus: 'in_transit' },
    }));

    return { orderId };
  }
}
