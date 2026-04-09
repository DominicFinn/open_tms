/**
 * AuditHandler — subscribes to ALL events (*) and writes an immutable audit record.
 *
 * This is the first and most critical handler. It runs at highest priority
 * because audit logging is compliance-critical and must never be delayed.
 *
 * Writes to the AuditLog model with user attribution: if the event has an
 * actorId, the handler resolves the user's name for denormalized display.
 */

import { PrismaClient } from '@prisma/client';
import { DomainEvent } from '../DomainEvent.js';
import { IEventHandler } from '../IEventHandler.js';
import { SubscribeOptions } from '../IEventBus.js';

/** Map event type to a human-readable action name */
function eventTypeToAction(eventType: string): string {
  const parts = eventType.split('.');
  return parts[parts.length - 1] || eventType; // e.g. "shipment.created" → "created"
}

/** Build a human-readable description from an event */
function buildDescription(event: DomainEvent): string {
  const payload = event.payload as Record<string, unknown>;
  const entity = event.entityType;
  const action = eventTypeToAction(event.type);

  switch (event.type) {
    case 'shipment.created':
      return `Shipment ${payload.shipmentReference || event.entityId} created`;
    case 'shipment.status_changed':
      return `Shipment ${payload.shipmentReference || event.entityId} status changed from ${payload.previousStatus} to ${payload.newStatus}`;
    case 'shipment.delivered':
      return `Shipment ${payload.shipmentReference || event.entityId} delivered`;
    case 'shipment.exception':
      return `Shipment ${payload.shipmentReference || event.entityId} exception: ${payload.description || payload.exceptionType || 'unknown'}`;
    case 'order.status_changed':
      return `Order ${payload.orderReference || event.entityId} status changed from ${payload.previousStatus} to ${payload.newStatus}`;
    case 'order.delivered':
      return `Order ${payload.orderReference || event.entityId} delivered`;
    case 'order.exception':
      return `Order ${payload.orderReference || event.entityId} exception: ${payload.description || payload.exceptionType || 'unknown'}`;
    case 'location.created':
      return `Location ${payload.locationName || event.entityId} created${payload.source ? ` (via ${payload.source})` : ''}`;
    case 'location.updated':
      return `Location ${payload.locationName || event.entityId} updated`;
    case 'location.archived':
      return `Location ${payload.locationName || event.entityId} archived`;
    case 'location.arrival_criteria_added':
      return `Arrival criteria (${payload.criteriaType}) added to location ${payload.locationName || event.entityId}`;
    case 'tender.created':
      return `Tender created for shipment ${payload.shipmentReference || payload.shipmentId}`;
    case 'tender.published':
      return `Tender published for carrier bidding (shipment ${payload.shipmentReference || payload.shipmentId})`;
    case 'tender.awarded':
      return `Tender awarded to carrier ${payload.carrierId}${payload.price ? ` at ${payload.price}` : ''}`;
    case 'tender.cancelled':
      return `Tender cancelled for shipment ${payload.shipmentReference || payload.shipmentId}`;
    default:
      return `${entity} ${event.entityId} ${action}`;
  }
}

export class AuditHandler implements IEventHandler {
  readonly name = 'audit';
  readonly eventPatterns = ['*'];
  readonly options: SubscribeOptions = {
    concurrency: 5,
    priority: 10,
    retryLimit: 5,
    expireInSeconds: 300,
  };

  constructor(private prisma: PrismaClient) {}

  async handle(event: DomainEvent): Promise<void> {
    // Resolve user name if actorId is present
    let userId: string | undefined;
    let userName: string | undefined;

    if (event.actorId) {
      userId = event.actorId;
      try {
        const user = await this.prisma.user.findUnique({
          where: { id: event.actorId },
          select: { firstName: true, lastName: true, email: true },
        });
        if (user) {
          userName = `${user.firstName} ${user.lastName}`.trim() || user.email;
        }
      } catch {
        // Non-critical — proceed with userId only
      }
    }

    const payload = event.payload as Record<string, unknown>;
    const action = eventTypeToAction(event.type);
    const description = buildDescription(event);

    // Determine orderId for easy filtering (if entity is an order, or payload has orderId)
    const orderId = event.entityType === 'order'
      ? event.entityId
      : (payload.orderId as string | undefined);

    try {
      await this.prisma.auditLog.create({
        data: {
          entityType: event.entityType,
          entityId: event.entityId,
          orderId: orderId || undefined,
          action,
          description,
          changes: payload as any,
          userId,
          userName,
        },
      });
    } catch (err) {
      // Log but don't throw — the DomainEventLog already has the event persisted
      console.error(`[AuditHandler] Failed to write audit log: ${(err as Error).message}`);
    }

    console.log(
      `[Audit] ${event.type} | entity=${event.entityType}:${event.entityId} | org=${event.orgId} | actor=${userName || userId || 'system'} | ${event.timestamp}`
    );
  }
}
