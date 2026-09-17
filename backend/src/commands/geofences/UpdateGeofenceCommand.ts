import { PrismaClient, Prisma } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface UpdateGeofencePayload {
  geofenceId: string;
  name?: string;
  shapeType?: 'radial' | 'polygon';
  geometry?: Record<string, unknown>;
}

export const UPDATE_GEOFENCE = 'geofence.update';

export class UpdateGeofenceCommandHandler extends BaseCommandHandler<
  UpdateGeofencePayload,
  { id: string }
> {
  readonly commandType = UPDATE_GEOFENCE;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<UpdateGeofencePayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string }> {
    const { geofenceId, name, shapeType, geometry } = command.payload;

    const existing = await tx.geofence.findFirst({
      where: { id: geofenceId, orgId: command.orgId },
      select: { id: true },
    });
    if (!existing) throw new Error(`Geofence ${geofenceId} not found`);

    await tx.geofence.update({
      where: { id: geofenceId },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(shapeType !== undefined ? { shapeType } : {}),
        ...(geometry !== undefined ? { geometry: geometry as unknown as Prisma.InputJsonValue } : {}),
      },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.GEOFENCE_UPDATED,
      entityType: 'geofence',
      entityId: geofenceId,
      payload: { shapeType },
    }));

    return { id: geofenceId };
  }
}
