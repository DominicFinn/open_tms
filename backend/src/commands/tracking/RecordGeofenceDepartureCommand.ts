import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES, JourneyLocationEventPayload } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface RecordGeofenceDeparturePayload {
  shipmentId: string;
  stopId: string;
  locationId: string;
  lat: number;
  lng: number;
  eventTime: string;
}

export const RECORD_GEOFENCE_DEPARTURE = 'tracking.record_geofence_departure';

/**
 * Records a device leaving a stop's geofence it had previously entered.
 * v1 scope: only evaluated for the origin stop (see ArrivalCriteriaEvaluationService)
 * — this is the "departure" leg of the full-journey proof (#283).
 */
export class RecordGeofenceDepartureCommandHandler extends BaseCommandHandler<RecordGeofenceDeparturePayload, { departed: boolean }> {
  readonly commandType = RECORD_GEOFENCE_DEPARTURE;
  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) { super(prisma, eventBus); }

  protected async handle(command: Command<RecordGeofenceDeparturePayload>, tx: TransactionClient, emit: EmitFn) {
    const { shipmentId, stopId, locationId, lat, lng, eventTime } = command.payload;

    const stop = await tx.shipmentStop.findUnique({ where: { id: stopId, shipment: { orgId: command.orgId } } });
    if (!stop || stop.status !== 'arrived') return { departed: false };

    await tx.shipmentStop.update({
      where: { id: stopId, shipment: { orgId: command.orgId } },
      data: { status: 'completed', actualDeparture: new Date(eventTime) },
    });

    const payload: JourneyLocationEventPayload = { shipmentId, stopId, locationId, lat, lng, eventTime };

    emit(this.createEvent(command, {
      type: EVENT_TYPES.TRACKING_GEOFENCE_EXITED,
      entityType: 'shipment',
      entityId: shipmentId,
      payload,
    }));

    // ShipmentTimelineProjection already maps stop_completed at the origin to
    // "Departed origin" — no projection change needed to surface this.
    emit(this.createEvent(command, {
      type: EVENT_TYPES.SHIPMENT_STOP_COMPLETED,
      entityType: 'shipment',
      entityId: shipmentId,
      payload: { stopId, shipmentId },
    }));

    return { departed: true };
  }
}
