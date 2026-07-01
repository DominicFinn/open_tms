/**
 * Agent Decision API routes — decision logging for AI compliance & audit.
 *
 * The core "decision endpoint" that agents call to log their decisions,
 * plus list/detail/outcome/stats endpoints for review and automation discovery.
 */

import { FastifyPluginAsync } from 'fastify';
import { container } from '../di/container.js';
import { TOKENS } from '../di/tokens.js';
import { IAgentDecisionRepository } from '../repositories/AgentDecisionRepository.js';
import { CommandBus } from '../commands/CommandBus.js';
import { CREATE_AGENT_DECISION } from '../commands/agentDecisions/CreateAgentDecisionCommand.js';
import { RECORD_DECISION_OUTCOME } from '../commands/agentDecisions/RecordDecisionOutcomeCommand.js';
import { randomUUID } from 'crypto';

import { guardWrites } from '../auth/guardWrites.js';

export const agentDecisionRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', guardWrites('agent_decisions'));

  // ── POST /api/v1/agent-decisions — Log a new agent decision ──

  server.post('/api/v1/agent-decisions', {
    schema: {
      tags: ['Agent Decisions'],
      summary: 'Log a new AI agent decision',
      description: 'The core decision endpoint agents call to log decisions for compliance and audit.',
      body: {
        type: 'object',
        required: ['agentType', 'triggerType', 'summary', 'reasoning', 'context', 'actionType'],
        properties: {
          agentType: { type: 'string', description: 'Agent type: triage, quality_analysis, route_optimization, etc.' },
          modelProvider: { type: 'string', nullable: true, description: 'LLM provider: anthropic, openai, etc.' },
          modelId: { type: 'string', nullable: true, description: 'Model ID: claude-sonnet-4-20250514, gpt-4o, etc.' },
          triggerType: { type: 'string', description: 'What triggered this: domain_event, schedule, manual, api' },
          triggerEventType: { type: 'string', nullable: true, description: 'Domain event type that triggered this' },
          triggerEventId: { type: 'string', nullable: true, description: 'DomainEventLog.id of triggering event' },
          entityType: { type: 'string', nullable: true, description: 'Entity type: shipment, order, issue, etc.' },
          entityId: { type: 'string', nullable: true, description: 'Entity ID' },
          summary: { type: 'string', description: 'Short human-readable summary of the decision' },
          reasoning: { type: 'string', description: 'Full reasoning chain from the agent' },
          context: { type: 'object', description: 'Snapshot of data the agent had when deciding' },
          conversationLog: {
            type: 'array', nullable: true,
            items: { type: 'object', properties: { role: { type: 'string' }, content: { type: 'string' } } },
            description: 'Raw LLM message exchange for audit',
          },
          confidence: { type: 'number', nullable: true, minimum: 0, maximum: 1, description: 'Confidence score 0.0-1.0' },
          actionType: { type: 'string', description: 'Action taken: create_issue, escalate_issue, change_priority, notify, no_action, etc.' },
          actionPayload: { type: 'object', nullable: true, description: 'Details of the action taken' },
          actionEntityType: { type: 'string', nullable: true, description: 'Entity type created/modified by the action' },
          actionEntityId: { type: 'string', nullable: true, description: 'Entity ID created/modified by the action' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            data: { type: 'object' },
            error: { type: 'string', nullable: true },
          },
        },
      },
    },
  }, async (request, reply) => {
    const commandBus = container.resolve<CommandBus>(TOKENS.ICommandBus);
    const org = await server.prisma.organization.findFirst();
    const orgId = org?.id || 'default';

    const result = await commandBus.dispatch({
      type: CREATE_AGENT_DECISION,
      orgId,
      actorId: null,
      payload: request.body as Record<string, unknown>,
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error };
    }

    const repo = container.resolve<IAgentDecisionRepository>(TOKENS.IAgentDecisionRepository);
    const decision = await repo.findById(result.data!.id);

    reply.code(201);
    return { data: decision, error: null };
  });

  // ── GET /api/v1/agent-decisions/stats — Aggregated decision stats ──
  // Registered before /:id to avoid path collision.

  server.get('/api/v1/agent-decisions/stats', {
    schema: {
      tags: ['Agent Decisions'],
      summary: 'Get aggregated agent decision statistics',
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: 'object' },
            error: { type: 'string', nullable: true },
          },
        },
      },
    },
  }, async () => {
    const repo = container.resolve<IAgentDecisionRepository>(TOKENS.IAgentDecisionRepository);
    const org = await server.prisma.organization.findFirst();
    const orgId = org?.id || 'default';
    const stats = await repo.getStats(orgId);
    return { data: stats, error: null };
  });

  // ── GET /api/v1/agent-decisions/usage — Daily usage breakdown for charts ──

  server.get<{ Querystring: { days?: string } }>('/api/v1/agent-decisions/usage', {
    schema: {
      tags: ['Agent Decisions'],
      summary: 'Get daily agent usage breakdown (invocations, tokens) for charting',
      querystring: {
        type: 'object',
        properties: { days: { type: 'string', description: 'Number of days to look back (default: 30)' } },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: 'array', items: { type: 'object' } },
            error: { type: 'string', nullable: true },
          },
        },
      },
    },
  }, async (request) => {
    const repo = container.resolve<IAgentDecisionRepository>(TOKENS.IAgentDecisionRepository);
    const org = await server.prisma.organization.findFirst();
    const orgId = org?.id || 'default';
    const days = request.query.days ? parseInt(request.query.days, 10) : 30;
    const usage = await repo.getDailyUsage(orgId, days);
    return { data: usage, error: null };
  });

  // ── GET /api/v1/agent-decisions — List decisions with filters ──

  server.get<{
    Querystring: {
      agentType?: string;
      entityType?: string;
      entityId?: string;
      actionType?: string;
      outcomeStatus?: string;
      triggerEventType?: string;
      promotedToAutomation?: string;
      dateFrom?: string;
      dateTo?: string;
      limit?: string;
      offset?: string;
    };
  }>('/api/v1/agent-decisions', {
    schema: {
      tags: ['Agent Decisions'],
      summary: 'List agent decisions with filters',
      querystring: {
        type: 'object',
        properties: {
          agentType: { type: 'string' },
          entityType: { type: 'string' },
          entityId: { type: 'string' },
          actionType: { type: 'string' },
          outcomeStatus: { type: 'string' },
          triggerEventType: { type: 'string' },
          promotedToAutomation: { type: 'string', enum: ['true', 'false'] },
          dateFrom: { type: 'string', format: 'date-time' },
          dateTo: { type: 'string', format: 'date-time' },
          limit: { type: 'string' },
          offset: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                items: { type: 'array', items: { type: 'object' } },
                total: { type: 'number' },
              },
            },
            error: { type: 'string', nullable: true },
          },
        },
      },
    },
  }, async (request) => {
    const repo = container.resolve<IAgentDecisionRepository>(TOKENS.IAgentDecisionRepository);
    const org = await server.prisma.organization.findFirst();
    const orgId = org?.id || 'default';

    const q = request.query;
    const result = await repo.findAll({
      orgId,
      agentType: q.agentType,
      entityType: q.entityType,
      entityId: q.entityId,
      actionType: q.actionType,
      outcomeStatus: q.outcomeStatus,
      triggerEventType: q.triggerEventType,
      promotedToAutomation: q.promotedToAutomation === 'true' ? true : q.promotedToAutomation === 'false' ? false : undefined,
      dateFrom: q.dateFrom,
      dateTo: q.dateTo,
      limit: q.limit ? parseInt(q.limit, 10) : undefined,
      offset: q.offset ? parseInt(q.offset, 10) : undefined,
    });

    return { data: result, error: null };
  });

  // ── GET /api/v1/agent-decisions/:id — Decision detail ──

  server.get<{ Params: { id: string } }>('/api/v1/agent-decisions/:id', {
    schema: {
      tags: ['Agent Decisions'],
      summary: 'Get agent decision detail (includes full reasoning, context, conversation log)',
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: 'object' },
            error: { type: 'string', nullable: true },
          },
        },
      },
    },
  }, async (request, reply) => {
    const repo = container.resolve<IAgentDecisionRepository>(TOKENS.IAgentDecisionRepository);
    const decision = await repo.findById(request.params.id);
    if (!decision) {
      reply.code(404);
      return { data: null, error: 'Decision not found' };
    }
    return { data: decision, error: null };
  });

  // ── PUT /api/v1/agent-decisions/:id/outcome — Record decision outcome ──

  server.put<{
    Params: { id: string };
    Body: { outcomeStatus: string; outcomeNotes?: string };
  }>('/api/v1/agent-decisions/:id/outcome', {
    schema: {
      tags: ['Agent Decisions'],
      summary: 'Record the outcome of a decision (human review)',
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      body: {
        type: 'object',
        required: ['outcomeStatus'],
        properties: {
          outcomeStatus: { type: 'string', enum: ['correct', 'incorrect', 'partially_correct'] },
          outcomeNotes: { type: 'string', nullable: true },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: 'object' },
            error: { type: 'string', nullable: true },
          },
        },
      },
    },
  }, async (request, reply) => {
    const commandBus = container.resolve<CommandBus>(TOKENS.ICommandBus);
    const org = await server.prisma.organization.findFirst();
    const orgId = org?.id || 'default';

    const result = await commandBus.dispatch({
      type: RECORD_DECISION_OUTCOME,
      orgId,
      actorId: null,
      payload: { id: request.params.id, ...request.body },
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error };
    }

    const repo = container.resolve<IAgentDecisionRepository>(TOKENS.IAgentDecisionRepository);
    const decision = await repo.findById(request.params.id);
    return { data: decision, error: null };
  });

  // Note: Promote flow uses POST /api/v1/automation-rules/from-decision/:id instead.
  // That endpoint creates a full automation rule with conditions pre-filled from the decision.
};
