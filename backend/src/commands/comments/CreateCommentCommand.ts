import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface CreateCommentPayload {
  entityType: string;
  entityId: string;
  body: string;
  authorId: string | null;
  authorName: string;
  authorType: string;
  visibleToCustomer?: boolean;
}

export interface CreateCommentResult {
  id: string;
  orgId: string;
  entityType: string;
  entityId: string;
  body: string;
  authorId: string | null;
  authorName: string;
  authorType: string;
  visibleToCustomer: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const CREATE_COMMENT = 'comment.create';

export class CreateCommentCommandHandler extends BaseCommandHandler<CreateCommentPayload, CreateCommentResult> {
  readonly commandType = CREATE_COMMENT;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<CreateCommentPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<CreateCommentResult> {
    const { entityType, entityId, body, authorId, authorName, authorType } = command.payload;
    // Customer-authored comments are always visible to the customer who wrote them.
    // Internal user/agent/system comments default to false unless explicitly opted in.
    const visibleToCustomer = authorType === 'customer'
      ? true
      : command.payload.visibleToCustomer === true;

    const comment = await tx.comment.create({
      data: {
        orgId: command.orgId,
        entityType,
        entityId,
        authorId,
        authorName,
        authorType,
        body,
        visibleToCustomer,
      },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.COMMENT_ADDED,
      entityType,
      entityId,
      payload: {
        commentId: comment.id,
        body,
        authorId,
        authorName,
        authorType,
        visibleToCustomer,
      },
    }));

    return {
      id: comment.id,
      orgId: comment.orgId,
      entityType: comment.entityType,
      entityId: comment.entityId,
      body: comment.body,
      authorId: comment.authorId,
      authorName: comment.authorName,
      authorType: comment.authorType,
      visibleToCustomer: comment.visibleToCustomer,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    };
  }
}
