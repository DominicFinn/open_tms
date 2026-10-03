import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES, JourneyLocationEventPayload } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';
import { JOURNEY_CHECKPOINT_SEGMENTS, PassedCheckpoint } from '../../services/routing/RouteProgressService.js';

export interface RecordJourneyCheckpointPayload {
  shipmentId: string;
  /** Destination stop this checkpoint is en route to (for the shared payload shape). */
  stopId: string;
  locationId: string;
  lat: number;
  lng: number;
  eventTime: string;
  checkpointIndex: number;
  distanceAlongRouteMeters: number;
  fractionComplete: number;
  /** Planned-route positions of the checkpoints before this one, for filling in any skipped. */
  passed?: PassedCheckpoint[];
}

export const RECORD_JOURNEY_CHECKPOINT = 'tracking.record_journey_checkpoint';

interface CheckpointRow extends PassedCheckpoint {
  eventTime: Date;
  inferred: boolean;
}

/**
 * Records an in-transit checkpoint reached along a shipment's planned route, plus any earlier
 * checkpoints the shipment passed since the last one recorded (sparse pings can jump several).
 *
 * BUSINESS RULE: a filled-in checkpoint takes its position from the planned route and its time by
 * interpolating, by distance, between an anchor and this ping. The anchor is the last recorded
 * checkpoint or, before the first one, the origin departure (distance 0). With neither, it takes
 * this ping's time.
 *
 * Idempotent: only indices greater than the highest already recorded for the shipment are written
 * (re-read inside the transaction), backed by a unique(shipmentId, checkpointIndex) constraint
 * against races.
 */
export class RecordJourneyCheckpointCommandHandler extends BaseCommandHandler<RecordJourneyCheckpointPayload, { recorded: boolean }> {
  readonly commandType = RECORD_JOURNEY_CHECKPOINT;
  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) { super(prisma, eventBus); }

  protected async handle(command: Command<RecordJourneyCheckpointPayload>, tx: TransactionClient, emit: EmitFn) {
    const { shipmentId, stopId, locationId, checkpointIndex } = command.payload;

    const latest = await tx.shipmentJourneyCheckpoint.findFirst({
      where: { shipmentId, orgId: command.orgId },
      orderBy: { checkpointIndex: 'desc' },
    });
    if (latest && latest.checkpointIndex >= checkpointIndex) return { recorded: false };

    const anchor = latest ?? await originDeparture(tx, command.orgId, shipmentId);
    const rows = checkpointRows(command.payload, latest?.checkpointIndex ?? 0, anchor);
    for (const row of rows) {
      await tx.shipmentJourneyCheckpoint.create({
        data: {
          shipmentId,
          orgId: command.orgId,
          checkpointIndex: row.checkpointIndex,
          lat: row.lat,
          lng: row.lng,
          distanceAlongRouteMeters: row.distanceAlongRouteMeters,
          fractionComplete: row.fractionComplete,
          eventTime: row.eventTime,
        },
      });

      const payload: JourneyLocationEventPayload = {
        shipmentId, stopId, locationId,
        lat: row.lat, lng: row.lng, eventTime: row.eventTime.toISOString(),
        checkpointIndex: row.checkpointIndex, totalCheckpoints: JOURNEY_CHECKPOINT_SEGMENTS,
        ...(row.inferred ? { inferred: true } : {}),
      };

      emit(this.createEvent(command, {
        type: EVENT_TYPES.TRACKING_JOURNEY_CHECKPOINT,
        entityType: 'shipment',
        entityId: shipmentId,
        payload,
      }));
    }

    return { recorded: true };
  }
}

interface TimeAnchor {
  distanceAlongRouteMeters: number;
  eventTime: Date;
}

/** The shipment's first recorded departure, as the start of the route (distance 0). */
async function originDeparture(tx: TransactionClient, orgId: string, shipmentId: string): Promise<TimeAnchor | null> {
  const stop = await tx.shipmentStop.findFirst({
    where: { shipmentId, shipment: { orgId }, actualDeparture: { not: null } },
    orderBy: { sequenceNumber: 'asc' },
    select: { actualDeparture: true },
  });
  return stop?.actualDeparture ? { distanceAlongRouteMeters: 0, eventTime: stop.actualDeparture } : null;
}

function checkpointRows(
  payload: RecordJourneyCheckpointPayload,
  afterIndex: number,
  anchor: TimeAnchor | null,
): CheckpointRow[] {
  const reachedAt = new Date(payload.eventTime);

  const filled = (payload.passed ?? [])
    .filter((p) => p.checkpointIndex > afterIndex && p.checkpointIndex < payload.checkpointIndex)
    .sort((a, b) => a.checkpointIndex - b.checkpointIndex)
    .map((p) => ({ ...p, eventTime: interpolateTime(p.distanceAlongRouteMeters, anchor, payload.distanceAlongRouteMeters, reachedAt), inferred: true }));

  return [
    ...filled,
    {
      checkpointIndex: payload.checkpointIndex,
      lat: payload.lat,
      lng: payload.lng,
      distanceAlongRouteMeters: payload.distanceAlongRouteMeters,
      fractionComplete: payload.fractionComplete,
      eventTime: reachedAt,
      inferred: false,
    },
  ];
}

function interpolateTime(
  distance: number,
  from: TimeAnchor | null,
  toDistance: number,
  toTime: Date,
): Date {
  if (!from || toDistance <= from.distanceAlongRouteMeters || from.eventTime >= toTime) return toTime;
  const ratio = Math.min(1, Math.max(0, (distance - from.distanceAlongRouteMeters) / (toDistance - from.distanceAlongRouteMeters)));
  return new Date(from.eventTime.getTime() + ratio * (toTime.getTime() - from.eventTime.getTime()));
}
