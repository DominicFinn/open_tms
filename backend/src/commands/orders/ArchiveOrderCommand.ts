import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface ArchiveOrderPayload {
  id: string;
}

export const ARCHIVE_ORDER = 'order.archive';

export class ArchiveOrderCommandHandler extends BaseCommandHandler<ArchiveOrderPayload, { id: string }> {
  readonly commandType = ARCHIVE_ORDER;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<ArchiveOrderPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string }> {
    const { id } = command.payload;

    const existing = await tx.order.findFirstOrThrow({ where: { id } });

    const order = await tx.order.update({
      where: { id },
      data: {
        archived: true,
        archivedAt: new Date(),
        status: 'archived',
        statusBeforeArchive: existing.status,
      },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.ORDER_ARCHIVED,
      entityType: 'order',
      entityId: id,
      payload: { orderReference: order.orderNumber },
    }));

    return { id };
  }
}
