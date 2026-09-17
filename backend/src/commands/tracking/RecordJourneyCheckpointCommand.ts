import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES, JourneyLocationEventPayload } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';
import { JOURNEY_CHECKPOINT_SEGMENTS } from '../../services/routing/RouteProgressService.js';

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
}

export const RECORD_JOURNEY_CHECKPOINT = 'tracking.record_journey_checkpoint';

/**
 * Records an in-transit checkpoint reached along a shipment's planned route.
 * Idempotent: only proceeds if checkpointIndex is greater than the highest
 * already recorded for the shipment (re-read inside the transaction), backed
 * by a unique(shipmentId, checkpointIndex) constraint against races.
 */
export class RecordJourneyCheckpointCommandHandler extends BaseCommandHandler<RecordJourneyCheckpointPayload, { recorded: boolean }> {
  readonly commandType = RECORD_JOURNEY_CHECKPOINT;
  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) { super(prisma, eventBus); }

  protected async handle(command: Command<RecordJourneyCheckpointPayload>, tx: TransactionClient, emit: EmitFn) {
    const {
      shipmentId, stopId, locationId, lat, lng, eventTime,
      checkpointIndex, distanceAlongRouteMeters, fractionComplete,
    } = command.payload;

    const latest = await tx.shipmentJourneyCheckpoint.findFirst({
      where: { shipmentId, orgId: command.orgId },
      orderBy: { checkpointIndex: 'desc' },
    });
    if (latest && latest.checkpointIndex >= checkpointIndex) return { recorded: false };

    await tx.shipmentJourneyCheckpoint.create({
      data: {
        shipmentId,
        orgId: command.orgId,
        checkpointIndex,
        lat,
        lng,
        distanceAlongRouteMeters,
        fractionComplete,
        eventTime: new Date(eventTime),
      },
    });

    const payload: JourneyLocationEventPayload = {
      shipmentId, stopId, locationId, lat, lng, eventTime,
      checkpointIndex, totalCheckpoints: JOURNEY_CHECKPOINT_SEGMENTS,
    };

    emit(this.createEvent(command, {
      type: EVENT_TYPES.TRACKING_JOURNEY_CHECKPOINT,
      entityType: 'shipment',
      entityId: shipmentId,
      payload,
    }));

    return { recorded: true };
  }
}
