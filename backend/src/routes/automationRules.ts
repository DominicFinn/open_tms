/**
 * Automation Rules API routes — CRUD for deterministic rules promoted from agent decisions.
 * All writes go through the command bus.
 */

import { FastifyPluginAsync } from 'fastify';
import { evaluateConditions, RuleCondition, EvaluationContext } from '../services/automation/ConditionEvaluator.js';
import { randomUUID } from 'crypto';
import { container, TOKENS } from '../di/index.js';
import { ICommandBus } from '../commands/CommandBus.js';
import {
  CREATE_AUTOMATION_RULE,
  UPDATE_AUTOMATION_RULE,
  DELETE_AUTOMATION_RULE,
  PROMOTE_DECISION_TO_RULE,
} from '../commands/automationRules/index.js';

import { guardWrites } from '../auth/guardWrites.js';

export const automationRuleRoutes: FastifyPluginAsync = async (server) => {
  const commandBus = container.resolve<ICommandBus>(TOKENS.ICommandBus);
  // /test is a dry-run evaluation (read-only).
  server.addHook('preHandler', guardWrites('automation_rules', { readPaths: ['/test'] }));

  const resolveOrgId = async (req: any): Promise<string | null> => {
    if (req.user?.organizationId) return req.user.organizationId;
    const org = await server.prisma.organization.findFirst();
    return org?.id ?? null;
  };

  // ── GET /api/v1/automation-rules ──
  server.get('/api/v1/automation-rules', {
    schema: { tags: ['Automation Rules'], summary: 'List all automation rules' },
  }, async (req) => {
    const orgId = await resolveOrgId(req);
    if (!orgId) return { data: [], error: null };

    const rules = await server.prisma.automationRule.findMany({
      where: { orgId },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      take: 500,
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
    const orgId = await resolveOrgId(request);
    if (!orgId) { reply.code(404); return { data: null, error: 'Organization not found' }; }

    const result = await commandBus.dispatch({
      type: CREATE_AUTOMATION_RULE,
      orgId,
      actorId: request.user?.sub ?? null,
      payload: {
        name: request.body.name,
        description: request.body.description ?? null,
        eventPattern: request.body.eventPattern,
        conditions: request.body.conditions,
        actionType: request.body.actionType,
        actionConfig: request.body.actionConfig,
        priority: request.body.priority,
        sourceDecisionId: request.body.sourceDecisionId ?? null,
        skillChainId: request.body.skillChainId ?? null,
        inlineSteps: request.body.inlineSteps,
      },
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error ?? 'Failed to create rule' };
    }

    const rule = await server.prisma.automationRule.findUnique({
      where: { id: (result.data as { id: string }).id },
    });
    reply.code(201);
    return { data: rule, error: null };
  });

  // ── GET /api/v1/automation-rules/:id ──
  server.get<{ Params: { id: string } }>('/api/v1/automation-rules/:id', {
    schema: { tags: ['Automation Rules'], summary: 'Get automation rule by ID' },
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
    schema: { tags: ['Automation Rules'], summary: 'Update an automation rule' },
  }, async (request, reply) => {
    const orgId = await resolveOrgId(request);
    if (!orgId) { reply.code(404); return { data: null, error: 'Organization not found' }; }

    const result = await commandBus.dispatch({
      type: UPDATE_AUTOMATION_RULE,
      orgId,
      actorId: request.user?.sub ?? null,
      payload: { id: request.params.id, data: request.body },
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) {
      const code = (result.error || '').toLowerCase().includes('not found') ? 404 : 400;
      reply.code(code);
      return { data: null, error: result.error ?? 'Failed to update rule' };
    }

    const rule = await server.prisma.automationRule.findUnique({
      where: { id: request.params.id },
    });
    return { data: rule, error: null };
  });

  // ── DELETE /api/v1/automation-rules/:id ──
  server.delete<{ Params: { id: string } }>('/api/v1/automation-rules/:id', {
    schema: { tags: ['Automation Rules'], summary: 'Delete an automation rule' },
  }, async (request, reply) => {
    const orgId = await resolveOrgId(request);
    if (!orgId) { reply.code(404); return { data: null, error: 'Organization not found' }; }

    const result = await commandBus.dispatch({
      type: DELETE_AUTOMATION_RULE,
      orgId,
      actorId: request.user?.sub ?? null,
      payload: { id: request.params.id },
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error ?? 'Failed to delete rule' };
    }

    return { data: { deleted: (result.data as { deleted: boolean }).deleted }, error: null };
  });

  // ── POST /api/v1/automation-rules/:id/toggle ──
  // Implemented as an UpdateAutomationRule with `{ enabled: <flipped> }` so
  // the command handler can emit AUTOMATION_RULE_TOGGLED for audit/UX.
  server.post<{ Params: { id: string } }>('/api/v1/automation-rules/:id/toggle', {
    schema: { tags: ['Automation Rules'], summary: 'Toggle an automation rule enabled/disabled' },
  }, async (request) => {
    const orgId = await resolveOrgId(request);
    if (!orgId) return { data: null, error: 'Organization not found' };

    const rule = await server.prisma.automationRule.findUnique({ where: { id: request.params.id } });
    if (!rule) return { data: null, error: 'Rule not found' };

    const result = await commandBus.dispatch({
      type: UPDATE_AUTOMATION_RULE,
      orgId,
      actorId: request.user?.sub ?? null,
      payload: { id: request.params.id, data: { enabled: !rule.enabled } },
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) return { data: null, error: result.error ?? 'Toggle failed' };

    const updated = await server.prisma.automationRule.findUnique({
      where: { id: request.params.id },
    });
    return { data: updated, error: null };
  });

  // ── GET /api/v1/automation-rules/:id/executions ──
  server.get<{ Params: { id: string }; Querystring: { limit?: string } }>('/api/v1/automation-rules/:id/executions', {
    schema: { tags: ['Automation Rules'], summary: 'Get execution log for a rule' },
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
  server.post<{ Params: { decisionId: string }; Body: { name?: string; priority?: number } }>('/api/v1/automation-rules/from-decision/:decisionId', {
    schema: {
      tags: ['Automation Rules'],
      summary: 'Create an automation rule from a promoted agent decision',
    },
  }, async (request, reply) => {
    const orgId = await resolveOrgId(request);
    if (!orgId) { reply.code(404); return { data: null, error: 'Organization not found' }; }

    const result = await commandBus.dispatch({
      type: PROMOTE_DECISION_TO_RULE,
      orgId,
      actorId: request.user?.sub ?? null,
      payload: {
        decisionId: request.params.decisionId,
        name: request.body?.name,
        priority: request.body?.priority,
      },
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) {
      const err = result.error ?? 'Promotion failed';
      const code = /not found/i.test(err) ? 404 : 400;
      reply.code(code);
      return { data: null, error: err };
    }

    const rule = await server.prisma.automationRule.findUnique({
      where: { id: (result.data as { ruleId: string }).ruleId },
    });
    reply.code(201);
    return { data: rule, error: null };
  });

  // ── POST /api/v1/automation-rules/:id/test ──
  // Pure dry-run evaluation against a sample event — no DB writes, stays
  // outside the command bus.
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

    const conditions = rule.conditions as unknown as RuleCondition[];
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
        eventPatternMatched:
          request.body.event.type === rule.eventPattern ||
          (rule.eventPattern.endsWith('.*') &&
            request.body.event.type.startsWith(rule.eventPattern.slice(0, -1))),
        conditionResults: result.details,
        allConditionsMatched: result.matched,
        wouldExecuteAction: result.matched,
        actionType: rule.actionType,
      },
      error: null,
    };
  });
};
