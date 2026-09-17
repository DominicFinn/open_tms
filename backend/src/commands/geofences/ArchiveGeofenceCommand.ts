import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface ArchiveGeofencePayload {
  geofenceId: string;
}

export const ARCHIVE_GEOFENCE = 'geofence.archive';

export class ArchiveGeofenceCommandHandler extends BaseCommandHandler<
  ArchiveGeofencePayload,
  { id: string }
> {
  readonly commandType = ARCHIVE_GEOFENCE;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<ArchiveGeofencePayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string }> {
    const { geofenceId } = command.payload;

    const existing = await tx.geofence.findFirst({
      where: { id: geofenceId, orgId: command.orgId },
      select: { id: true, active: true },
    });
    if (!existing) throw new Error(`Geofence ${geofenceId} not found`);
    if (!existing.active) return { id: existing.id };

    await tx.geofence.update({
      where: { id: geofenceId },
      data: { active: false, archivedAt: new Date() },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.GEOFENCE_ARCHIVED,
      entityType: 'geofence',
      entityId: geofenceId,
      payload: {},
    }));

    return { id: geofenceId };
  }
}
