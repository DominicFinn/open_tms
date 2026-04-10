import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface UpdateIssuePayload {
  id: string;
  data: {
    title?: string;
    description?: string;
    status?: string;
    priority?: string;
    assigneeId?: string;
    assigneeName?: string;
    resolution?: string;
  };
}

export const UPDATE_ISSUE = 'issue.update';

export class UpdateIssueCommandHandler extends BaseCommandHandler<UpdateIssuePayload, { id: string }> {
  readonly commandType = UPDATE_ISSUE;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<UpdateIssuePayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string }> {
    const { id, data } = command.payload;
    const previous = await tx.issue.findUniqueOrThrow({ where: { id } });

    // Handle status-specific fields
    const updateData: any = { ...data };
    if (data.status === 'resolved') {
      updateData.resolvedAt = new Date();
      updateData.resolvedBy = command.actorId;
    }

    const updated = await tx.issue.update({ where: { id }, data: updateData });

    // Emit appropriate event based on what changed
    if (data.status && data.status !== previous.status) {
      if (data.status === 'resolved') {
        emit(this.createEvent(command, {
          type: EVENT_TYPES.ISSUE_RESOLVED,
          entityType: 'issue',
          entityId: id,
          payload: {
            title: updated.title,
            resolution: updated.resolution,
            previousStatus: previous.status,
          },
        }));
      } else {
        emit(this.createEvent(command, {
          type: EVENT_TYPES.ISSUE_STATUS_CHANGED,
          entityType: 'issue',
          entityId: id,
          payload: {
            title: updated.title,
            previousStatus: previous.status,
            newStatus: data.status,
          },
        }));
      }
    }

    if (data.assigneeId && data.assigneeId !== previous.assigneeId) {
      emit(this.createEvent(command, {
        type: EVENT_TYPES.ISSUE_ASSIGNED,
        entityType: 'issue',
        entityId: id,
        payload: {
          title: updated.title,
          assigneeId: data.assigneeId,
          assigneeName: data.assigneeName,
          previousAssigneeId: previous.assigneeId,
        },
      }));
    }

    // General update event if no specific event was emitted
    if ((!data.status || data.status === previous.status) && (!data.assigneeId || data.assigneeId === previous.assigneeId)) {
      emit(this.createEvent(command, {
        type: EVENT_TYPES.ISSUE_UPDATED,
        entityType: 'issue',
        entityId: id,
        payload: { title: updated.title, changes: Object.keys(data) },
      }));
    }

    return { id };
  }
}
