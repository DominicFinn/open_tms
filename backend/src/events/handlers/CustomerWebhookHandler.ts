import { PrismaClient } from '@prisma/client';
import { DomainEvent } from '../DomainEvent.js';
import { IEventHandler } from '../IEventHandler.js';
import { SubscribeOptions } from '../IEventBus.js';
import { CustomerWebhookDeliveryService } from '../../services/webhooks/CustomerWebhookDeliveryService.js';

/**
 * Fans out domain events to customer-registered webhook endpoints.
 *
 * A webhook is eligible when:
 *  1. It is enabled
 *  2. Its subscribed event patterns match the event type (supports "*", "rma.*", etc.)
 *  3. The event concerns the webhook's customer - matched via payload.customerId
 *     (present on rma, order, shipment, invoice events)
 */
export class CustomerWebhookHandler implements IEventHandler {
  readonly name = 'webhook.customer';
  readonly eventPatterns = [
    'rma.*',
    'order.created', 'order.confirmed', 'order.delivered', 'order.cancelled', 'order.status_changed',
    'shipment.dispatched', 'shipment.delivered', 'shipment.exception', 'shipment.status_changed',
    'invoice.created', 'invoice.sent', 'invoice.paid',
    'pack.audit_recorded', 'pack.audit_variance_detected',
  ];
  readonly options: SubscribeOptions = {
    concurrency: 5,
    priority: 10,
  };

  private readonly delivery: CustomerWebhookDeliveryService;

  constructor(private prisma: PrismaClient) {
    this.delivery = new CustomerWebhookDeliveryService(prisma);
  }

  async handle(event: DomainEvent): Promise<void> {
    const customerId = await this.resolveCustomerId(event);
    if (!customerId) return;

    const hooks = await this.prisma.customerWebhook.findMany({
      where: { customerId, enabled: true },
    });
    if (hooks.length === 0) return;

    const matching = hooks.filter(h => CustomerWebhookDeliveryService.matches(h.events, event.type));
    if (matching.length === 0) return;

    await Promise.all(matching.map(webhook =>
      this.delivery.deliver({
        webhook,
        eventType: event.type,
        eventId: event.id,
        payload: {
          entityType: event.entityType,
          entityId: event.entityId,
          ...(event.payload as Record<string, unknown>),
        },
      }).catch(err => {
        console.error(`[CustomerWebhookHandler] Delivery failed for webhook ${webhook.id}:`, err);
      })
    ));
  }

  /**
   * Resolve the relevant customerId for an event. Most domain events carry it
   * directly in the payload (rma, order, shipment, invoice). Pack audit events
   * don't - they reference a packTaskId, so we resolve via PackTask → Order.customerId.
   */
  private async resolveCustomerId(event: DomainEvent): Promise<string | null> {
    const payload = event.payload as Record<string, unknown> | null;
    if (payload && typeof payload.customerId === 'string') return payload.customerId;

    if (event.type === 'pack.audit_recorded' || event.type === 'pack.audit_variance_detected') {
      const packTaskId = payload?.packTaskId as string | undefined;
      if (!packTaskId) return null;
      const task = await this.prisma.packTask.findUnique({
        where: { id: packTaskId },
        select: { orderId: true },
      });
      if (!task?.orderId) return null;
      const order = await this.prisma.order.findUnique({
        where: { id: task.orderId },
        select: { customerId: true },
      });
      return order?.customerId ?? null;
    }

    return null;
  }
}
