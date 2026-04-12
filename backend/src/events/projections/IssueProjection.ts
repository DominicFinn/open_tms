/**
 * IssueProjection — builds and maintains the IssueReadModel from domain events.
 */

import { PrismaClient } from '@prisma/client';
import { DomainEvent } from '../DomainEvent.js';
import { IEventHandler } from '../IEventHandler.js';
import { SubscribeOptions } from '../IEventBus.js';
import { EVENT_TYPES } from '../eventTypes.js';

export class IssueProjection implements IEventHandler {
  readonly name = 'projection.issue';
  readonly eventPatterns = ['issue.*', 'comment.*'];
  readonly options: SubscribeOptions = {
    concurrency: 3,
    priority: 5,
    retryLimit: 5,
    expireInSeconds: 600,
  };

  constructor(private prisma: PrismaClient) {}

  async handle(event: DomainEvent): Promise<void> {
    switch (event.type) {
      case EVENT_TYPES.ISSUE_CREATED:
        return this.onIssueCreated(event);
      case EVENT_TYPES.ISSUE_UPDATED:
      case EVENT_TYPES.ISSUE_STATUS_CHANGED:
        return this.onIssueUpdated(event);
      case EVENT_TYPES.ISSUE_ASSIGNED:
        return this.onIssueAssigned(event);
      case EVENT_TYPES.ISSUE_ESCALATED:
        return this.onIssueEscalated(event);
      case EVENT_TYPES.ISSUE_RESOLVED:
        return this.onIssueResolved(event);
      case EVENT_TYPES.ISSUE_SNOOZED:
        return this.onIssueSnoozed(event);
      case EVENT_TYPES.ISSUE_UNSNOOZED:
        return this.onIssueUnsnoozed(event);
      case EVENT_TYPES.ISSUE_CLOSED:
        return this.onIssueClosed(event);
      case EVENT_TYPES.ISSUE_REOPENED:
        return this.onIssueReopened(event);
      case EVENT_TYPES.ISSUE_NEEDS_CAPA_MARKED:
        return this.onIssueNeedsCapaMarked(event);
      case EVENT_TYPES.ISSUE_LABEL_ADDED:
      case EVENT_TYPES.ISSUE_LABEL_REMOVED:
        return this.onIssueLabelChanged(event);
      case EVENT_TYPES.COMMENT_ADDED:
        return this.onCommentAdded(event);
      case EVENT_TYPES.COMMENT_DELETED:
        return this.onCommentDeleted(event);
      default:
        break;
    }
  }

  private async onIssueCreated(event: DomainEvent): Promise<void> {
    const issue = await this.prisma.issue.findUnique({ where: { id: event.entityId } });
    if (!issue) {
      console.error(`[IssueProjection] Issue ${event.entityId} not found for created event`);
      return;
    }

    await this.prisma.issueReadModel.upsert({
      where: { id: issue.id },
      create: {
        id: issue.id,
        orgId: issue.orgId,
        title: issue.title,
        description: issue.description ?? null,
        status: issue.status,
        priority: issue.priority,
        category: issue.category,
        sourceEntityType: issue.sourceEntityType,
        sourceEntityId: issue.sourceEntityId,
        sourceEventId: issue.sourceEventId ?? null,
        assigneeId: issue.assigneeId ?? null,
        assigneeName: issue.assigneeName,
        needsCapa: issue.needsCapa ?? false,
        snoozedUntil: issue.snoozedUntil ?? null,
        labels: [],
        createdAt: issue.createdAt,
        updatedAt: issue.updatedAt,
      },
      update: {
        title: issue.title,
        description: issue.description ?? null,
        status: issue.status,
        sourceEventId: issue.sourceEventId ?? null,
        assigneeId: issue.assigneeId ?? null,
        needsCapa: issue.needsCapa ?? false,
        snoozedUntil: issue.snoozedUntil ?? null,
        labels: [],
        updatedAt: issue.updatedAt,
      },
    });
  }

  private async onIssueUpdated(event: DomainEvent): Promise<void> {
    const issue = await this.prisma.issue.findUnique({ where: { id: event.entityId } });
    if (!issue) return;

    await this.prisma.issueReadModel.update({
      where: { id: issue.id },
      data: {
        title: issue.title,
        description: issue.description ?? null,
        status: issue.status,
        priority: issue.priority,
        category: issue.category,
        resolution: issue.resolution ?? null,
        assigneeId: issue.assigneeId ?? null,
        assigneeName: issue.assigneeName,
        needsCapa: issue.needsCapa ?? false,
        snoozedUntil: issue.snoozedUntil ?? null,
        snoozedBy: issue.snoozedBy ?? null,
        updatedAt: new Date(),
      },
    }).catch((err: Error) => {
      console.error(`[IssueProjection] Failed to update read model for ${event.entityId}: ${err.message}`);
    });
  }

  private async onIssueAssigned(event: DomainEvent): Promise<void> {
    const payload = event.payload as { assigneeName?: string };
    await this.prisma.issueReadModel.update({
      where: { id: event.entityId },
      data: {
        assigneeName: payload.assigneeName ?? null,
        updatedAt: new Date(),
      },
    }).catch((err: Error) => {
      console.error(`[IssueProjection] Failed to update assignment for ${event.entityId}: ${err.message}`);
    });
  }

  private async onIssueEscalated(event: DomainEvent): Promise<void> {
    const payload = event.payload as { escalatedTo?: string };
    await this.prisma.issueReadModel.update({
      where: { id: event.entityId },
      data: {
        escalatedTo: payload.escalatedTo ?? null,
        status: 'in_progress',
        updatedAt: new Date(),
      },
    }).catch((err: Error) => {
      console.error(`[IssueProjection] Failed to update escalation for ${event.entityId}: ${err.message}`);
    });
  }

  private async onIssueResolved(event: DomainEvent): Promise<void> {
    await this.prisma.issueReadModel.update({
      where: { id: event.entityId },
      data: {
        status: 'resolved',
        resolvedAt: new Date(),
        updatedAt: new Date(),
      },
    }).catch((err: Error) => {
      console.error(`[IssueProjection] Failed to update resolution for ${event.entityId}: ${err.message}`);
    });
  }

  private async onIssueSnoozed(event: DomainEvent): Promise<void> {
    const payload = event.payload as { snoozedUntil: string; snoozedBy: string };
    await this.prisma.issueReadModel.update({
      where: { id: event.entityId },
      data: {
        snoozedUntil: new Date(payload.snoozedUntil),
        snoozedBy: payload.snoozedBy,
        updatedAt: new Date(),
      },
    }).catch((err: Error) => {
      console.error(`[IssueProjection] Failed to update snooze for ${event.entityId}: ${err.message}`);
    });
  }

  private async onIssueUnsnoozed(event: DomainEvent): Promise<void> {
    await this.prisma.issueReadModel.update({
      where: { id: event.entityId },
      data: {
        snoozedUntil: null,
        snoozedBy: null,
        updatedAt: new Date(),
      },
    }).catch((err: Error) => {
      console.error(`[IssueProjection] Failed to clear snooze for ${event.entityId}: ${err.message}`);
    });
  }

  private async onIssueClosed(event: DomainEvent): Promise<void> {
    const payload = event.payload as { closedAt: string };
    await this.prisma.issueReadModel.update({
      where: { id: event.entityId },
      data: {
        status: 'closed',
        closedAt: new Date(payload.closedAt),
        updatedAt: new Date(),
      },
    }).catch((err: Error) => {
      console.error(`[IssueProjection] Failed to close issue ${event.entityId}: ${err.message}`);
    });
  }

  private async onIssueReopened(event: DomainEvent): Promise<void> {
    await this.prisma.issueReadModel.update({
      where: { id: event.entityId },
      data: {
        status: 'open',
        closedAt: null,
        updatedAt: new Date(),
      },
    }).catch((err: Error) => {
      console.error(`[IssueProjection] Failed to reopen issue ${event.entityId}: ${err.message}`);
    });
  }

  private async onIssueNeedsCapaMarked(event: DomainEvent): Promise<void> {
    const payload = event.payload as { needsCapa: boolean };
    await this.prisma.issueReadModel.update({
      where: { id: event.entityId },
      data: {
        needsCapa: payload.needsCapa,
        updatedAt: new Date(),
      },
    }).catch((err: Error) => {
      console.error(`[IssueProjection] Failed to update needsCapa for ${event.entityId}: ${err.message}`);
    });
  }

  private async onIssueLabelChanged(event: DomainEvent): Promise<void> {
    const issueId = event.entityId;
    try {
      const assignments = await this.prisma.issueLabelAssignment.findMany({
        where: { issueId },
        include: { label: true },
      });
      const labels = assignments.map((a: any) => ({
        id: a.label.id,
        name: a.label.name,
        color: a.label.color,
      }));
      await this.prisma.issueReadModel.update({
        where: { id: issueId },
        data: {
          labels,
          updatedAt: new Date(),
        },
      });
    } catch (err: any) {
      console.error(`[IssueProjection] Failed to update labels for ${issueId}: ${err.message}`);
    }
  }

  private async onCommentAdded(event: DomainEvent): Promise<void> {
    const payload = event.payload as { entityType?: string; entityId?: string };
    if (payload.entityType !== 'issue') return;
    const issueId = payload.entityId ?? event.entityId;
    await this.prisma.issueReadModel.update({
      where: { id: issueId },
      data: {
        commentCount: { increment: 1 },
        updatedAt: new Date(),
      },
    }).catch((err: Error) => {
      console.error(`[IssueProjection] Failed to increment commentCount for ${issueId}: ${err.message}`);
    });
  }

  private async onCommentDeleted(event: DomainEvent): Promise<void> {
    const payload = event.payload as { entityType?: string; entityId?: string };
    if (payload.entityType !== 'issue') return;
    const issueId = payload.entityId ?? event.entityId;
    await this.prisma.issueReadModel.update({
      where: { id: issueId },
      data: {
        commentCount: { decrement: 1 },
        updatedAt: new Date(),
      },
    }).catch((err: Error) => {
      console.error(`[IssueProjection] Failed to decrement commentCount for ${issueId}: ${err.message}`);
    });
  }
}
