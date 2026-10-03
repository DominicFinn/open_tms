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
  /**
   * True for every stop except the origin pickup. BUSINESS RULE (#324): entering a delivery stop's
   * geofence completes it (middle stops and destination alike); the origin only arrives here and
   * completes on departure. A refusal afterwards is raised as an exception, not undone here.
   */
  completesStop: boolean;
  /** External id of the device whose ping matched. */
  deviceId?: string;
}

export const RECORD_GEOFENCE_ARRIVAL = 'tracking.record_geofence_arrival';

/**
 * Records a device entering a stop's geofence: the origin becomes `arrived`, any other stop
 * `completed`. Only a `pending` stop is touched, so a repeat ping inside the same geofence is a
 * no-op, and a later visit to the same location is a different stop.
 */
export class RecordGeofenceArrivalCommandHandler extends BaseCommandHandler<RecordGeofenceArrivalPayload, { arrived: boolean }> {
  readonly commandType = RECORD_GEOFENCE_ARRIVAL;
  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) { super(prisma, eventBus); }

  protected async handle(command: Command<RecordGeofenceArrivalPayload>, tx: TransactionClient, emit: EmitFn) {
    const { shipmentId, stopId, locationId, lat, lng, eventTime, completesStop, deviceId } = command.payload;

    const stop = await tx.shipmentStop.findUnique({ where: { id: stopId, shipment: { orgId: command.orgId } } });
    if (!stop || stop.status !== 'pending') return { arrived: false };

    await tx.shipmentStop.update({
      where: { id: stopId, shipment: { orgId: command.orgId } },
      data: { status: completesStop ? 'completed' : 'arrived', actualArrival: new Date(eventTime) },
    });

    const payload: JourneyLocationEventPayload = { shipmentId, stopId, locationId, lat, lng, eventTime, deviceId };

    emit(this.createEvent(command, {
      type: EVENT_TYPES.TRACKING_GEOFENCE_ENTERED,
      entityType: 'shipment',
      entityId: shipmentId,
      payload,
    }));

    // Arrive-then-complete, the same pair EDI 214 sends: SLA evaluation opens stop-level SLAs on
    // arrival and meets them on completion, and the timeline labels each by the stop's position.
    emit(this.createEvent(command, {
      type: EVENT_TYPES.SHIPMENT_STOP_ARRIVED,
      entityType: 'shipment',
      entityId: shipmentId,
      payload: { stopId, shipmentId, eventTime },
    }));
    if (completesStop) {
      emit(this.createEvent(command, {
        type: EVENT_TYPES.SHIPMENT_STOP_COMPLETED,
        entityType: 'shipment',
        entityId: shipmentId,
        payload: { stopId, shipmentId, eventTime },
      }));
    }

    return { arrived: true };
  }
}
