import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface UpdateCommentPayload {
  id: string;
  body: string;
}

export interface UpdateCommentResult {
  id: string;
  entityType: string;
  entityId: string;
  body: string;
  updatedAt: Date;
}

export const UPDATE_COMMENT = 'comment.update';

export class UpdateCommentCommandHandler extends BaseCommandHandler<UpdateCommentPayload, UpdateCommentResult> {
  readonly commandType = UPDATE_COMMENT;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<UpdateCommentPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<UpdateCommentResult> {
    const { id, body } = command.payload;

    const existing = await tx.comment.findUnique({ where: { id } });
    if (!existing) throw new Error('Comment not found');
    if (existing.deletedAt) throw new Error('Comment has been deleted');

    const updated = await tx.comment.update({
      where: { id },
      data: { body },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.COMMENT_UPDATED,
      entityType: existing.entityType,
      entityId: existing.entityId,
      payload: {
        commentId: id,
        body,
      },
    }));

    return {
      id: updated.id,
      entityType: updated.entityType,
      entityId: updated.entityId,
      body: updated.body,
      updatedAt: updated.updatedAt,
    };
  }
}
