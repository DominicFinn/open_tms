/**
 * The domain event for an order's delivery status moving to `newStatus` (#325).
 *
 * One event per transition, so each consumer (order read model, customer webhooks, email, in-app)
 * sees it once: `order.delivered`, `order.exception`, or `order.delivery_status_changed` for
 * anything else. Free-text confirmer names and notes are kept out: they can carry personal data,
 * and the audit log already holds them.
 */

import { EVENT_TYPES } from '../../events/eventTypes.js';

export type DeliveryStatus = 'in_transit' | 'delivered' | 'exception';

export interface DeliveryTransition {
  orderNumber: string;
  previousStatus: string | null;
  newStatus: DeliveryStatus;
  method?: string;
  occurredAt: Date;
  exceptionType?: string;
  shipmentId?: string;
  stopId?: string;
}

export function deliveryEvent(t: DeliveryTransition): { type: string; payload: Record<string, unknown> } {
  const common = {
    orderReference: t.orderNumber,
    previousStatus: t.previousStatus,
    newStatus: t.newStatus,
    method: t.method,
    shipmentId: t.shipmentId,
    stopId: t.stopId,
    eventTime: t.occurredAt.toISOString(),
  };
  if (t.newStatus === 'delivered') {
    return { type: EVENT_TYPES.ORDER_DELIVERED, payload: { ...common, deliveredAt: t.occurredAt.toISOString() } };
  }
  if (t.newStatus === 'exception') {
    return { type: EVENT_TYPES.ORDER_EXCEPTION, payload: { ...common, exceptionType: t.exceptionType } };
  }
  return { type: EVENT_TYPES.ORDER_DELIVERY_STATUS_CHANGED, payload: common };
}
