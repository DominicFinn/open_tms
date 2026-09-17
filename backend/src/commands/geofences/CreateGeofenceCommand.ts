import { randomUUID } from 'crypto';
import { PrismaClient, Prisma } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';
import { GEOFENCE_ENTITY_NOT_FOUND, GEOFENCE_CONCURRENT_WRITE } from './errors.js';

export interface CreateGeofencePayload {
  entityType: string;
  entityId: string;
  name?: string;
  shapeType: 'radial' | 'polygon';
  geometry: Record<string, unknown>;
}

export const CREATE_GEOFENCE = 'geofence.create';

export class CreateGeofenceCommandHandler extends BaseCommandHandler<
  CreateGeofencePayload,
  { id: string }
> {
  readonly commandType = CREATE_GEOFENCE;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<CreateGeofencePayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string }> {
    const { entityType, entityId, name, shapeType, geometry } = command.payload;
    if (!command.orgId) {
      throw new Error('orgId is required to create a Geofence (multi-tenancy)');
    }

    // "location" is the only entityType with UI/wiring today (see routes/geofences.ts, which
    // whitelists it at the schema level). Confirm the target actually exists in this org before
    // attaching a geofence to it — a stale or cross-tenant id must read as not found.
    if (entityType === 'location') {
      const location = await tx.location.findFirst({
        where: { id: entityId, orgId: command.orgId },
        select: { id: true },
      });
      if (!location) throw new Error(GEOFENCE_ENTITY_NOT_FOUND);
    }

    // BUSINESS RULE: at most one active geofence per entity, enforced for real by a partial
    // unique DB index (migration 20260917120000_geofence_one_active_per_entity) — this
    // check-and-archive only handles the common sequential case (re-drawing a location's
    // geofence archives the old one before the new one is created). Under genuine concurrent
    // creates for the same entity, the index still wins: the loser gets a unique-constraint
    // error below, caught and surfaced as GEOFENCE_CONCURRENT_WRITE rather than a raw Prisma
    // error — which is exactly the class of bug (two active geofences on one entity) that
    // motivated this constraint in the first place.
    const superseded = await tx.geofence.findMany({
      where: { orgId: command.orgId, entityType, entityId, active: true },
      select: { id: true },
    });

    const newId = randomUUID();
    if (superseded.length > 0) {
      await tx.geofence.updateMany({
        where: { id: { in: superseded.map((g) => g.id) } },
        data: { active: false, archivedAt: new Date() },
      });
      for (const { id } of superseded) {
        emit(this.createEvent(command, {
          type: EVENT_TYPES.GEOFENCE_ARCHIVED,
          entityType: 'geofence',
          entityId: id,
          payload: { supersededBy: newId },
        }));
      }
    }

    let geofence;
    try {
      geofence = await tx.geofence.create({
        data: {
          id: newId,
          orgId: command.orgId,
          entityType,
          entityId,
          name,
          shapeType,
          geometry: geometry as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new Error(GEOFENCE_CONCURRENT_WRITE);
      }
      throw err;
    }

    emit(this.createEvent(command, {
      type: EVENT_TYPES.GEOFENCE_CREATED,
      entityType: 'geofence',
      entityId: geofence.id,
      payload: { entityType, entityId, shapeType },
    }));

    return { id: geofence.id };
  }
}
