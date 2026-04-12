/**
 * Automation Rules API routes — CRUD for deterministic rules promoted from agent decisions.
 */

import { FastifyPluginAsync } from 'fastify';
import { evaluateConditions, RuleCondition, EvaluationContext } from '../services/automation/ConditionEvaluator.js';
import { randomUUID } from 'crypto';

export const automationRuleRoutes: FastifyPluginAsync = async (server) => {

  // ── GET /api/v1/automation-rules ──

  server.get('/api/v1/automation-rules', {
    schema: {
      tags: ['Automation Rules'],
      summary: 'List all automation rules',
    },
  }, async () => {
    const org = await server.prisma.organization.findFirst();
    if (!org) return { data: [], error: null };

    const rules = await server.prisma.automationRule.findMany({
      where: { orgId: org.id },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    });

    return { data: rules, error: null };
  });

  // ── POST /api/v1/automation-rules ──

  server.post<{
    Body: {
      name: string;
      description?: string;
      eventPattern: string;
      conditions: RuleCondition[];
      actionType: string;
      actionConfig: Record<string, unknown>;
      priority?: number;
      sourceDecisionId?: string;
      skillChainId?: string;
      inlineSteps?: unknown[];
    };
  }>('/api/v1/automation-rules', {
    schema: {
      tags: ['Automation Rules'],
      summary: 'Create an automation rule',
      body: {
        type: 'object',
        required: ['name', 'eventPattern', 'conditions', 'actionType', 'actionConfig'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string', nullable: true },
          eventPattern: { type: 'string' },
          conditions: { type: 'array', items: { type: 'object' } },
          actionType: { type: 'string', enum: ['create_issue', 'escalate_issue'] },
          actionConfig: { type: 'object' },
          priority: { type: 'integer', minimum: 1, maximum: 100 },
          sourceDecisionId: { type: 'string', nullable: true },
        },
      },
    },
  }, async (request, reply) => {
    const org = await server.prisma.organization.findFirst();
    if (!org) { reply.code(404); return { data: null, error: 'Organization not found' }; }

    const body = request.body;

    const rule = await server.prisma.automationRule.create({
      data: {
        orgId: org.id,
        name: body.name,
        description: body.description || null,
        eventPattern: body.eventPattern,
        conditions: body.conditions,
        actionType: body.actionType,
        actionConfig: body.actionConfig,
        priority: body.priority ?? 50,
        sourceDecisionId: body.sourceDecisionId || null,
        skillChainId: body.skillChainId || null,
        inlineSteps: body.inlineSteps || undefined,
      },
    });

    // If created from a decision, mark it as promoted
    if (body.sourceDecisionId) {
      await server.prisma.agentDecision.update({
        where: { id: body.sourceDecisionId },
        data: { promotedToAutomation: true, promotedAt: new Date() },
      }).catch(() => {});
    }

    reply.code(201);
    return { data: rule, error: null };
  });

  // ── GET /api/v1/automation-rules/:id ──

  server.get<{ Params: { id: string } }>('/api/v1/automation-rules/:id', {
    schema: {
      tags: ['Automation Rules'],
      summary: 'Get automation rule by ID',
    },
  }, async (request, reply) => {
    const rule = await server.prisma.automationRule.findUnique({
      where: { id: request.params.id },
    });
    if (!rule) { reply.code(404); return { data: null, error: 'Rule not found' }; }
    return { data: rule, error: null };
  });

  // ── PUT /api/v1/automation-rules/:id ──

  server.put<{
    Params: { id: string };
    Body: {
      name?: string;
      description?: string;
      eventPattern?: string;
      conditions?: RuleCondition[];
      actionType?: string;
      actionConfig?: Record<string, unknown>;
      priority?: number;
      enabled?: boolean;
    };
  }>('/api/v1/automation-rules/:id', {
    schema: {
      tags: ['Automation Rules'],
      summary: 'Update an automation rule',
    },
  }, async (request, reply) => {
    const existing = await server.prisma.automationRule.findUnique({ where: { id: request.params.id } });
    if (!existing) { reply.code(404); return { data: null, error: 'Rule not found' }; }

    const body = request.body;
    const rule = await server.prisma.automationRule.update({
      where: { id: request.params.id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.eventPattern !== undefined && { eventPattern: body.eventPattern }),
        ...(body.conditions !== undefined && { conditions: body.conditions }),
        ...(body.actionType !== undefined && { actionType: body.actionType }),
        ...(body.actionConfig !== undefined && { actionConfig: body.actionConfig }),
        ...(body.priority !== undefined && { priority: body.priority }),
        ...(body.enabled !== undefined && { enabled: body.enabled }),
      },
    });

    return { data: rule, error: null };
  });

  // ── DELETE /api/v1/automation-rules/:id ──

  server.delete<{ Params: { id: string } }>('/api/v1/automation-rules/:id', {
    schema: {
      tags: ['Automation Rules'],
      summary: 'Delete an automation rule',
    },
  }, async (request, reply) => {
    await server.prisma.automationRule.delete({ where: { id: request.params.id } }).catch(() => {});
    return { data: { deleted: true }, error: null };
  });

  // ── POST /api/v1/automation-rules/:id/toggle ──

  server.post<{ Params: { id: string } }>('/api/v1/automation-rules/:id/toggle', {
    schema: {
      tags: ['Automation Rules'],
      summary: 'Toggle an automation rule enabled/disabled',
    },
  }, async (request) => {
    const rule = await server.prisma.automationRule.findUnique({ where: { id: request.params.id } });
    if (!rule) return { data: null, error: 'Rule not found' };

    const updated = await server.prisma.automationRule.update({
      where: { id: request.params.id },
      data: { enabled: !rule.enabled },
    });

    return { data: updated, error: null };
  });

  // ── GET /api/v1/automation-rules/:id/executions ──

  server.get<{ Params: { id: string }; Querystring: { limit?: string } }>('/api/v1/automation-rules/:id/executions', {
    schema: {
      tags: ['Automation Rules'],
      summary: 'Get execution log for a rule',
    },
  }, async (request) => {
    const limit = request.query.limit ? parseInt(request.query.limit, 10) : 50;

    const executions = await server.prisma.automationExecutionLog.findMany({
      where: { ruleId: request.params.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return { data: executions, error: null };
  });

  // ── POST /api/v1/automation-rules/from-decision/:decisionId ──
  // Creates a rule pre-filled from a promoted agent decision.

  server.post<{ Params: { decisionId: string }; Body: { name?: string; priority?: number } }>('/api/v1/automation-rules/from-decision/:decisionId', {
    schema: {
      tags: ['Automation Rules'],
      summary: 'Create an automation rule from a promoted agent decision',
    },
  }, async (request, reply) => {
    const decision = await server.prisma.agentDecision.findUnique({
      where: { id: request.params.decisionId },
    });
    if (!decision) { reply.code(404); return { data: null, error: 'Decision not found' }; }

    const conditions = (decision.matchedConditions as RuleCondition[]) || [];
    if (conditions.length === 0) {
      reply.code(400);
      return { data: null, error: 'Decision has no matched conditions to promote' };
    }

    // Extract event pattern from conditions
    const eventTypeCondition = conditions.find((c) => c.field === 'event.type' && c.operator === 'equals');
    const eventPattern = eventTypeCondition ? String(eventTypeCondition.value) : decision.triggerEventType || 'shipment.*';

    // Build action config from decision
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

    const rule = await server.prisma.automationRule.create({
      data: {
        orgId: decision.orgId,
        name: request.body.name || `Auto: ${decision.summary}`,
        description: `Promoted from agent decision ${decision.id.slice(0, 8)}. Original reasoning: ${decision.reasoning.substring(0, 200)}`,
        eventPattern,
        conditions: conditions.filter((c) => c.field !== 'event.type'), // event.type is the eventPattern, not a condition
        actionType: decision.actionType,
        actionConfig,
        priority: request.body.priority ?? 50,
        sourceDecisionId: decision.id,
      },
    });

    // Mark decision as promoted
    await server.prisma.agentDecision.update({
      where: { id: decision.id },
      data: { promotedToAutomation: true, promotedAt: new Date() },
    });

    reply.code(201);
    return { data: rule, error: null };
  });

  // ── POST /api/v1/automation-rules/:id/test ──
  // Dry-run: evaluate a rule against a sample event.

  server.post<{
    Params: { id: string };
    Body: { event: { type: string; entityType: string; entityId: string; timestamp: string; payload: Record<string, unknown> } };
  }>('/api/v1/automation-rules/:id/test', {
    schema: {
      tags: ['Automation Rules'],
      summary: 'Test a rule against a sample event (dry run)',
      body: {
        type: 'object',
        required: ['event'],
        properties: {
          event: {
            type: 'object',
            required: ['type', 'entityType', 'entityId', 'payload'],
            properties: {
              type: { type: 'string' },
              entityType: { type: 'string' },
              entityId: { type: 'string' },
              timestamp: { type: 'string' },
              payload: { type: 'object' },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    const rule = await server.prisma.automationRule.findUnique({ where: { id: request.params.id } });
    if (!rule) { reply.code(404); return { data: null, error: 'Rule not found' }; }

    const conditions = rule.conditions as RuleCondition[];
    const evalContext: EvaluationContext = {
      event: {
        ...request.body.event,
        timestamp: request.body.event.timestamp || new Date().toISOString(),
      },
    };

    const result = evaluateConditions(conditions, evalContext);

    return {
      data: {
        ruleId: rule.id,
        ruleName: rule.name,
        eventPattern: rule.eventPattern,
        eventPatternMatched: request.body.event.type === rule.eventPattern || rule.eventPattern.endsWith('.*') && request.body.event.type.startsWith(rule.eventPattern.slice(0, -1)),
        conditionResults: result.details,
        allConditionsMatched: result.matched,
        wouldExecuteAction: result.matched,
        actionType: rule.actionType,
      },
      error: null,
    };
  });
};
