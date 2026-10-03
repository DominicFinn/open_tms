/**
 * ShipmentCompletionHandler — completes shipments when destination criteria are met.
 *
 * Listens for stop_arrived events at the final destination. When arrival criteria
 * are met at the destination stop, transitions the shipment to 'delivered' status.
 *
 * Completion can happen via:
 * 1. Geofence — GPS coordinates enter the destination geofence (automatic)
 * 2. WiFi — IoT device detects known WiFi network at destination (automatic)
 * 3. BLE — Bluetooth beacon detected at destination (automatic)
 * 4. Manual — User marks the shipment as delivered (not handled here)
 * 5. API — External system calls the status update endpoint (not handled here)
 */

import { PrismaClient } from '@prisma/client';
import { DomainEvent } from '../DomainEvent.js';
import { IEventHandler } from '../IEventHandler.js';
import { EVENT_TYPES } from '../eventTypes.js';
import { createEvent } from '../createEvent.js';
import { IEventBus } from '../IEventBus.js';

const DONE_STATUSES = new Set(['completed', 'skipped']);

export class ShipmentCompletionHandler implements IEventHandler {
  readonly name = 'shipment.completion';
  readonly eventPatterns = [
    EVENT_TYPES.SHIPMENT_STOP_ARRIVED,
    EVENT_TYPES.SHIPMENT_STOP_COMPLETED,
    EVENT_TYPES.TRACKING_GEOFENCE_ENTERED,
  ];
  readonly options = { concurrency: 3, retryLimit: 3, expireInSeconds: 60 };

  constructor(
    private prisma: PrismaClient,
    private eventBus: IEventBus,
  ) {}

  async handle(event: DomainEvent): Promise<void> {
    try {
      if (event.type === EVENT_TYPES.SHIPMENT_STOP_ARRIVED) {
        await this.handleStopArrived(event);
      } else if (event.type === EVENT_TYPES.SHIPMENT_STOP_COMPLETED) {
        await this.handleStopCompleted(event);
      } else if (event.type === EVENT_TYPES.TRACKING_GEOFENCE_ENTERED) {
        await this.handleGeofenceEntered(event);
      }
    } catch (err) {
      console.error(`[ShipmentCompletionHandler] Error processing ${event.type}:`, (err as Error).message);
    }
  }

  private async handleStopArrived(event: DomainEvent): Promise<void> {
    const payload = event.payload as {
      stopId?: string;
      shipmentId?: string;
    };

    const shipmentId = payload.shipmentId;
    if (!shipmentId) return;

    await this.checkAndCompleteShipment(shipmentId, event.orgId, arrivedAt(event));
  }

  /**
   * A completed stop can finish the shipment. When it is the final stop and earlier stops are still
   * open, nothing completes: an exception is raised instead, so someone visits or skips them, or
   * completes the shipment by hand.
   */
  private async handleStopCompleted(event: DomainEvent): Promise<void> {
    const payload = event.payload as { stopId?: string; shipmentId?: string };
    const shipmentId = payload.shipmentId ?? event.entityId;
    if (!shipmentId) return;

    const completed = await this.checkAndCompleteShipment(shipmentId, event.orgId, arrivedAt(event));
    if (!completed && payload.stopId) {
      await this.flagUnvisitedStops(shipmentId, event.orgId, payload.stopId);
    }
  }

  private async flagUnvisitedStops(shipmentId: string, orgId: string, completedStopId: string): Promise<void> {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId, orgId },
      select: { reference: true, status: true, stops: { select: { id: true, sequenceNumber: true, status: true }, orderBy: { sequenceNumber: 'desc' } } },
    });
    if (!shipment || shipment.status !== 'in_progress') return;
    const [finalStop] = shipment.stops;
    if (finalStop?.id !== completedStopId) return;

    const unvisited = shipment.stops.filter((s) => !DONE_STATUSES.has(s.status)).map((s) => s.id);
    if (unvisited.length === 0) return;

    await this.eventBus.publish(createEvent({
      type: EVENT_TYPES.SHIPMENT_EXCEPTION,
      orgId,
      actorId: 'system',
      entityType: 'shipment',
      entityId: shipmentId,
      payload: {
        shipmentReference: shipment.reference,
        exceptionType: 'stops_not_visited',
        description: `Reached the final stop with ${unvisited.length} stop(s) not visited`,
        stopIds: unvisited,
      },
      source: 'completion_handler',
    }));
  }

  private async handleGeofenceEntered(event: DomainEvent): Promise<void> {
    // Geofence entered events have the shipmentId as the entity
    const shipmentId = event.entityId;
    if (!shipmentId) return;

    await this.checkAndCompleteShipment(shipmentId, event.orgId, arrivedAt(event));
  }

  /** Returns true when this call moved the shipment to complete. */
  private async checkAndCompleteShipment(shipmentId: string, orgId: string, deliveredAt: Date): Promise<boolean> {
    // Load the shipment with its stops
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId, orgId },
      select: {
        id: true,
        reference: true,
        status: true,
        destinationId: true,
        stops: {
          select: {
            id: true,
            locationId: true,
            sequenceNumber: true,
            status: true,
            stopType: true,
          },
          orderBy: { sequenceNumber: 'desc' },
        },
      },
    });

    if (!shipment) return false;

    // Only process shipments that are actively in progress
    if (!['in_progress'].includes(shipment.status)) return false;

    // BUSINESS RULE (#324): a shipment is delivered once every stop is completed or skipped, not
    // when the destination alone is reached. Stop order isn't enforced, so this holds whichever
    // stop happens to be the last one done.
    if (shipment.stops.length === 0 || !shipment.stops.every((s) => DONE_STATUSES.has(s.status))) return false;

    {
      // Transition shipment to delivered. Conditioned on still being
      // in_progress: this handler is subscribed to both
      // shipment.stop_arrived and tracking.geofence_entered, and a single
      // destination arrival now emits both (#283) — an unconditional update
      // here would let two concurrent deliveries both "win" the transition
      // and double-publish SHIPMENT_DELIVERED/STATUS_CHANGED.
      const previousStatus = shipment.status;
      const { count } = await this.prisma.shipment.updateMany({
        where: { id: shipmentId, status: 'in_progress' },
        data: {
          status: 'complete',
          deliveryDate: deliveredAt,
        },
      });
      if (count === 0) return false;

      // Publish shipment.delivered event
      const deliveredEvent = createEvent({
        type: EVENT_TYPES.SHIPMENT_DELIVERED,
        orgId,
        actorId: 'system',
        entityType: 'shipment',
        entityId: shipmentId,
        payload: {
          shipmentReference: shipment.reference,
          deliveredAt: deliveredAt.toISOString(),
          eventTime: deliveredAt.toISOString(),
        },
        source: 'completion_handler',
      });

      await this.eventBus.publish(deliveredEvent);

      // Also publish status_changed for consistency
      const statusEvent = createEvent({
        type: EVENT_TYPES.SHIPMENT_STATUS_CHANGED,
        orgId,
        actorId: 'system',
        entityType: 'shipment',
        entityId: shipmentId,
        payload: {
          previousStatus,
          newStatus: 'complete',
          shipmentReference: shipment.reference,
          eventTime: deliveredAt.toISOString(),
        },
        source: 'completion_handler',
      });

      await this.eventBus.publish(statusEvent);

      console.log('[ShipmentCompletionHandler] Auto-completed shipment: every stop done', { shipmentId, orgId });
      return true;
    }
  }
}

/**
 * When the destination was actually reached: the device time carried by the arrival event, so a
 * delayed ping doesn't move the delivery date. Falls back to the event's own timestamp.
 */
function arrivedAt(event: DomainEvent): Date {
  const eventTime = (event.payload as { eventTime?: unknown } | undefined)?.eventTime;
  const deviceTime = typeof eventTime === 'string' ? new Date(eventTime) : null;
  return deviceTime && !Number.isNaN(deviceTime.getTime()) ? deviceTime : new Date(event.timestamp);
}
