/**
 * AutomationRuleHandler — evaluates deterministic automation rules against events.
 *
 * Runs with higher priority than the triage agent. When a rule matches and
 * executes an action, it writes a deduplication marker so the triage agent
 * skips the event (rules suppress agent).
 *
 * Rules are evaluated in priority order (lower number = higher priority).
 * First matching rule executes; remaining rules for the same event are skipped.
 */

import { PrismaClient, AutomationRule } from '@prisma/client';
import { DomainEvent } from '../DomainEvent.js';
import { IEventHandler } from '../IEventHandler.js';
import { ICommandBus } from '../../commands/CommandBus.js';
import { CREATE_ISSUE } from '../../commands/issues/CreateIssueCommand.js';
import { ESCALATE_ISSUE } from '../../commands/issues/EscalateIssueCommand.js';
import { evaluateConditions, RuleCondition, EvaluationContext } from '../../services/automation/ConditionEvaluator.js';
import { randomUUID } from 'crypto';

const RULES_CACHE_TTL_MS = 30_000; // 30 seconds

export class AutomationRuleHandler implements IEventHandler {
  readonly name = 'automation.rules';
  // Subscribe broadly — same as triage agent
  readonly eventPatterns = [
    'shipment.*',
    'sla.*',
    'cargo.*',
    'cold_chain.*',
  ];
  readonly options = {
    concurrency: 4,
    retryLimit: 2,
    expireInSeconds: 60,
    priority: 5, // Higher priority than triage agent (priority: 1)
  };

  private rulesCache: { rules: AutomationRule[]; loadedAt: number } | null = null;

  constructor(
    private prisma: PrismaClient,
    private commandBus: ICommandBus,
  ) {}

  async handle(event: DomainEvent): Promise<void> {
    // Load active rules (cached)
    const rules = await this.loadRules(event.orgId);
    if (rules.length === 0) return;

    // Filter rules by event pattern
    const matchingPatternRules = rules.filter((r) => this.matchesEventPattern(event.type, r.eventPattern));
    if (matchingPatternRules.length === 0) return;

    // Build evaluation context
    const evalContext = this.buildEvaluationContext(event);

    // Evaluate rules in priority order (lower number first)
    const sorted = [...matchingPatternRules].sort((a, b) => a.priority - b.priority);

    for (const rule of sorted) {
      const startMs = Date.now();
      const conditions = rule.conditions as RuleCondition[];
      const result = evaluateConditions(conditions, evalContext);
      const evaluationMs = Date.now() - startMs;

      if (result.matched) {
        // Execute the action
        const actionResult = await this.executeAction(event, rule);

        // Log execution
        await this.logExecution(event, rule, true, evaluationMs, actionResult);

        // Update rule stats
        await this.prisma.automationRule.update({
          where: { id: rule.id },
          data: {
            executionCount: { increment: 1 },
            lastExecutedAt: new Date(),
          },
        });

        // Write deduplication marker so the triage agent skips this event
        await this.writeAgentSuppression(event, rule);

        console.log(`[AutomationRule] Rule "${rule.name}" matched ${event.type} on ${event.entityType}/${event.entityId} — ${rule.actionType}`);

        // First match wins — stop evaluating further rules
        return;
      }
    }
  }

  // ── Rule loading (cached) ──────────────────────────────────────

  private async loadRules(orgId: string): Promise<AutomationRule[]> {
    if (this.rulesCache && (Date.now() - this.rulesCache.loadedAt) < RULES_CACHE_TTL_MS) {
      return this.rulesCache.rules;
    }

    const rules = await this.prisma.automationRule.findMany({
      where: { orgId, enabled: true },
      orderBy: { priority: 'asc' },
    });

    this.rulesCache = { rules, loadedAt: Date.now() };
    return rules;
  }

  // ── Event pattern matching ─────────────────────────────────────

  private matchesEventPattern(eventType: string, pattern: string): boolean {
    if (pattern === '*') return true;
    if (pattern.endsWith('.*')) {
      return eventType.startsWith(pattern.slice(0, -1));
    }
    return eventType === pattern;
  }

  // ── Build evaluation context ───────────────────────────────────

  private buildEvaluationContext(event: DomainEvent): EvaluationContext {
    return {
      event: {
        type: event.type,
        entityType: event.entityType,
        entityId: event.entityId,
        timestamp: event.timestamp,
        payload: (event.payload as Record<string, unknown>) || {},
      },
    };
  }

  // ── Action execution ───────────────────────────────────────────

  private async executeAction(
    event: DomainEvent,
    rule: AutomationRule,
  ): Promise<Record<string, unknown>> {
    const config = rule.actionConfig as Record<string, unknown>;
    const correlationId = randomUUID();

    if (rule.actionType === 'create_issue') {
      const result = await this.commandBus.dispatch({
        type: CREATE_ISSUE,
        orgId: event.orgId,
        actorId: `system:automation-rule:${rule.id}`,
        payload: {
          title: String(config.issueTitle || rule.name),
          description: String(config.issueDescription || `Automation rule "${rule.name}" triggered by ${event.type}`),
          priority: String(config.issuePriority || 'medium'),
          category: String(config.issueCategory || 'exception'),
          sourceEntityType: event.entityType,
          sourceEntityId: event.entityId,
          sourceEventId: event.id,
        },
        metadata: { correlationId, source: 'system' },
      });

      return {
        success: result.success,
        issueId: (result.data as { id: string })?.id,
        error: result.error,
      };
    }

    if (rule.actionType === 'escalate_issue') {
      const result = await this.commandBus.dispatch({
        type: ESCALATE_ISSUE,
        orgId: event.orgId,
        actorId: `system:automation-rule:${rule.id}`,
        payload: {
          id: String(config.escalateIssueId || ''),
          escalatedTo: String(config.escalatedTo || 'operations-manager'),
          reason: String(config.escalateReason || `Automation rule "${rule.name}" triggered`),
        },
        metadata: { correlationId, source: 'system' },
      });

      return {
        success: result.success,
        error: result.error,
      };
    }

    return { success: false, error: `Unknown action type: ${rule.actionType}` };
  }

  // ── Execution logging ──────────────────────────────────────────

  private async logExecution(
    event: DomainEvent,
    rule: AutomationRule,
    conditionsMatched: boolean,
    evaluationMs: number,
    actionResult: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.automationExecutionLog.create({
      data: {
        orgId: event.orgId,
        ruleId: rule.id,
        ruleName: rule.name,
        eventType: event.type,
        eventId: event.id,
        entityType: event.entityType,
        entityId: event.entityId,
        actionType: rule.actionType,
        actionResult,
        conditionsMatched,
        evaluationMs,
      },
    });
  }

  // ── Agent suppression ──────────────────────────────────────────
  // Write a marker that the triage agent's deduplication check will find,
  // preventing it from processing this same event.

  private async writeAgentSuppression(event: DomainEvent, rule: AutomationRule): Promise<void> {
    await this.prisma.agentDecision.create({
      data: {
        orgId: event.orgId,
        agentType: 'triage',
        triggerType: 'automation_rule',
        triggerEventType: event.type,
        triggerEventId: event.id,
        entityType: event.entityType,
        entityId: event.entityId,
        summary: `Handled by automation rule: ${rule.name}`,
        reasoning: `Deterministic rule "${rule.name}" matched and executed action "${rule.actionType}". Agent suppressed.`,
        context: {},
        actionType: rule.actionType,
        confidence: 1.0,
        matchedConditions: rule.conditions,
      },
    });
  }
}
