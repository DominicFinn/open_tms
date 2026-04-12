/**
 * AgentDecisionProjection — builds and maintains the AgentDecisionReadModel
 * from domain events.
 */

import { PrismaClient } from '@prisma/client';
import { DomainEvent } from '../DomainEvent.js';
import { IEventHandler } from '../IEventHandler.js';
import { SubscribeOptions } from '../IEventBus.js';
import { EVENT_TYPES } from '../eventTypes.js';

export class AgentDecisionProjection implements IEventHandler {
  readonly name = 'projection.agent_decision';
  readonly eventPatterns = ['agent_decision.*'];
  readonly options: SubscribeOptions = {
    concurrency: 3,
    priority: 5,
    retryLimit: 5,
    expireInSeconds: 600,
  };

  constructor(private prisma: PrismaClient) {}

  async handle(event: DomainEvent): Promise<void> {
    switch (event.type) {
      case EVENT_TYPES.AGENT_DECISION_CREATED:
        return this.onCreated(event);
      case EVENT_TYPES.AGENT_DECISION_OUTCOME_RECORDED:
        return this.onOutcomeRecorded(event);
      case EVENT_TYPES.AGENT_DECISION_PROMOTED:
        return this.onPromoted(event);
      default:
        break;
    }
  }

  private async onCreated(event: DomainEvent): Promise<void> {
    const record = await this.prisma.agentDecision.findUnique({ where: { id: event.entityId } });
    if (!record) {
      console.error(`[AgentDecisionProjection] Decision ${event.entityId} not found for created event`);
      return;
    }

    await this.prisma.agentDecisionReadModel.upsert({
      where: { id: record.id },
      create: {
        id: record.id,
        orgId: record.orgId,
        agentType: record.agentType,
        modelProvider: record.modelProvider,
        modelId: record.modelId,
        triggerType: record.triggerType,
        triggerEventType: record.triggerEventType,
        entityType: record.entityType,
        entityId: record.entityId,
        summary: record.summary,
        confidence: record.confidence,
        actionType: record.actionType,
        actionEntityType: record.actionEntityType,
        actionEntityId: record.actionEntityId,
        outcomeStatus: record.outcomeStatus,
        promotedToAutomation: record.promotedToAutomation,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      },
      update: {
        agentType: record.agentType,
        summary: record.summary,
        updatedAt: record.updatedAt,
      },
    });
  }

  private async onOutcomeRecorded(event: DomainEvent): Promise<void> {
    const record = await this.prisma.agentDecision.findUnique({ where: { id: event.entityId } });
    if (!record) return;

    await this.prisma.agentDecisionReadModel.update({
      where: { id: event.entityId },
      data: {
        outcomeStatus: record.outcomeStatus,
        updatedAt: new Date(),
      },
    }).catch((err: Error) => {
      console.error(`[AgentDecisionProjection] Failed to update outcome for ${event.entityId}: ${err.message}`);
    });
  }

  private async onPromoted(event: DomainEvent): Promise<void> {
    await this.prisma.agentDecisionReadModel.update({
      where: { id: event.entityId },
      data: {
        promotedToAutomation: true,
        updatedAt: new Date(),
      },
    }).catch((err: Error) => {
      console.error(`[AgentDecisionProjection] Failed to update promotion for ${event.entityId}: ${err.message}`);
    });
  }
}
