/**
 * CreateAgentDecisionCommand — logs a new AI agent decision.
 *
 * Called by agent handlers (or external systems) whenever an AI agent
 * makes a judgment call. Captures full context, reasoning, and action
 * for compliance and automation discovery.
 */

import { Prisma, PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface CreateAgentDecisionPayload {
  agentType: string;
  modelProvider?: string;
  modelId?: string;
  triggerType: string;
  triggerEventType?: string;
  triggerEventId?: string;
  entityType?: string;
  entityId?: string;
  summary: string;
  reasoning: string;
  context: Record<string, unknown>;
  conversationLog?: Array<{ role: string; content: string }>;
  confidence?: number;
  actionType: string;
  actionPayload?: Record<string, unknown>;
  actionEntityType?: string;
  actionEntityId?: string;
  inputTokens?: number;
  outputTokens?: number;
  durationMs?: number;
}

export const CREATE_AGENT_DECISION = 'agent_decision.create';

export class CreateAgentDecisionCommandHandler extends BaseCommandHandler<
  CreateAgentDecisionPayload,
  { id: string; summary: string; actionType: string }
> {
  readonly commandType = CREATE_AGENT_DECISION;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<CreateAgentDecisionPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string; summary: string; actionType: string }> {
    const record = await tx.agentDecision.create({
      data: {
        orgId: command.orgId,
        agentType: command.payload.agentType,
        modelProvider: command.payload.modelProvider,
        modelId: command.payload.modelId,
        triggerType: command.payload.triggerType,
        triggerEventType: command.payload.triggerEventType,
        triggerEventId: command.payload.triggerEventId,
        entityType: command.payload.entityType,
        entityId: command.payload.entityId,
        summary: command.payload.summary,
        reasoning: command.payload.reasoning,
        context: command.payload.context as Prisma.InputJsonValue,
        conversationLog: command.payload.conversationLog as Prisma.InputJsonValue ?? undefined,
        confidence: command.payload.confidence,
        actionType: command.payload.actionType,
        actionPayload: command.payload.actionPayload as Prisma.InputJsonValue ?? undefined,
        actionEntityType: command.payload.actionEntityType,
        actionEntityId: command.payload.actionEntityId,
        inputTokens: command.payload.inputTokens,
        outputTokens: command.payload.outputTokens,
        durationMs: command.payload.durationMs,
      },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.AGENT_DECISION_CREATED,
      entityType: 'agent_decision',
      entityId: record.id,
      payload: {
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
      },
    }));

    return { id: record.id, summary: record.summary, actionType: record.actionType };
  }
}
