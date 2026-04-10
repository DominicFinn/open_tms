import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export const ARCHIVE_CARRIER = 'carrier.archive';

export class ArchiveCarrierCommandHandler extends BaseCommandHandler<{ id: string }, { id: string }> {
  readonly commandType = ARCHIVE_CARRIER;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<{ id: string }>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string }> {
    const { id } = command.payload;
    const carrier = await tx.carrier.update({
      where: { id },
      data: { archived: true, archivedAt: new Date() },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.CARRIER_ARCHIVED,
      entityType: 'carrier',
      entityId: id,
      payload: { name: carrier.name },
    }));

    return { id };
  }
}
