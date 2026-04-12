/**
 * SkillChainExecutor — walks a chain of skill steps with branching support.
 *
 * Steps can be:
 * - skill: resolve template fields, load config, execute
 * - question: evaluate conditions, follow matching branch
 */

import { PrismaClient } from '@prisma/client';
import { DomainEvent } from '../../events/DomainEvent.js';
import { SkillRegistry } from './SkillRegistry.js';
import { SkillChainStep, ChainExecutionResult, ChainStepResult } from './ISkill.js';
import { resolveFields } from './TemplateResolver.js';
import { evaluateConditions, RuleCondition, EvaluationContext } from '../automation/ConditionEvaluator.js';

export class SkillChainExecutor {
  constructor(
    private registry: SkillRegistry,
    private prisma: PrismaClient,
  ) {}

  async execute(
    steps: SkillChainStep[],
    event: DomainEvent,
    context: Record<string, unknown>,
    orgId: string,
  ): Promise<ChainExecutionResult> {
    const stepResults: ChainStepResult[] = [];
    let overallSuccess = true;

    // Build template data for field resolution
    const templateData: Record<string, unknown> = {
      event: {
        type: event.type,
        entityType: event.entityType,
        entityId: event.entityId,
        timestamp: event.timestamp,
      },
      payload: (event.payload as Record<string, unknown>) || {},
      context,
    };

    try {
      await this.executeSteps(steps, event, context, orgId, templateData, stepResults, 0);
    } catch (err) {
      overallSuccess = false;
      stepResults.push({
        stepIndex: stepResults.length,
        stepType: 'skill',
        result: { success: false, error: (err as Error).message },
      });
    }

    overallSuccess = stepResults.every((r) => !r.result || r.result.success);

    return { success: overallSuccess, stepResults };
  }

  private async executeSteps(
    steps: SkillChainStep[],
    event: DomainEvent,
    context: Record<string, unknown>,
    orgId: string,
    templateData: Record<string, unknown>,
    results: ChainStepResult[],
    startIndex: number,
  ): Promise<void> {
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const stepIndex = startIndex + i;

      if (step.type === 'skill') {
        await this.executeSkillStep(step, event, context, orgId, templateData, results, stepIndex);
      } else if (step.type === 'question') {
        await this.executeQuestionStep(step, event, context, orgId, templateData, results, stepIndex);
      }
    }
  }

  private async executeSkillStep(
    step: Extract<SkillChainStep, { type: 'skill' }>,
    event: DomainEvent,
    context: Record<string, unknown>,
    orgId: string,
    templateData: Record<string, unknown>,
    results: ChainStepResult[],
    stepIndex: number,
  ): Promise<void> {
    const skill = this.registry.get(step.skillType);
    if (!skill) {
      results.push({
        stepIndex,
        stepType: 'skill',
        skillType: step.skillType,
        result: { success: false, error: `Skill type "${step.skillType}" not found in registry` },
      });
      return;
    }

    // Resolve template fields
    const resolvedFields = resolveFields(step.fields, templateData);

    // Load skill config if needed
    let config: Record<string, unknown> = {};
    if (step.skillConfigId) {
      const skillConfig = await this.prisma.skillConfig.findUnique({
        where: { id: step.skillConfigId },
      });
      if (skillConfig) {
        config = skillConfig.config as Record<string, unknown>;
      }
    } else if (skill.definition.requiresConfig) {
      // Try to find a default config for this skill type
      const defaultConfig = await this.prisma.skillConfig.findFirst({
        where: { orgId, skillType: step.skillType, enabled: true },
      });
      if (defaultConfig) {
        config = defaultConfig.config as Record<string, unknown>;
      }
    }

    // Execute
    const result = await skill.execute({
      fields: resolvedFields,
      config,
      event,
      context,
      orgId,
    });

    results.push({
      stepIndex,
      stepType: 'skill',
      skillType: step.skillType,
      result,
    });
  }

  private async executeQuestionStep(
    step: Extract<SkillChainStep, { type: 'question' }>,
    event: DomainEvent,
    context: Record<string, unknown>,
    orgId: string,
    templateData: Record<string, unknown>,
    results: ChainStepResult[],
    stepIndex: number,
  ): Promise<void> {
    // Evaluate conditions
    const evalContext: EvaluationContext = {
      event: {
        type: event.type,
        entityType: event.entityType,
        entityId: event.entityId,
        timestamp: event.timestamp,
        payload: (event.payload as Record<string, unknown>) || {},
      },
      context,
    };

    const evalResult = evaluateConditions(step.conditions as RuleCondition[], evalContext);

    // Find the matching branch
    const branch = step.branches.find((b) => b.matched === evalResult.matched);

    results.push({
      stepIndex,
      stepType: 'question',
      question: step.question,
      branchTaken: branch?.label || (evalResult.matched ? 'Yes' : 'No'),
    });

    // Execute the branch's steps
    if (branch && branch.steps.length > 0) {
      await this.executeSteps(branch.steps, event, context, orgId, templateData, results, stepIndex + 1);
    }
  }
}
