/**
 * ShipmentTimelineProjection — materializes shipment domain events into
 * ShipmentEvent rows so the shipment detail "Events" tab shows a read-only,
 * platform-generated timeline.
 *
 * Subscribes to shipment.* and writes one ShipmentEvent per mapped event,
 * deduped on sourceEventId (pg-boss may redeliver). Unmapped shipment.* types
 * (e.g. cutoff_*) are skipped. IoT/EDI writers populate their own rows
 * independently — this projection only handles domain events.
 */

import { PrismaClient } from '@prisma/client';
import { DomainEvent } from '../DomainEvent.js';
import { IEventHandler } from '../IEventHandler.js';
import { SubscribeOptions } from '../IEventBus.js';

type TxOrPrisma = Pick<PrismaClient, 'shipmentEvent' | 'shipmentStop'>;

export interface TimelineRowInput {
  shipmentId: string;
  eventType: string;
  description: string;
  source: string;
  eventTime: Date;
  address: string | null;
  sourceEventId: string;
}

/** Classify a stop as the route's origin, destination, or an intermediate waypoint. */
async function classifyStop(
  prisma: TxOrPrisma,
  shipmentId: string,
  stopId: string | undefined
): Promise<'origin' | 'destination' | 'waypoint' | null> {
  if (!stopId) return null;
  const stop = await prisma.shipmentStop.findUnique({
    where: { id: stopId },
    select: { sequenceNumber: true, shipmentId: true },
  });
  if (!stop || stop.shipmentId !== shipmentId) return null;
  const agg = await prisma.shipmentStop.aggregate({
    where: { shipmentId },
    _min: { sequenceNumber: true },
    _max: { sequenceNumber: true },
  });
  const min = agg._min.sequenceNumber;
  const max = agg._max.sequenceNumber;
  if (stop.sequenceNumber === max) return 'destination';
  if (stop.sequenceNumber === min) return 'origin';
  return 'waypoint';
}

/**
 * Map a shipment domain event to a timeline row, or null if it isn't part of
 * the curated timeline taxonomy. Shared by the projection and the backfill.
 */
export async function buildTimelineRow(
  prisma: TxOrPrisma,
  event: DomainEvent
): Promise<TimelineRowInput | null> {
  const payload = (event.payload ?? {}) as Record<string, any>;
  const base = {
    shipmentId: event.entityId,
    source: 'system',
    eventTime: new Date(event.timestamp),
    address: (payload.location as string) || null,
    sourceEventId: event.id,
  };

  switch (event.type) {
    case 'shipment.created':
      return { ...base, eventType: 'created', description: 'Shipment created' };
    case 'shipment.updated':
      return { ...base, eventType: 'updated', description: 'Shipment updated' };
    case 'shipment.status_changed':
      return {
        ...base,
        eventType: 'status_changed',
        description: `Status changed from ${payload.previousStatus ?? '?'} to ${payload.newStatus ?? '?'}`,
      };
    case 'shipment.carrier_assigned':
      return { ...base, eventType: 'carrier_assigned', description: 'Carrier assigned' };
    case 'shipment.exception':
      return {
        ...base,
        eventType: 'exception',
        description: `Exception: ${payload.reason || payload.description || payload.exceptionType || 'unknown'}`,
      };
    case 'shipment.delivered':
      return { ...base, eventType: 'delivered', description: 'Delivered' };
    case 'shipment.archived':
      return { ...base, eventType: 'archived', description: 'Shipment archived' };
    case 'shipment.unarchived':
      return { ...base, eventType: 'unarchived', description: 'Shipment restored' };
    case 'shipment.deleted':
      return { ...base, eventType: 'deleted', description: 'Shipment deleted' };
    case 'shipment.stop_arrived': {
      const kind = await classifyStop(prisma, event.entityId, payload.stopId);
      if (kind === 'destination') return { ...base, eventType: 'enters_destination', description: 'Arrived at destination' };
      if (kind === 'waypoint') return { ...base, eventType: 'entered_waypoint', description: `Entered waypoint${base.address ? ` (${base.address})` : ''}` };
      return null; // arrival at origin is not part of the curated timeline
    }
    case 'shipment.stop_completed': {
      const kind = await classifyStop(prisma, event.entityId, payload.stopId);
      if (kind === 'origin') return { ...base, eventType: 'leaves_origin', description: 'Departed origin' };
      if (kind === 'waypoint') return { ...base, eventType: 'exited_waypoint', description: `Exited waypoint${base.address ? ` (${base.address})` : ''}` };
      return null; // departure from destination is not meaningful
    }
    default:
      return null;
  }
}

export class ShipmentTimelineProjection implements IEventHandler {
  readonly name = 'projection.shipment_timeline';
  readonly eventPatterns = ['shipment.*'];
  readonly options: SubscribeOptions = {
    concurrency: 3,
    priority: 5,
    retryLimit: 5,
    expireInSeconds: 600,
    // Tight poll so a new event appears in the timeline within ~half a second.
    pollingIntervalSeconds: 0.5,
  };

  constructor(private prisma: PrismaClient) {}

  async handle(event: DomainEvent): Promise<void> {
    const row = await buildTimelineRow(this.prisma, event);
    if (!row) return;

    // Idempotency: pg-boss can redeliver — never write the same source event twice.
    const existing = await this.prisma.shipmentEvent.findFirst({
      where: { sourceEventId: row.sourceEventId },
      select: { id: true },
    });
    if (existing) return;

    try {
      await this.prisma.shipmentEvent.create({ data: row });
    } catch (err) {
      console.error(`[ShipmentTimelineProjection] Failed to write timeline event for ${event.type} (${event.id}): ${(err as Error).message}`);
    }
  }
}
