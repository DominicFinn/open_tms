import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export const UPDATE_LOCATION = 'location.update';

export class UpdateLocationCommandHandler extends BaseCommandHandler<{ id: string; data: Record<string, unknown> }, { id: string }> {
  readonly commandType = UPDATE_LOCATION;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<{ id: string; data: Record<string, unknown> }>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string }> {
    const { id, data } = command.payload;
    const updated = await tx.location.update({ where: { id }, data: data as any });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.LOCATION_UPDATED,
      entityType: 'location',
      entityId: id,
      payload: { name: updated.name, city: updated.city, changes: Object.keys(data) },
    }));

    return { id };
  }
}
