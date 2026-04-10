/**
 * Issue Routes — Triage Centre / Visibility Tower
 *
 * GET    /api/v1/issues                — list issues (filterable by status, severity, assignee)
 * GET    /api/v1/issues/stats          — counts per status column
 * POST   /api/v1/issues                — create issue
 * GET    /api/v1/issues/:id            — get issue with comments
 * PATCH  /api/v1/issues/:id            — update issue fields
 * POST   /api/v1/issues/:id/transition — change status (kanban column move)
 * POST   /api/v1/issues/:id/comments   — add comment
 */

import { FastifyInstance } from 'fastify';
import { container } from '../di/container.js';
import { TOKENS } from '../di/tokens.js';
import { IIssuesRepository } from '../repositories/IssuesRepository.js';
import { IEventBus } from '../events/IEventBus.js';
import { EVENT_TYPES } from '../events/eventTypes.js';
import { createEvent } from '../events/createEvent.js';

export async function issueRoutes(server: FastifyInstance) {
  const prefix = '/api/v1/issues';

  // List issues
  server.get(prefix, {
    schema: {
      tags: ['Triage'],
      summary: 'List issues',
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          severity: { type: 'string' },
          assigneeId: { type: 'string' },
          shipmentId: { type: 'string' },
          orderId: { type: 'string' },
          category: { type: 'string' },
          limit: { type: 'integer', default: 100 },
          offset: { type: 'integer', default: 0 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                issues: { type: 'array', items: { type: 'object' } },
                total: { type: 'integer' },
              },
            },
            error: { type: 'string', nullable: true },
          },
        },
      },
    },
  }, async (request) => {
    const repo = container.resolve<IIssuesRepository>(TOKENS.IIssuesRepository);
    const query = request.query as any;
    const result = await repo.findAll({
      status: query.status,
      severity: query.severity,
      assigneeId: query.assigneeId,
      shipmentId: query.shipmentId,
      orderId: query.orderId,
      category: query.category,
      limit: query.limit,
      offset: query.offset,
    });
    return { data: result, error: null };
  });

  // Stats (counts per status)
  server.get(`${prefix}/stats`, {
    schema: {
      tags: ['Triage'],
      summary: 'Issue counts by status',
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
    const counts = await server.prisma.issue.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    const stats: Record<string, number> = { new: 0, investigating: 0, escalated: 0, resolved: 0, closed: 0 };
    for (const row of counts) {
      stats[row.status] = row._count.id;
    }

    return { data: stats, error: null };
  });

  // Get single issue with comments
  server.get(`${prefix}/:id`, {
    schema: {
      tags: ['Triage'],
      summary: 'Get issue by ID',
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
    const repo = container.resolve<IIssuesRepository>(TOKENS.IIssuesRepository);
    const { id } = request.params as any;
    const issue = await repo.findById(id);
    if (!issue) {
      return reply.status(404).send({ data: null, error: 'Issue not found' });
    }
    return { data: issue, error: null };
  });

  // Create issue
  server.post(prefix, {
    schema: {
      tags: ['Triage'],
      summary: 'Create a new issue',
      body: {
        type: 'object',
        required: ['title', 'orgId'],
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          orgId: { type: 'string' },
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          category: { type: 'string' },
          shipmentId: { type: 'string' },
          orderId: { type: 'string' },
          carrierId: { type: 'string' },
          customerId: { type: 'string' },
          assigneeId: { type: 'string' },
          assigneeName: { type: 'string' },
          slaDeadline: { type: 'string', format: 'date-time' },
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
    const repo = container.resolve<IIssuesRepository>(TOKENS.IIssuesRepository);
    const body = request.body as any;

    const issue = await repo.create({
      ...body,
      slaDeadline: body.slaDeadline ? new Date(body.slaDeadline) : undefined,
      createdBy: request.user?.sub,
    });

    // Publish domain event
    try {
      const eventBus = container.resolve<IEventBus>(TOKENS.IEventBus);
      await eventBus.publish(createEvent({
        type: EVENT_TYPES.TRIAGE_ISSUE_CREATED,
        orgId: body.orgId,
        actorId: request.user?.sub,
        entityType: 'issue',
        entityId: issue.id,
        payload: { issueNumber: issue.issueNumber, title: issue.title, severity: issue.severity, category: issue.category },
      }));
    } catch {
      // Event publishing failure shouldn't block issue creation
    }

    return reply.status(201).send({ data: issue, error: null });
  });

  // Update issue
  server.patch(`${prefix}/:id`, {
    schema: {
      tags: ['Triage'],
      summary: 'Update issue fields',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      body: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          category: { type: 'string' },
          assigneeId: { type: 'string' },
          assigneeName: { type: 'string' },
          slaDeadline: { type: 'string', format: 'date-time' },
          slaBreach: { type: 'boolean' },
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
    const repo = container.resolve<IIssuesRepository>(TOKENS.IIssuesRepository);
    const { id } = request.params as any;
    const body = request.body as any;

    try {
      const issue = await repo.update(id, {
        ...body,
        slaDeadline: body.slaDeadline ? new Date(body.slaDeadline) : undefined,
      });

      // Publish assignment event if assignee changed
      if (body.assigneeId) {
        try {
          const eventBus = container.resolve<IEventBus>(TOKENS.IEventBus);
          await eventBus.publish(createEvent({
            type: EVENT_TYPES.TRIAGE_ISSUE_ASSIGNED,
            orgId: issue.orgId,
            actorId: request.user?.sub,
            entityType: 'issue',
            entityId: issue.id,
            payload: { issueNumber: issue.issueNumber, assigneeId: body.assigneeId, assigneeName: body.assigneeName },
          }));
        } catch {
          // Non-blocking
        }
      }

      return { data: issue, error: null };
    } catch {
      return reply.status(404).send({ data: null, error: 'Issue not found' });
    }
  });

  // Transition status (kanban column move)
  server.post(`${prefix}/:id/transition`, {
    schema: {
      tags: ['Triage'],
      summary: 'Transition issue status (kanban column move)',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      body: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['new', 'investigating', 'escalated', 'resolved', 'closed'] },
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
    const repo = container.resolve<IIssuesRepository>(TOKENS.IIssuesRepository);
    const { id } = request.params as any;
    const { status } = request.body as any;

    try {
      const issue = await repo.transition(id, status);

      // Publish status changed / escalated events
      try {
        const eventBus = container.resolve<IEventBus>(TOKENS.IEventBus);
        const eventType = status === 'escalated'
          ? EVENT_TYPES.TRIAGE_ISSUE_ESCALATED
          : EVENT_TYPES.TRIAGE_ISSUE_STATUS_CHANGED;

        await eventBus.publish(createEvent({
          type: eventType,
          orgId: issue.orgId,
          actorId: request.user?.sub,
          entityType: 'issue',
          entityId: issue.id,
          payload: { issueNumber: issue.issueNumber, newStatus: status },
        }));
      } catch {
        // Non-blocking
      }

      return { data: issue, error: null };
    } catch {
      return reply.status(404).send({ data: null, error: 'Issue not found' });
    }
  });

  // Add comment
  server.post(`${prefix}/:id/comments`, {
    schema: {
      tags: ['Triage'],
      summary: 'Add a comment to an issue',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      body: {
        type: 'object',
        required: ['body', 'authorName'],
        properties: {
          body: { type: 'string' },
          authorName: { type: 'string' },
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
    const repo = container.resolve<IIssuesRepository>(TOKENS.IIssuesRepository);
    const { id } = request.params as any;
    const { body: commentBody, authorName } = request.body as any;

    const comment = await repo.addComment({
      issueId: id,
      authorId: request.user?.sub,
      authorName,
      body: commentBody,
    });

    return reply.status(201).send({ data: comment, error: null });
  });
}
