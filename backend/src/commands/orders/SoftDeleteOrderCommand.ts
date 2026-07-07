import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface SoftDeleteOrderPayload {
  id: string;
}

export const SOFT_DELETE_ORDER = 'order.soft_delete';

/**
 * Admin-only soft delete. Distinct from archive: the row is retained for audit
 * (deletedAt/deletedBy tombstone) but hidden from every view. Idempotent —
 * re-deleting an already-deleted order is a no-op.
 *
 * Emits ORDER_DELETED, which removes the order from the read model.
 */
export class SoftDeleteOrderCommandHandler extends BaseCommandHandler<SoftDeleteOrderPayload, { id: string; alreadyDeleted?: boolean }> {
  readonly commandType = SOFT_DELETE_ORDER;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<SoftDeleteOrderPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string; alreadyDeleted?: boolean }> {
    const { id } = command.payload;

    const existing = await tx.order.findFirstOrThrow({ where: { id } });
    if (existing.deletedAt) {
      return { id, alreadyDeleted: true };
    }

    const order = await tx.order.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: command.actorId ?? null },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.ORDER_DELETED,
      entityType: 'order',
      entityId: id,
      payload: { orderReference: order.orderNumber, softDelete: true },
    }));

    return { id };
  }
}
