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
    snoozedUntil?: string | null;
    snoozedBy?: string | null;
    snoozedReason?: string | null;
    needsCapa?: boolean;
    closedAt?: string | null;
    closedBy?: string | null;
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
    if (data.status === 'closed') {
      updateData.closedAt = new Date();
      updateData.closedBy = command.actorId;
    }
    // Parse date strings for snooze
    if (data.snoozedUntil) {
      updateData.snoozedUntil = new Date(data.snoozedUntil);
    }
    if (data.closedAt) {
      updateData.closedAt = new Date(data.closedAt);
    }

    const updated = await tx.issue.update({ where: { id }, data: updateData });

    let specificEventEmitted = false;

    // Emit appropriate event based on what changed
    if (data.status && data.status !== previous.status) {
      specificEventEmitted = true;
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
      } else if (data.status === 'closed') {
        emit(this.createEvent(command, {
          type: EVENT_TYPES.ISSUE_CLOSED,
          entityType: 'issue',
          entityId: id,
          payload: {
            title: updated.title,
            closedAt: updated.closedAt?.toISOString(),
            previousStatus: previous.status,
          },
        }));
      } else if (data.status === 'open' && (previous.status === 'closed' || previous.status === 'resolved')) {
        emit(this.createEvent(command, {
          type: EVENT_TYPES.ISSUE_REOPENED,
          entityType: 'issue',
          entityId: id,
          payload: {
            title: updated.title,
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
      specificEventEmitted = true;
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

    // Snooze events
    if (data.snoozedUntil !== undefined) {
      specificEventEmitted = true;
      if (data.snoozedUntil) {
        emit(this.createEvent(command, {
          type: EVENT_TYPES.ISSUE_SNOOZED,
          entityType: 'issue',
          entityId: id,
          payload: {
            title: updated.title,
            snoozedUntil: updated.snoozedUntil?.toISOString(),
            snoozedBy: updated.snoozedBy,
            snoozedReason: updated.snoozedReason,
          },
        }));
      } else {
        emit(this.createEvent(command, {
          type: EVENT_TYPES.ISSUE_UNSNOOZED,
          entityType: 'issue',
          entityId: id,
          payload: { title: updated.title },
        }));
      }
    }

    // Needs CAPA event
    if (data.needsCapa !== undefined && data.needsCapa !== previous.needsCapa) {
      specificEventEmitted = true;
      emit(this.createEvent(command, {
        type: EVENT_TYPES.ISSUE_NEEDS_CAPA_MARKED,
        entityType: 'issue',
        entityId: id,
        payload: { title: updated.title, needsCapa: data.needsCapa },
      }));
    }

    // General update event if no specific event was emitted
    if (!specificEventEmitted) {
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
