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

    // Batch create notifications
    await this.prisma.notification.createMany({
      data: users.map((user) => ({
        userId: user.id,
        orgId: event.orgId,
        title: content.title,
        body: content.body,
        category: content.category,
        severity: content.severity,
        entityType: event.entityType,
        entityId: event.entityId,
        actionUrl: `/${event.entityType}s/${event.entityId}`,
        eventId: event.id,
        eventType: event.type,
      })),
    });

    console.log(`[InAppNotification] Created ${users.length} notification(s) for ${event.type}`);
  }
}
