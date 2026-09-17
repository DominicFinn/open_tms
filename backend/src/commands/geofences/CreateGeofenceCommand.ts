import { PrismaClient, Prisma } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

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

    const geofence = await tx.geofence.create({
      data: {
        orgId: command.orgId,
        entityType,
        entityId,
        name,
        shapeType,
        geometry: geometry as unknown as Prisma.InputJsonValue,
      },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.GEOFENCE_CREATED,
      entityType: 'geofence',
      entityId: geofence.id,
      payload: { entityType, entityId, shapeType },
    }));

    return { id: geofence.id };
  }
}
