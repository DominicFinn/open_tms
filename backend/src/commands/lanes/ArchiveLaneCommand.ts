import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export const ARCHIVE_LANE = 'lane.archive';

export class ArchiveLaneCommandHandler extends BaseCommandHandler<{ id: string }, { id: string }> {
  readonly commandType = ARCHIVE_LANE;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<{ id: string }>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string }> {
    const { id } = command.payload;
    const lane = await tx.lane.update({
      where: { id },
      data: { archived: true, archivedAt: new Date() },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.LANE_ARCHIVED,
      entityType: 'lane',
      entityId: id,
      payload: { name: lane.name },
    }));

    return { id };
  }
}
