import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES, JourneyLocationEventPayload } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface RecordGeofenceArrivalPayload {
  shipmentId: string;
  stopId: string;
  locationId: string;
  /** Absent when the arrival was matched by WiFi/BLE presence rather than GPS. */
  lat?: number;
  lng?: number;
  eventTime: string;
  /** Whether this stop is the shipment's destination (drives SHIPMENT_STOP_ARRIVED). */
  isDestination: boolean;
}

export const RECORD_GEOFENCE_ARRIVAL = 'tracking.record_geofence_arrival';

/**
 * Records a device entering a stop's geofence. Replaces the direct-write
 * ArrivalCriteriaEvaluationService.markStopArrived — this is the leg of the
 * "full journey" proof that reuses the previously-unpublished
 * TRACKING_GEOFENCE_ENTERED event type.
 */
export class RecordGeofenceArrivalCommandHandler extends BaseCommandHandler<RecordGeofenceArrivalPayload, { arrived: boolean }> {
  readonly commandType = RECORD_GEOFENCE_ARRIVAL;
  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) { super(prisma, eventBus); }

  protected async handle(command: Command<RecordGeofenceArrivalPayload>, tx: TransactionClient, emit: EmitFn) {
    const { shipmentId, stopId, locationId, lat, lng, eventTime, isDestination } = command.payload;

    const stop = await tx.shipmentStop.findUnique({ where: { id: stopId, shipment: { orgId: command.orgId } } });
    if (!stop || stop.status !== 'pending') return { arrived: false };

    await tx.shipmentStop.update({
      where: { id: stopId, shipment: { orgId: command.orgId } },
      data: { status: 'arrived', actualArrival: new Date(eventTime) },
    });

    const payload: JourneyLocationEventPayload = { shipmentId, stopId, locationId, lat, lng, eventTime };

    emit(this.createEvent(command, {
      type: EVENT_TYPES.TRACKING_GEOFENCE_ENTERED,
      entityType: 'shipment',
      entityId: shipmentId,
      payload,
    }));

    // Only the destination arrival is part of the curated shipment timeline /
    // completion flow — arrival at an origin or waypoint stop is not.
    if (isDestination) {
      emit(this.createEvent(command, {
        type: EVENT_TYPES.SHIPMENT_STOP_ARRIVED,
        entityType: 'shipment',
        entityId: shipmentId,
        payload: { stopId, shipmentId },
      }));
    }

    return { arrived: true };
  }
}
