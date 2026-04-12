/**
 * InAppNotificationHandler — creates Notification records for the bell icon.
 *
 * Subscribes to status changes, exceptions, and delivery events.
 * In a full implementation, checks UserNotificationPreference to determine
 * which users get which notifications. For now, creates notifications
 * for all users in the org.
 */

import { PrismaClient } from '@prisma/client';
import { DomainEvent } from '../DomainEvent.js';
import { IEventHandler } from '../IEventHandler.js';
import { SubscribeOptions } from '../IEventBus.js';

/** Maps event types to human-readable notification content */
function buildNotification(event: DomainEvent): { title: string; body: string; category: string; severity: string } | null {
  const p = event.payload as any;

  switch (event.type) {
    case 'shipment.status_changed':
      return {
        title: `Shipment ${p.shipmentReference || event.entityId} status changed`,
        body: `Status changed from ${p.previousStatus} to ${p.newStatus}`,
        category: 'shipment_update',
        severity: 'info',
      };
    case 'shipment.exception':
      return {
        title: `Shipment ${p.shipmentReference || event.entityId} exception`,
        body: p.description || `Exception: ${p.exceptionType}`,
        category: 'exception',
        severity: 'error',
      };
    case 'shipment.delivered':
      return {
        title: `Shipment ${p.shipmentReference || event.entityId} delivered`,
        body: `Delivered at ${p.deliveredAt}`,
        category: 'shipment_update',
        severity: 'success',
      };
    case 'order.exception':
      return {
        title: `Order ${p.orderReference || event.entityId} exception`,
        body: p.description || `Exception: ${p.exceptionType}`,
        category: 'exception',
        severity: 'error',
      };
    case 'order.delivered':
      return {
        title: `Order ${p.orderReference || event.entityId} delivered`,
        body: `Order has been delivered`,
        category: 'order_update',
        severity: 'success',
      };
    case 'order.status_changed':
      return {
        title: `Order ${p.orderReference || event.entityId} status changed`,
        body: `Status changed from ${p.previousStatus} to ${p.newStatus}`,
        category: 'order_update',
        severity: 'info',
      };
    case 'cargo.misdrop_detected':
      return {
        title: `Cargo misdrop: ${p.unitIdentifier || 'Unknown unit'}`,
        body: `${p.unitType} "${p.unitIdentifier}" was delivered to ${p.actualStop} but expected at ${p.expectedStop} (Order ${p.orderNumber})`,
        category: 'exception',
        severity: 'error',
      };
    case 'cargo.missing_at_stop':
      return {
        title: `Cargo missing: ${p.unitIdentifier || 'Unknown unit'}`,
        body: `${p.unitType} "${p.unitIdentifier}" was not found at ${p.stopName} (Order ${p.orderNumber})`,
        category: 'exception',
        severity: 'warning',
      };
    case 'cargo.left_on_vehicle':
      return {
        title: `Cargo left on vehicle: ${p.unitIdentifier || 'Unknown unit'}`,
        body: `${p.unitType} "${p.unitIdentifier}" was never confirmed delivered — may still be on the vehicle (Order ${p.orderNumber})`,
        category: 'exception',
        severity: 'error',
      };
    case 'cargo.discrepancy_resolved':
      return {
        title: `Cargo issue resolved: ${p.unitIdentifier || 'Unknown unit'}`,
        body: p.resolution || `Discrepancy for ${p.unitIdentifier} has been resolved`,
        category: 'order_update',
        severity: 'success',
      };
    case 'tracking.eta_updated': {
      const delaySeverity = p.severity === 'critical' ? 'error' : p.severity === 'warning' ? 'warning' : 'info';
      const delayLabel = p.severity === 'critical' ? 'CRITICAL DELAY' : p.severity === 'warning' ? 'Delay warning' : 'Minor delay';
      return {
        title: `${delayLabel}: ${p.shipmentReference || event.entityId}`,
        body: `Shipment is running ${p.delayMinutes} minutes late${p.nextStopName ? ` for ${p.nextStopName}` : ''}. New ETA: ${p.newEta ? new Date(p.newEta).toLocaleString() : 'unknown'}`,
        category: 'shipment_update',
        severity: delaySeverity,
      };
    }

    // ── Issue / Triage events ──
    case 'issue.created':
      return {
        title: `New issue: ${p.title || event.entityId.slice(0, 8)}`,
        body: `${(p.priority || 'medium').toUpperCase()} ${p.category || 'issue'} - ${p.title || 'New issue created'}`,
        category: 'issue',
        severity: p.priority === 'critical' ? 'error' : p.priority === 'high' ? 'warning' : 'info',
      };
    case 'issue.assigned':
      return {
        title: `Issue assigned: ${p.title || event.entityId.slice(0, 8)}`,
        body: `Assigned to ${p.assigneeName || 'someone'}${p.previousAssigneeId ? ' (reassigned)' : ''}`,
        category: 'issue',
        severity: 'info',
      };
    case 'issue.status_changed':
      return {
        title: `Issue updated: ${p.title || event.entityId.slice(0, 8)}`,
        body: `Status changed from ${p.previousStatus} to ${p.newStatus}`,
        category: 'issue',
        severity: 'info',
      };
    case 'issue.escalated':
      return {
        title: `Issue escalated: ${p.title || event.entityId.slice(0, 8)}`,
        body: `Escalated to ${p.escalatedTo || 'management'}${p.reason ? ': ' + p.reason : ''}`,
        category: 'issue',
        severity: 'error',
      };
    case 'issue.resolved':
      return {
        title: `Issue resolved: ${p.title || event.entityId.slice(0, 8)}`,
        body: p.resolution || 'Issue has been resolved',
        category: 'issue',
        severity: 'success',
      };
    case 'issue.closed':
      return {
        title: `Issue closed: ${p.title || event.entityId.slice(0, 8)}`,
        body: 'Issue has been closed',
        category: 'issue',
        severity: 'success',
      };
    case 'issue.reopened':
      return {
        title: `Issue reopened: ${p.title || event.entityId.slice(0, 8)}`,
        body: `Issue was reopened from ${p.previousStatus || 'closed'}`,
        category: 'issue',
        severity: 'warning',
      };
    case 'issue.snoozed':
      return {
        title: `Issue snoozed: ${p.title || event.entityId.slice(0, 8)}`,
        body: `Snoozed until ${p.snoozedUntil ? new Date(p.snoozedUntil).toLocaleString() : 'later'}`,
        category: 'issue',
        severity: 'info',
      };
    case 'issue.unsnoozed':
      return {
        title: `Issue woke up: ${p.title || event.entityId.slice(0, 8)}`,
        body: 'Issue snooze has expired - needs attention',
        category: 'issue',
        severity: 'warning',
      };
    case 'issue.needs_capa_marked':
      return p.needsCapa ? {
        title: `CAPA required: ${p.title || event.entityId.slice(0, 8)}`,
        body: 'This issue has been flagged as requiring a CAPA report',
        category: 'issue',
        severity: 'warning',
      } : null;
    case 'comment.added': {
      if (p.entityType !== 'issue') return null;
      return {
        title: `New comment on issue ${(p.entityId || event.entityId || '').slice(0, 8)}`,
        body: `${p.authorName || 'Someone'}: ${(p.body || '').slice(0, 100)}${(p.body || '').length > 100 ? '...' : ''}`,
        category: 'issue',
        severity: 'info',
      };
    }
    default:
      return null;
  }
}

export class InAppNotificationHandler implements IEventHandler {
  readonly name = 'notification.inapp';
  readonly eventPatterns = [
    'shipment.status_changed',
    'shipment.exception',
    'shipment.delivered',
    'order.status_changed',
    'order.exception',
    'order.delivered',
    'cargo.misdrop_detected',
    'cargo.missing_at_stop',
    'cargo.left_on_vehicle',
    'cargo.discrepancy_resolved',
    'tracking.eta_updated',
    // Issue / Triage events
    'issue.created',
    'issue.assigned',
    'issue.status_changed',
    'issue.escalated',
    'issue.resolved',
    'issue.closed',
    'issue.reopened',
    'issue.snoozed',
    'issue.unsnoozed',
    'issue.needs_capa_marked',
    'comment.added',
  ];
  readonly options: SubscribeOptions = {
    concurrency: 3,
    priority: 5,
  };

  constructor(private prisma: PrismaClient) {}

  async handle(event: DomainEvent): Promise<void> {
    const content = buildNotification(event);
    if (!content) return;

    // Find all users in this org
    // TODO: Check UserNotificationPreference per user
    const users = await this.prisma.user.findMany({
      where: { organizationId: event.orgId },
      select: { id: true },
    });

    if (users.length === 0) return;

    // Build the correct action URL based on event type
    const p = event.payload as any;
    let actionEntityType = event.entityType;
    let actionEntityId = event.entityId;
    // For comment events, link to the commented entity (e.g., issue) not the comment itself
    if (event.type === 'comment.added' && p.entityType && p.entityId) {
      actionEntityType = p.entityType;
      actionEntityId = p.entityId;
    }
    const actionUrl = `/${actionEntityType}s/${actionEntityId}`;

    // Batch create notifications
    await this.prisma.notification.createMany({
      data: users.map((user) => ({
        userId: user.id,
        orgId: event.orgId,
        title: content.title,
        body: content.body,
        category: content.category,
        severity: content.severity,
        entityType: actionEntityType,
        entityId: actionEntityId,
        actionUrl,
        eventId: event.id,
        eventType: event.type,
      })),
    });

    console.log(`[InAppNotification] Created ${users.length} notification(s) for ${event.type}`);
  }
}
