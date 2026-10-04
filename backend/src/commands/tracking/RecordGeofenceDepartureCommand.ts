import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES, JourneyLocationEventPayload } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface RecordGeofenceDeparturePayload {
  shipmentId: string;
  stopId: string;
  locationId: string;
  lat?: number;
  lng?: number;
  eventTime: string;
  deviceId?: string;
  /**
   * The vehicle reached a later stop without a ping ever being seen leaving the origin, so the
   * departure is implied. The stop may still be `pending` and its departure time stays unknown.
   */
  inferred?: boolean;
}

export const RECORD_GEOFENCE_DEPARTURE = 'tracking.record_geofence_departure';

/**
 * Records a device leaving the origin stop's geofence, completing the pickup.
 *
 * BUSINESS RULE (#307): departing the origin is when the shipment starts moving, so a `ready`
 * shipment moves to `in_progress` here, forward only. A draft shipment hasn't passed the readiness
 * gate and is left alone; anything already further on is untouched.
 */
export class RecordGeofenceDepartureCommandHandler extends BaseCommandHandler<RecordGeofenceDeparturePayload, { departed: boolean }> {
  readonly commandType = RECORD_GEOFENCE_DEPARTURE;
  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) { super(prisma, eventBus); }

  protected async handle(command: Command<RecordGeofenceDeparturePayload>, tx: TransactionClient, emit: EmitFn) {
    const { shipmentId, stopId, locationId, lat, lng, eventTime, deviceId, inferred } = command.payload;

    const stop = await tx.shipmentStop.findUnique({ where: { id: stopId, shipment: { orgId: command.orgId } } });
    const departable = inferred ? stop?.status === 'pending' || stop?.status === 'arrived' : stop?.status === 'arrived';
    if (!stop || !departable) return { departed: false };

    await tx.shipmentStop.update({
      where: { id: stopId, shipment: { orgId: command.orgId } },
      data: { status: 'completed', actualDeparture: inferred ? null : new Date(eventTime) },
    });

    const payload: JourneyLocationEventPayload = {
      shipmentId, stopId, locationId, lat, lng, eventTime, deviceId, ...(inferred ? { inferred: true } : {}),
    };

    emit(this.createEvent(command, {
      type: EVENT_TYPES.TRACKING_GEOFENCE_EXITED,
      entityType: 'shipment',
      entityId: shipmentId,
      payload,
    }));

    // ShipmentTimelineProjection maps stop_completed at the origin to "Departed origin".
    emit(this.createEvent(command, {
      type: EVENT_TYPES.SHIPMENT_STOP_COMPLETED,
      entityType: 'shipment',
      entityId: shipmentId,
      payload: { stopId, shipmentId, eventTime, ...(inferred ? { inferred: true } : {}) },
    }));

    const shipment = await tx.shipment.findFirst({
      where: { id: shipmentId, orgId: command.orgId },
      select: { status: true, reference: true },
    });
    if (shipment?.status === 'ready') {
      await tx.shipment.update({ where: { id: shipmentId, orgId: command.orgId }, data: { status: 'in_progress' } });
      emit(this.createEvent(command, {
        type: EVENT_TYPES.SHIPMENT_STATUS_CHANGED,
        entityType: 'shipment',
        entityId: shipmentId,
        payload: { previousStatus: 'ready', newStatus: 'in_progress', shipmentReference: shipment.reference, eventTime },
      }));
    }

    return { departed: true };
  }
}
