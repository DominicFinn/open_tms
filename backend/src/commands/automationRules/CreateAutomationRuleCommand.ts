import { PrismaClient, Prisma } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface CreateAutomationRulePayload {
  name: string;
  description?: string | null;
  eventPattern: string;
  conditions: unknown[]; // RuleCondition[] — typed as unknown here so the
                          // command isn't coupled to the evaluator's types.
  actionType: string;
  actionConfig: Record<string, unknown>;
  priority?: number;
  sourceDecisionId?: string | null;
  skillChainId?: string | null;
  inlineSteps?: unknown[];
}

export interface CreateAutomationRuleResult {
  id: string;
  name: string;
  enabled: boolean;
  promotedFromDecisionId: string | null;
}

export const CREATE_AUTOMATION_RULE = 'automation_rule.create';

export class CreateAutomationRuleCommandHandler extends BaseCommandHandler<CreateAutomationRulePayload, CreateAutomationRuleResult> {
  readonly commandType = CREATE_AUTOMATION_RULE;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<CreateAutomationRulePayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<CreateAutomationRuleResult> {
    const p = command.payload;

    // Prisma's Json input type doesn't accept arbitrary `unknown[]` so we
    // hand-cast through Prisma.JsonValue here. The runtime shape is the same
    // condition/action JSON the route already wrote.
    const rule = await tx.automationRule.create({
      data: {
        orgId: command.orgId,
        name: p.name,
        description: p.description ?? null,
        eventPattern: p.eventPattern,
        conditions: p.conditions as unknown as Prisma.InputJsonValue,
        actionType: p.actionType,
        actionConfig: p.actionConfig as Prisma.InputJsonValue,
        priority: p.priority ?? 50,
        sourceDecisionId: p.sourceDecisionId ?? null,
        skillChainId: p.skillChainId ?? null,
        inlineSteps: p.inlineSteps
          ? (p.inlineSteps as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
    });

    // If created from a decision, mark the decision as promoted so the UI
    // can reflect provenance and avoid double-promoting.
    if (p.sourceDecisionId) {
      await tx.agentDecision.update({
        where: { id: p.sourceDecisionId },
        data: { promotedToAutomation: true, promotedAt: new Date() },
      }).catch(() => {});
    }

    emit(this.createEvent(command, {
      type: EVENT_TYPES.AUTOMATION_RULE_CREATED,
      entityType: 'automation_rule',
      entityId: rule.id,
      payload: {
        name: rule.name,
        eventPattern: rule.eventPattern,
        actionType: rule.actionType,
        priority: rule.priority,
        sourceDecisionId: p.sourceDecisionId ?? null,
      },
    }));

    return {
      id: rule.id,
      name: rule.name,
      enabled: rule.enabled,
      promotedFromDecisionId: p.sourceDecisionId ?? null,
    };
  }
}
