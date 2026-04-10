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
  readonly eventPatterns = ['issue.*'];
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
        status: issue.status,
        priority: issue.priority,
        category: issue.category,
        sourceEntityType: issue.sourceEntityType,
        sourceEntityId: issue.sourceEntityId,
        assigneeName: issue.assigneeName,
        createdAt: issue.createdAt,
        updatedAt: issue.updatedAt,
      },
      update: {
        title: issue.title,
        status: issue.status,
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
        status: issue.status,
        priority: issue.priority,
        category: issue.category,
        assigneeName: issue.assigneeName,
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
}
