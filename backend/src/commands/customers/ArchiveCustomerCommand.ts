import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export const ARCHIVE_CUSTOMER = 'customer.archive';

export class ArchiveCustomerCommandHandler extends BaseCommandHandler<{ id: string }, { id: string }> {
  readonly commandType = ARCHIVE_CUSTOMER;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<{ id: string }>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string }> {
    const { id } = command.payload;
    const customer = await tx.customer.update({
      where: { id },
      data: { archived: true, archivedAt: new Date() },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.CUSTOMER_ARCHIVED,
      entityType: 'customer',
      entityId: id,
      payload: { name: customer.name },
    }));

    return { id };
  }
}
