/**
 * AutomationRuleHandler — evaluates deterministic automation rules against events.
 *
 * Called by TriageAgentHandler as the first step in the triage pipeline.
 * When a rule matches it executes the action, logs the result, and returns
 * true so the caller knows to skip the LLM. This keeps the pipeline
 * sequential: cheap deterministic rules first, expensive LLM only as fallback.
 *
 * Supports both simple skills (single action) and skill chains (multi-step
 * with question branching). Uses the SkillRegistry for extensible actions.
 */

import { PrismaClient, AutomationRule } from '@prisma/client';
import { DomainEvent } from '../DomainEvent.js';
import { evaluateConditions, RuleCondition, EvaluationContext } from '../../services/automation/ConditionEvaluator.js';
import { SkillRegistry } from '../../services/skills/SkillRegistry.js';
import { SkillChainExecutor } from '../../services/skills/SkillChainExecutor.js';
import { SkillChainStep } from '../../services/skills/ISkill.js';
import { resolveFields } from '../../services/skills/TemplateResolver.js';

const RULES_CACHE_TTL_MS = 30_000;

export class AutomationRuleHandler {
  private rulesCache: { rules: AutomationRule[]; loadedAt: number } | null = null;
  private chainExecutor: SkillChainExecutor;

  constructor(
    private prisma: PrismaClient,
    private skillRegistry: SkillRegistry,
  ) {
    this.chainExecutor = new SkillChainExecutor(skillRegistry, prisma);
  }

  /**
   * Try to match automation rules against the event.
   * Returns true if a rule matched and handled the event (caller should skip LLM).
   * Returns false if no rule matched (caller should proceed to LLM).
   */
  async tryHandle(event: DomainEvent): Promise<boolean> {
    const rules = await this.loadRules(event.orgId);
    if (rules.length === 0) return false;

    const matchingPatternRules = rules.filter((r) => this.matchesEventPattern(event.type, r.eventPattern));
    if (matchingPatternRules.length === 0) return false;

    const evalContext: EvaluationContext = {
      event: {
        type: event.type,
        entityType: event.entityType,
        entityId: event.entityId,
        timestamp: event.timestamp,
        payload: (event.payload as Record<string, unknown>) || {},
      },
    };

    const sorted = [...matchingPatternRules].sort((a, b) => a.priority - b.priority);

    for (const rule of sorted) {
      const startMs = Date.now();
      const conditions = rule.conditions as unknown as RuleCondition[];
      const result = evaluateConditions(conditions, evalContext);
      const evaluationMs = Date.now() - startMs;

      if (result.matched) {
        const actionResult = await this.executeRuleAction(event, rule);

        await this.logExecution(event, rule, true, evaluationMs, actionResult);

        await this.prisma.automationRule.update({
          where: { id: rule.id },
          data: { executionCount: { increment: 1 }, lastExecutedAt: new Date() },
        });

        await this.logDecision(event, rule);

        console.log(`[AutomationRule] Rule "${rule.name}" matched ${event.type} on ${event.entityType}/${event.entityId} — ${rule.actionType}`);
        return true;
      }
    }

    return false;
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

  private matchesEventPattern(eventType: string, pattern: string): boolean {
    if (pattern === '*') return true;
    if (pattern.endsWith('.*')) return eventType.startsWith(pattern.slice(0, -1));
    return eventType === pattern;
  }

  // ── Action execution via skills ────────────────────────────────

  private async executeRuleAction(
    event: DomainEvent,
    rule: AutomationRule,
  ): Promise<Record<string, unknown>> {
    const context: Record<string, unknown> = {};

    // Skill chain execution
    if (rule.actionType === 'skill_chain') {
      const steps = (rule.inlineSteps as SkillChainStep[]) || [];

      // If using a named chain, load it
      if (rule.skillChainId && steps.length === 0) {
        const chain = await this.prisma.skillChain.findUnique({ where: { id: rule.skillChainId } });
        if (chain) {
          const chainResult = await this.chainExecutor.execute(
            chain.steps as SkillChainStep[],
            event, context, event.orgId,
          );
          return { success: chainResult.success, stepResults: chainResult.stepResults };
        }
        return { success: false, error: 'Skill chain not found' };
      }

      const chainResult = await this.chainExecutor.execute(steps, event, context, event.orgId);
      return { success: chainResult.success, stepResults: chainResult.stepResults };
    }

    // Simple skill execution (backward compatible with create_issue, escalate_issue)
    const skill = this.skillRegistry.get(rule.actionType);
    if (!skill) {
      return { success: false, error: `Skill type "${rule.actionType}" not found` };
    }

    const config = rule.actionConfig as Record<string, string>;
    const templateData: Record<string, unknown> = {
      event: { type: event.type, entityType: event.entityType, entityId: event.entityId, timestamp: event.timestamp },
      payload: (event.payload as Record<string, unknown>) || {},
      context,
    };

    const resolvedFields = resolveFields(config, templateData);

    // Load skill config if the skill requires it
    let skillConfig: Record<string, unknown> = {};
    if (skill.definition.requiresConfig) {
      const dbConfig = await this.prisma.skillConfig.findFirst({
        where: { orgId: event.orgId, skillType: rule.actionType, enabled: true },
      });
      if (dbConfig) skillConfig = dbConfig.config as Record<string, unknown>;
    }

    const result = await skill.execute({
      fields: resolvedFields,
      config: skillConfig,
      event,
      context,
      orgId: event.orgId,
    });

    return { success: result.success, data: result.data, error: result.error };
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
        actionResult: actionResult as any,
        conditionsMatched,
        evaluationMs,
      },
    });
  }

  // ── Decision logging (audit trail for deterministic rules) ─────

  private async logDecision(event: DomainEvent, rule: AutomationRule): Promise<void> {
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
        matchedConditions: rule.conditions as any,
      },
    });
  }
}
