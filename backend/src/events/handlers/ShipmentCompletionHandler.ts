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

export class ShipmentCompletionHandler implements IEventHandler {
  readonly name = 'shipment.completion';
  readonly eventPatterns = [
    EVENT_TYPES.SHIPMENT_STOP_ARRIVED,
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

    await this.checkAndCompleteShipment(shipmentId, event.orgId);
  }

  private async handleGeofenceEntered(event: DomainEvent): Promise<void> {
    // Geofence entered events have the shipmentId as the entity
    const shipmentId = event.entityId;
    if (!shipmentId) return;

    await this.checkAndCompleteShipment(shipmentId, event.orgId);
  }

  private async checkAndCompleteShipment(shipmentId: string, orgId: string): Promise<void> {
    // Load the shipment with its stops
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
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

    if (!shipment) return;

    // Only process shipments that are in transit or dispatched
    if (!['in_transit', 'dispatched'].includes(shipment.status)) return;

    // Check if the final stop (destination) has been arrived at
    // Final stop = highest sequence number, or the stop at the destination location
    const finalStop = shipment.stops.find((s) => s.locationId === shipment.destinationId)
      || shipment.stops[0]; // Highest sequence number (sorted desc)

    if (!finalStop) return;

    // If the final stop is arrived or completed, mark shipment as delivered
    if (['arrived', 'in_progress', 'completed'].includes(finalStop.status)) {
      // Transition shipment to delivered
      const previousStatus = shipment.status;
      await this.prisma.shipment.update({
        where: { id: shipmentId },
        data: {
          status: 'delivered',
          deliveryDate: new Date(),
        },
      });

      // Publish shipment.delivered event
      const deliveredEvent = createEvent({
        type: EVENT_TYPES.SHIPMENT_DELIVERED,
        orgId,
        actorId: 'system',
        entityType: 'shipment',
        entityId: shipmentId,
        payload: {
          shipmentReference: shipment.reference,
          deliveredAt: new Date().toISOString(),
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
          newStatus: 'delivered',
          shipmentReference: shipment.reference,
        },
        source: 'completion_handler',
      });

      await this.eventBus.publish(statusEvent);

      console.log(`[ShipmentCompletionHandler] Auto-completed shipment ${shipment.reference} — destination arrival criteria met`);
    }
  }
}
