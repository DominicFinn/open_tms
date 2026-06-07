import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface DeleteCommentPayload {
  id: string;
}

export interface DeleteCommentResult {
  id: string;
  alreadyDeleted: boolean;
}

export const DELETE_COMMENT = 'comment.delete';

export class DeleteCommentCommandHandler extends BaseCommandHandler<DeleteCommentPayload, DeleteCommentResult> {
  readonly commandType = DELETE_COMMENT;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<DeleteCommentPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<DeleteCommentResult> {
    const { id } = command.payload;

    const existing = await tx.comment.findUnique({ where: { id } });
    if (!existing) throw new Error('Comment not found');
    if (existing.deletedAt) {
      return { id, alreadyDeleted: true };
    }

    await tx.comment.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: command.actorId,
      },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.COMMENT_DELETED,
      entityType: existing.entityType,
      entityId: existing.entityId,
      payload: {
        commentId: id,
        deletedBy: command.actorId,
        softDelete: true,
      },
    }));

    return { id, alreadyDeleted: false };
  }
}
