import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface UnarchiveOrderPayload {
  id: string;
}

export const UNARCHIVE_ORDER = 'order.unarchive';

/**
 * Restore an archived order. Clears archived/archivedAt and restores `status`
 * to whatever it was before archiving (captured in `statusBeforeArchive` by
 * ArchiveOrderCommand) rather than guessing a default — an order archived
 * while `converted` must not come back as `pending`, or it would look
 * eligible for re-conversion to a second shipment.
 *
 * Emits ORDER_UNARCHIVED, which re-inserts the order into the read model so
 * it reappears in active lists. Idempotent — unarchiving a non-archived order
 * is a no-op.
 */
export class UnarchiveOrderCommandHandler extends BaseCommandHandler<UnarchiveOrderPayload, { id: string; notArchived?: boolean }> {
  readonly commandType = UNARCHIVE_ORDER;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<UnarchiveOrderPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string; notArchived?: boolean }> {
    const { id } = command.payload;

    const existing = await tx.order.findFirstOrThrow({ where: { id, deletedAt: null } });
    if (!existing.archived) {
      return { id, notArchived: true };
    }

    const order = await tx.order.update({
      where: { id },
      data: {
        archived: false,
        archivedAt: null,
        status: existing.statusBeforeArchive ?? 'pending',
        statusBeforeArchive: null,
      },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.ORDER_UNARCHIVED,
      entityType: 'order',
      entityId: id,
      payload: { orderReference: order.orderNumber },
    }));

    return { id };
  }
}
