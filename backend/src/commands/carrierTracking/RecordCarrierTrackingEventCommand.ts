import { Prisma, PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface RecordCarrierTrackingEventPayload {
  shipmentId: string;
  carrierId: string;
  integrationId: string;
  providerType: string;
  trackingNumber: string;
  status: string;
  statusDetail?: string;
  statusCode?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  lat?: number;
  lng?: number;
  occurredAt: string; // ISO-8601
  estimatedDelivery?: string; // ISO-8601
  signedBy?: string;
  rawPayload?: Record<string, unknown>;
  source: string; // webhook, poll, manual
}

export const RECORD_CARRIER_TRACKING_EVENT = 'carrier_tracking_event.record';

export class RecordCarrierTrackingEventCommandHandler extends BaseCommandHandler<
  RecordCarrierTrackingEventPayload,
  { id: string; status: string }
> {
  readonly commandType = RECORD_CARRIER_TRACKING_EVENT;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<RecordCarrierTrackingEventPayload>,
    tx: TransactionClient,
    emit: EmitFn,
  ): Promise<{ id: string; status: string }> {
    const p = command.payload;

    const trackingEvent = await tx.carrierTrackingEvent.create({
      data: {
        shipmentId: p.shipmentId,
        carrierId: p.carrierId,
        integrationId: p.integrationId,
        providerType: p.providerType,
        trackingNumber: p.trackingNumber,
        status: p.status,
        statusDetail: p.statusDetail ?? null,
        statusCode: p.statusCode ?? null,
        city: p.city ?? null,
        state: p.state ?? null,
        country: p.country ?? null,
        postalCode: p.postalCode ?? null,
        lat: p.lat ?? null,
        lng: p.lng ?? null,
        occurredAt: new Date(p.occurredAt),
        estimatedDelivery: p.estimatedDelivery ? new Date(p.estimatedDelivery) : null,
        signedBy: p.signedBy ?? null,
        rawPayload: p.rawPayload ? (p.rawPayload as Prisma.InputJsonValue) : undefined,
        source: p.source,
      },
    });

    // Always emit the update received event
    emit(this.createEvent(command, {
      type: EVENT_TYPES.CARRIER_TRACKING_UPDATE_RECEIVED,
      entityType: 'carrier_tracking_event',
      entityId: trackingEvent.id,
      payload: {
        shipmentId: p.shipmentId,
        carrierId: p.carrierId,
        trackingNumber: p.trackingNumber,
        status: p.status,
        statusDetail: p.statusDetail,
        providerType: p.providerType,
        source: p.source,
        occurredAt: p.occurredAt,
      },
    }));

    // Emit delivered event if status is delivered
    if (p.status === 'delivered') {
      emit(this.createEvent(command, {
        type: EVENT_TYPES.CARRIER_TRACKING_DELIVERED,
        entityType: 'carrier_tracking_event',
        entityId: trackingEvent.id,
        payload: {
          shipmentId: p.shipmentId,
          carrierId: p.carrierId,
          trackingNumber: p.trackingNumber,
          providerType: p.providerType,
          occurredAt: p.occurredAt,
          signedBy: p.signedBy,
          estimatedDelivery: p.estimatedDelivery,
        },
      }));
    }

    // Emit exception event if status is exception
    if (p.status === 'exception') {
      emit(this.createEvent(command, {
        type: EVENT_TYPES.CARRIER_TRACKING_EXCEPTION,
        entityType: 'carrier_tracking_event',
        entityId: trackingEvent.id,
        payload: {
          shipmentId: p.shipmentId,
          carrierId: p.carrierId,
          trackingNumber: p.trackingNumber,
          providerType: p.providerType,
          statusDetail: p.statusDetail,
          occurredAt: p.occurredAt,
        },
      }));
    }

    return { id: trackingEvent.id, status: trackingEvent.status };
  }
}
