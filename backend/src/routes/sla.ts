/**
 * SLA API routes — policy CRUD, evaluation dashboard, entity-level SLA status.
 */

import { FastifyPluginAsync } from 'fastify';
import { container } from '../di/container.js';
import { TOKENS } from '../di/tokens.js';
import { ISlaRepository } from '../repositories/SlaRepository.js';
import { ISlaEvaluationService } from '../services/SlaEvaluationService.js';
import { CommandBus } from '../commands/CommandBus.js';
import { CREATE_SLA_POLICY } from '../commands/sla/CreateSlaPolicyCommand.js';
import { UPDATE_SLA_POLICY } from '../commands/sla/UpdateSlaPolicyCommand.js';
import { DEACTIVATE_SLA_POLICY } from '../commands/sla/DeactivateSlaPolicyCommand.js';
import { randomUUID } from 'crypto';

export const slaRoutes: FastifyPluginAsync = async (server) => {
  // ── Policy CRUD ──

  // GET /api/v1/sla/policies — list SLA policies
  server.get<{ Querystring: { customerId?: string } }>('/api/v1/sla/policies', {
    schema: {
      tags: ['SLA'],
      summary: 'List SLA policies',
      querystring: {
        type: 'object',
        properties: {
          customerId: { type: 'string', description: 'Filter by customer (omit for all, "null" for org-default only)' },
        },
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
    const slaRepo = container.resolve<ISlaRepository>(TOKENS.ISlaRepository);
    // TODO: orgId from auth context — using first org for now
    const org = await server.prisma.organization.findFirst();
    const orgId = org?.id || 'default';
    const customerId = request.query.customerId === 'null' ? undefined : request.query.customerId;
    const policies = await slaRepo.findPolicies(orgId, customerId);
    return { data: policies, error: null };
  });

  // GET /api/v1/sla/policies/:id — get single policy with rules
  server.get<{ Params: { id: string } }>('/api/v1/sla/policies/:id', {
    schema: {
      tags: ['SLA'],
      summary: 'Get SLA policy by ID',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: 'object', nullable: true },
            error: { type: 'string', nullable: true },
          },
        },
      },
    },
  }, async (request, reply) => {
    const slaRepo = container.resolve<ISlaRepository>(TOKENS.ISlaRepository);
    const policy = await slaRepo.findPolicyById(request.params.id);
    if (!policy) {
      reply.status(404);
      return { data: null, error: 'SLA policy not found' };
    }
    return { data: policy, error: null };
  });

  // POST /api/v1/sla/policies — create a new policy with rules
  server.post<{ Body: any }>('/api/v1/sla/policies', {
    schema: {
      tags: ['SLA'],
      summary: 'Create SLA policy with rules',
      body: {
        type: 'object',
        required: ['name', 'rules'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          customerId: { type: 'string', nullable: true },
          active: { type: 'boolean' },
          rules: {
            type: 'array',
            items: {
              type: 'object',
              required: ['ruleType', 'name'],
              properties: {
                ruleType: { type: 'string', enum: ['eta_delivery', 'issue_response', 'issue_resolution', 'dwell_time', 'light_event', 'seal_event', 'temperature_excursion', 'temperature_out_of_range'] },
                name: { type: 'string' },
                description: { type: 'string' },
                active: { type: 'boolean' },
                warningThresholdMinutes: { type: 'integer', nullable: true },
                breachThresholdMinutes: { type: 'integer', nullable: true },
                criticalThresholdMinutes: { type: 'integer', nullable: true },
                issuePriority: { type: 'string', nullable: true },
                issueCategory: { type: 'string', nullable: true },
                maxDeliveryMinutes: { type: 'integer', nullable: true },
                maxDwellMinutes: { type: 'integer', nullable: true },
                dwellLocationType: { type: 'string', nullable: true },
                maxOccurrences: { type: 'integer', nullable: true },
                maxExcursionMinutes: { type: 'integer', nullable: true },
                autoCreateIssue: { type: 'boolean' },
                issuePriorityOnBreach: { type: 'string' },
              },
            },
          },
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
      type: CREATE_SLA_POLICY,
      orgId,
      actorId: null,
      payload: request.body,
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.status(400);
      return { data: null, error: result.error };
    }
    return { data: result.data, error: null };
  });

  // PUT /api/v1/sla/policies/:id — update a policy and its rules
  server.put<{ Params: { id: string }; Body: any }>('/api/v1/sla/policies/:id', {
    schema: {
      tags: ['SLA'],
      summary: 'Update SLA policy',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          active: { type: 'boolean' },
          rules: { type: 'array', items: { type: 'object' } },
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
      type: UPDATE_SLA_POLICY,
      orgId,
      actorId: null,
      payload: { id: request.params.id, ...(request.body as Record<string, unknown>) },
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.status(400);
      return { data: null, error: result.error };
    }
    return { data: result.data, error: null };
  });

  // DELETE /api/v1/sla/policies/:id — deactivate a policy
  server.delete<{ Params: { id: string } }>('/api/v1/sla/policies/:id', {
    schema: {
      tags: ['SLA'],
      summary: 'Deactivate SLA policy',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
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
      type: DEACTIVATE_SLA_POLICY,
      orgId,
      actorId: null,
      payload: { id: request.params.id },
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.status(400);
      return { data: null, error: result.error };
    }
    return { data: result.data, error: null };
  });

  // POST /api/v1/sla/policies/:id/clone — clone an org policy as a customer override
  server.post<{ Params: { id: string }; Body: { customerId: string; name?: string } }>('/api/v1/sla/policies/:id/clone', {
    schema: {
      tags: ['SLA'],
      summary: 'Clone SLA policy as customer override',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      body: {
        type: 'object',
        required: ['customerId'],
        properties: {
          customerId: { type: 'string' },
          name: { type: 'string' },
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
    const slaRepo = container.resolve<ISlaRepository>(TOKENS.ISlaRepository);
    const commandBus = container.resolve<CommandBus>(TOKENS.ICommandBus);

    const source = await slaRepo.findPolicyById(request.params.id);
    if (!source) {
      reply.status(404);
      return { data: null, error: 'Source policy not found' };
    }

    const org = await server.prisma.organization.findFirst();
    const orgId = org?.id || 'default';

    // Clone the policy with customer override
    const rules = source.rules.map((r: any) => ({
      ruleType: r.ruleType,
      name: r.name,
      description: r.description,
      active: r.active,
      warningThresholdMinutes: r.warningThresholdMinutes,
      breachThresholdMinutes: r.breachThresholdMinutes,
      criticalThresholdMinutes: r.criticalThresholdMinutes,
      issuePriority: r.issuePriority,
      issueCategory: r.issueCategory,
      maxDeliveryMinutes: r.maxDeliveryMinutes,
      maxDwellMinutes: r.maxDwellMinutes,
      dwellLocationType: r.dwellLocationType,
      maxOccurrences: r.maxOccurrences,
      maxExcursionMinutes: r.maxExcursionMinutes,
      autoCreateIssue: r.autoCreateIssue,
      issuePriorityOnBreach: r.issuePriorityOnBreach,
    }));

    const result = await commandBus.dispatch({
      type: CREATE_SLA_POLICY,
      orgId,
      actorId: null,
      payload: {
        name: request.body.name || `${source.name} (${request.body.customerId})`,
        description: source.description,
        customerId: request.body.customerId,
        rules,
      },
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.status(400);
      return { data: null, error: result.error };
    }
    return { data: result.data, error: null };
  });

  // ── Evaluation Dashboard ──

  // GET /api/v1/sla/evaluations — list SLA evaluations with filtering
  server.get<{
    Querystring: {
      status?: string;
      ruleType?: string;
      entityType?: string;
      customerId?: string;
      page?: string;
      limit?: string;
    };
  }>('/api/v1/sla/evaluations', {
    schema: {
      tags: ['SLA'],
      summary: 'List SLA evaluations',
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Comma-separated: active,warning,breached,met' },
          ruleType: { type: 'string', description: 'Comma-separated rule types' },
          entityType: { type: 'string', enum: ['shipment', 'issue'] },
          customerId: { type: 'string' },
          page: { type: 'string' },
          limit: { type: 'string' },
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
                page: { type: 'number' },
                limit: { type: 'number' },
              },
            },
            error: { type: 'string', nullable: true },
          },
        },
      },
    },
  }, async (request) => {
    const slaRepo = container.resolve<ISlaRepository>(TOKENS.ISlaRepository);
    const org = await server.prisma.organization.findFirst();
    const orgId = org?.id || 'default';

    const page = parseInt(request.query.page || '1', 10);
    const limit = parseInt(request.query.limit || '50', 10);

    const result = await slaRepo.findEvaluations({
      orgId,
      status: request.query.status?.split(','),
      ruleType: request.query.ruleType?.split(','),
      entityType: request.query.entityType,
      customerId: request.query.customerId,
      page,
      limit,
    });

    return {
      data: { ...result, page, limit },
      error: null,
    };
  });

  // GET /api/v1/sla/evaluations/summary — aggregate SLA health stats
  server.get('/api/v1/sla/evaluations/summary', {
    schema: {
      tags: ['SLA'],
      summary: 'SLA evaluation summary (counts by status)',
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                active: { type: 'number' },
                warning: { type: 'number' },
                breached: { type: 'number' },
                met: { type: 'number' },
                total: { type: 'number' },
              },
            },
            error: { type: 'string', nullable: true },
          },
        },
      },
    },
  }, async () => {
    const slaRepo = container.resolve<ISlaRepository>(TOKENS.ISlaRepository);
    const org = await server.prisma.organization.findFirst();
    const orgId = org?.id || 'default';
    const summary = await slaRepo.getEvaluationSummary(orgId);
    return { data: summary, error: null };
  });

  // ── Entity-Level SLA Status ──

  // GET /api/v1/shipments/:id/sla — get SLA evaluations for a shipment
  server.get<{ Params: { id: string } }>('/api/v1/shipments/:id/sla', {
    schema: {
      tags: ['SLA'],
      summary: 'Get SLA evaluations for a shipment',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
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
    const slaRepo = container.resolve<ISlaRepository>(TOKENS.ISlaRepository);
    const evaluations = await slaRepo.findEvaluationsByEntity('shipment', request.params.id);
    return { data: evaluations, error: null };
  });

  // GET /api/v1/issues/:id/sla — get SLA evaluations for an issue
  server.get<{ Params: { id: string } }>('/api/v1/issues/:id/sla', {
    schema: {
      tags: ['SLA'],
      summary: 'Get SLA evaluations for an issue',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
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
    const slaRepo = container.resolve<ISlaRepository>(TOKENS.ISlaRepository);
    const evaluations = await slaRepo.findEvaluationsByEntity('issue', request.params.id);
    return { data: evaluations, error: null };
  });

  // POST /api/v1/sla/sweep — manually trigger a breach detection sweep
  server.post('/api/v1/sla/sweep', {
    schema: {
      tags: ['SLA'],
      summary: 'Manually trigger SLA breach detection sweep',
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
    try {
      const slaService = container.resolve<ISlaEvaluationService>(TOKENS.ISlaEvaluationService);
      const result = await slaService.runBreachSweep();
      return { data: result, error: null };
    } catch (err) {
      reply.status(500);
      return { data: null, error: (err as Error).message };
    }
  });
};
