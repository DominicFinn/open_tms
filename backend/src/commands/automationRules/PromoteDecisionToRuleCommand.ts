import { PrismaClient, Prisma } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface PromoteDecisionToRulePayload {
  decisionId: string;
  name?: string;
  priority?: number;
}

export interface PromoteDecisionToRuleResult {
  ruleId: string;
  decisionId: string;
}

interface RuleConditionLike {
  field?: string;
  operator?: string;
  value?: unknown;
}

export const PROMOTE_DECISION_TO_RULE = 'automation_rule.promote_from_decision';

export class PromoteDecisionToRuleCommandHandler extends BaseCommandHandler<PromoteDecisionToRulePayload, PromoteDecisionToRuleResult> {
  readonly commandType = PROMOTE_DECISION_TO_RULE;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<PromoteDecisionToRulePayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<PromoteDecisionToRuleResult> {
    const { decisionId, name, priority } = command.payload;

    const decision = await tx.agentDecision.findUnique({ where: { id: decisionId } });
    if (!decision) throw new Error('Decision not found');

    const conditions = (decision.matchedConditions as RuleConditionLike[]) || [];
    if (conditions.length === 0) {
      throw new Error('Decision has no matched conditions to promote');
    }

    // Pull eventPattern out of the condition list so we don't double-filter
    // on event.type at evaluation time.
    const eventTypeCondition = conditions.find(
      (c) => c.field === 'event.type' && c.operator === 'equals'
    );
    const eventPattern = eventTypeCondition
      ? String(eventTypeCondition.value)
      : decision.triggerEventType || 'shipment.*';

    const actionConfig: Record<string, unknown> = {};
    const decisionPayload = (decision.actionPayload as Record<string, unknown>) || {};
    if (decision.actionType === 'create_issue') {
      actionConfig.issuePriority = decisionPayload.issuePriority || 'medium';
      actionConfig.issueCategory = decisionPayload.issueCategory || 'exception';
      actionConfig.issueTitle = decisionPayload.issueTitle || decision.summary;
    } else if (decision.actionType === 'escalate_issue') {
      actionConfig.escalatedTo = 'operations-manager';
      actionConfig.escalateReason = decisionPayload.escalateReason || decision.summary;
    }

    const remainingConditions = conditions.filter((c) => c.field !== 'event.type');

    const rule = await tx.automationRule.create({
      data: {
        orgId: decision.orgId,
        name: name || `Auto: ${decision.summary}`,
        description: `Promoted from agent decision ${decision.id.slice(0, 8)}. Original reasoning: ${decision.reasoning.substring(0, 200)}`,
        eventPattern,
        conditions: remainingConditions as unknown as Prisma.InputJsonValue,
        actionType: decision.actionType,
        actionConfig: actionConfig as Prisma.InputJsonValue,
        priority: priority ?? 50,
        sourceDecisionId: decision.id,
      },
    });

    await tx.agentDecision.update({
      where: { id: decision.id },
      data: { promotedToAutomation: true, promotedAt: new Date() },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.AUTOMATION_RULE_PROMOTED_FROM_DECISION,
      entityType: 'automation_rule',
      entityId: rule.id,
      payload: {
        name: rule.name,
        decisionId: decision.id,
        eventPattern,
        actionType: decision.actionType,
      },
    }));

    return { ruleId: rule.id, decisionId: decision.id };
  }
}
