/**
 * Issue Routes — Triage Centre / Visibility Tower
 *
 * GET    /api/v1/issues                   — list issues (filterable, sortable, searchable)
 * GET    /api/v1/issues/stats             — counts per status + priority breakdown, noise, SLA, avg resolution
 * GET    /api/v1/issues/signal            — signal dashboard aggregation
 * GET    /api/v1/issues/spot-check        — resolved issues with activity for QA review
 * GET    /api/v1/issues/actionable        — agent-friendly: unassigned high-signal issues
 * POST   /api/v1/issues                   — create issue
 * POST   /api/v1/issues/batch/transition  — batch status transition
 * POST   /api/v1/issues/batch/assign      — batch assign
 * POST   /api/v1/issues/batch/dismiss-noise — batch dismiss as noise
 * GET    /api/v1/issues/:id               — get issue with comments
 * PATCH  /api/v1/issues/:id               — update issue fields
 * POST   /api/v1/issues/:id/transition    — change status (kanban column move)
 * POST   /api/v1/issues/:id/comments      — add comment
 * POST   /api/v1/issues/:id/resolve       — resolve with notes
 * GET    /api/v1/issues/:id/timeline      — activity timeline
 * GET    /api/v1/issues/:id/context       — rich context (shipment, order, sensors, devices)
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

  // ── List issues (enhanced filtering, sorting, search) ──────────────
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
          priority: { type: 'integer' },
          customerId: { type: 'string' },
          carrierId: { type: 'string' },
          laneId: { type: 'string' },
          region: { type: 'string' },
          isNoise: { type: 'boolean' },
          signalScoreMin: { type: 'integer' },
          dateFrom: { type: 'string', format: 'date-time' },
          dateTo: { type: 'string', format: 'date-time' },
          search: { type: 'string' },
          sortBy: { type: 'string', enum: ['createdAt', 'updatedAt', 'priority', 'severity', 'signalScore', 'slaDeadline'] },
          sortOrder: { type: 'string', enum: ['asc', 'desc'] },
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
    const query = request.query as any;

    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.severity) where.severity = query.severity;
    if (query.assigneeId) where.assigneeId = query.assigneeId;
    if (query.shipmentId) where.shipmentId = query.shipmentId;
    if (query.orderId) where.orderId = query.orderId;
    if (query.category) where.category = query.category;
    if (query.priority !== undefined) where.priority = query.priority;
    if (query.customerId) where.customerId = query.customerId;
    if (query.carrierId) where.carrierId = query.carrierId;
    if (query.laneId) where.laneId = query.laneId;
    if (query.region) where.region = query.region;
    if (query.isNoise !== undefined) where.isNoise = query.isNoise;
    if (query.signalScoreMin !== undefined) where.signalScore = { gte: query.signalScoreMin };

    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
      if (query.dateTo) where.createdAt.lte = new Date(query.dateTo);
    }

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { issueNumber: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'desc';

    const [issues, total] = await Promise.all([
      server.prisma.issue.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        take: query.limit || 100,
        skip: query.offset || 0,
        include: { comments: { orderBy: { createdAt: 'desc' }, take: 1 } },
      }),
      server.prisma.issue.count({ where }),
    ]);

    return { data: { issues, total }, error: null };
  });

  // ── Stats (enhanced: status + priority + noise + avg resolution + SLA) ─
  server.get(`${prefix}/stats`, {
    schema: {
      tags: ['Triage'],
      summary: 'Issue statistics — status counts, priority breakdown, noise, SLA breaches, avg resolution time',
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
    const [statusCounts, priorityCounts, noiseResult, slaBreachResult, resolutionAvg] = await Promise.all([
      server.prisma.issue.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      server.prisma.issue.groupBy({
        by: ['priority'],
        _count: { id: true },
      }),
      server.prisma.issue.count({ where: { isNoise: true } }),
      server.prisma.issue.count({ where: { slaBreach: true } }),
      server.prisma.issue.aggregate({
        _avg: { timeToResolution: true },
        where: { status: 'resolved', timeToResolution: { not: null } },
      }),
    ]);

    const byStatus: Record<string, number> = { new: 0, investigating: 0, escalated: 0, resolved: 0, closed: 0 };
    for (const row of statusCounts) {
      byStatus[row.status] = row._count.id;
    }

    const byPriority: Record<number, number> = {};
    for (const row of priorityCounts) {
      byPriority[row.priority] = row._count.id;
    }

    return {
      data: {
        byStatus,
        byPriority,
        noiseCount: noiseResult,
        avgResolutionTimeMinutes: resolutionAvg._avg.timeToResolution ?? null,
        slaBreachCount: slaBreachResult,
      },
      error: null,
    };
  });

  // ── Signal dashboard aggregation ──────────────────────────────────
  server.get(`${prefix}/signal`, {
    schema: {
      tags: ['Triage'],
      summary: 'Signal dashboard — category breakdown, recurring patterns, SLA, noise ratio',
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
    const [
      byCategory,
      byStatus,
      recurringByCarrier,
      recurringByCustomer,
      slaBreaches,
      noiseCount,
      signalCount,
      avgSignalScoreResult,
    ] = await Promise.all([
      // Group by category (exclude noise)
      server.prisma.issue.groupBy({
        by: ['category'],
        _count: { id: true },
        where: { isNoise: false, category: { not: null } },
        orderBy: { _count: { id: 'desc' } },
      }),
      // Count by status
      server.prisma.issue.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      // Recurring by carrier (category+carrierId) — top 10
      server.prisma.issue.groupBy({
        by: ['category', 'carrierId'],
        _count: { id: true },
        where: { isNoise: false, carrierId: { not: null }, category: { not: null } },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
      // Recurring by customer (category+customerId) — top 10
      server.prisma.issue.groupBy({
        by: ['category', 'customerId'],
        _count: { id: true },
        where: { isNoise: false, customerId: { not: null }, category: { not: null } },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
      // SLA breaches
      server.prisma.issue.count({ where: { slaBreach: true } }),
      // Noise count
      server.prisma.issue.count({ where: { isNoise: true } }),
      // Signal count (non-noise)
      server.prisma.issue.count({ where: { isNoise: false } }),
      // Avg signal score for open issues (not resolved/closed)
      server.prisma.issue.aggregate({
        _avg: { signalScore: true },
        where: { status: { notIn: ['resolved', 'closed'] } },
      }),
    ]);

    return {
      data: {
        byCategory: byCategory.map((r) => ({ category: r.category, count: r._count.id })),
        byStatus: byStatus.map((r) => ({ status: r.status, count: r._count.id })),
        recurringByCarrier: recurringByCarrier.map((r) => ({
          category: r.category,
          carrierId: r.carrierId,
          count: r._count.id,
        })),
        recurringByCustomer: recurringByCustomer.map((r) => ({
          category: r.category,
          customerId: r.customerId,
          count: r._count.id,
        })),
        slaBreaches,
        noiseCount,
        signalCount,
        avgSignalScore: avgSignalScoreResult._avg.signalScore ?? null,
      },
      error: null,
    };
  });

  // ── Spot-check: resolved issues with activity ─────────────────────
  server.get(`${prefix}/spot-check`, {
    schema: {
      tags: ['Triage'],
      summary: 'Resolved issues with activity — for QA spot-checking',
      querystring: {
        type: 'object',
        properties: {
          dateFrom: { type: 'string', format: 'date-time' },
          dateTo: { type: 'string', format: 'date-time' },
          resolvedBy: { type: 'string' },
          category: { type: 'string' },
          severity: { type: 'string' },
          limit: { type: 'integer', default: 50 },
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
    const query = request.query as any;

    const where: any = {
      status: 'resolved',
      activityCount: { gt: 0 },
    };

    if (query.dateFrom || query.dateTo) {
      where.resolvedAt = {};
      if (query.dateFrom) where.resolvedAt.gte = new Date(query.dateFrom);
      if (query.dateTo) where.resolvedAt.lte = new Date(query.dateTo);
    }
    if (query.resolvedBy) where.resolvedBy = query.resolvedBy;
    if (query.category) where.category = query.category;
    if (query.severity) where.severity = query.severity;

    const [issues, total] = await Promise.all([
      server.prisma.issue.findMany({
        where,
        orderBy: { resolvedAt: 'desc' },
        take: query.limit || 50,
        skip: query.offset || 0,
        include: {
          comments: { orderBy: { createdAt: 'desc' }, take: 1 },
          activities: { orderBy: { createdAt: 'desc' }, take: 1 },
          _count: { select: { comments: true } },
        },
      }),
      server.prisma.issue.count({ where }),
    ]);

    return { data: { issues, total }, error: null };
  });

  // ── Actionable: agent-friendly high-signal issues ─────────────────
  server.get(`${prefix}/actionable`, {
    schema: {
      tags: ['Triage'],
      summary: 'Unassigned, non-noise issues with high signal score — ready for agent pickup',
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', default: 20 },
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
    const query = request.query as any;

    const issues = await server.prisma.issue.findMany({
      where: {
        assigneeId: null,
        isNoise: false,
        signalScore: { gte: 50 },
        status: { notIn: ['resolved', 'closed'] },
      },
      orderBy: [
        { priority: 'asc' },
        { signalScore: 'desc' },
      ],
      take: query.limit || 20,
      select: {
        id: true,
        issueNumber: true,
        title: true,
        category: true,
        severity: true,
        priority: true,
        signalScore: true,
        shipmentId: true,
        orderId: true,
        status: true,
        slaDeadline: true,
        slaBreach: true,
        createdAt: true,
      },
    });

    return { data: issues, error: null };
  });

  // ── Create issue ──────────────────────────────────────────────────
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

  // ── Batch: transition ─────────────────────────────────────────────
  server.post(`${prefix}/batch/transition`, {
    schema: {
      tags: ['Triage'],
      summary: 'Batch transition issues to a new status',
      body: {
        type: 'object',
        required: ['issueIds', 'status'],
        properties: {
          issueIds: { type: 'array', items: { type: 'string' } },
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
  }, async (request) => {
    const { issueIds, status } = request.body as any;
    const now = new Date();
    const actorId = request.user?.sub;

    const updateData: any = { status, updatedAt: now };
    if (status === 'escalated') updateData.escalatedAt = now;
    if (status === 'resolved') updateData.resolvedAt = now;
    if (status === 'closed') updateData.closedAt = now;

    await server.prisma.issue.updateMany({
      where: { id: { in: issueIds } },
      data: updateData,
    });

    // Create activity records for each issue
    await server.prisma.issueActivity.createMany({
      data: issueIds.map((issueId: string) => ({
        issueId,
        actorId,
        actorName: actorId || 'system',
        action: 'status_changed',
        details: { to: status },
        createdAt: now,
      })),
    });

    // Publish events (non-blocking)
    try {
      const eventBus = container.resolve<IEventBus>(TOKENS.IEventBus);
      const issues = await server.prisma.issue.findMany({
        where: { id: { in: issueIds } },
        select: { id: true, orgId: true, issueNumber: true },
      });
      for (const issue of issues) {
        await eventBus.publish(createEvent({
          type: EVENT_TYPES.TRIAGE_ISSUE_STATUS_CHANGED,
          orgId: issue.orgId,
          actorId,
          entityType: 'issue',
          entityId: issue.id,
          payload: { issueNumber: issue.issueNumber, newStatus: status },
        }));
      }
    } catch {
      // Non-blocking
    }

    return { data: { count: issueIds.length }, error: null };
  });

  // ── Batch: assign ─────────────────────────────────────────────────
  server.post(`${prefix}/batch/assign`, {
    schema: {
      tags: ['Triage'],
      summary: 'Batch assign issues to an agent',
      body: {
        type: 'object',
        required: ['issueIds', 'assigneeId', 'assigneeName'],
        properties: {
          issueIds: { type: 'array', items: { type: 'string' } },
          assigneeId: { type: 'string' },
          assigneeName: { type: 'string' },
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
  }, async (request) => {
    const { issueIds, assigneeId, assigneeName } = request.body as any;
    const now = new Date();
    const actorId = request.user?.sub;

    await server.prisma.issue.updateMany({
      where: { id: { in: issueIds } },
      data: { assigneeId, assigneeName, updatedAt: now },
    });

    await server.prisma.issueActivity.createMany({
      data: issueIds.map((issueId: string) => ({
        issueId,
        actorId,
        actorName: actorId || 'system',
        action: 'assigned',
        details: { assigneeId, assigneeName },
        createdAt: now,
      })),
    });

    // Publish events (non-blocking)
    try {
      const eventBus = container.resolve<IEventBus>(TOKENS.IEventBus);
      const issues = await server.prisma.issue.findMany({
        where: { id: { in: issueIds } },
        select: { id: true, orgId: true, issueNumber: true },
      });
      for (const issue of issues) {
        await eventBus.publish(createEvent({
          type: EVENT_TYPES.TRIAGE_ISSUE_ASSIGNED,
          orgId: issue.orgId,
          actorId,
          entityType: 'issue',
          entityId: issue.id,
          payload: { issueNumber: issue.issueNumber, assigneeId, assigneeName },
        }));
      }
    } catch {
      // Non-blocking
    }

    return { data: { count: issueIds.length }, error: null };
  });

  // ── Batch: dismiss as noise ───────────────────────────────────────
  server.post(`${prefix}/batch/dismiss-noise`, {
    schema: {
      tags: ['Triage'],
      summary: 'Batch dismiss issues as noise',
      body: {
        type: 'object',
        required: ['issueIds', 'reason'],
        properties: {
          issueIds: { type: 'array', items: { type: 'string' } },
          reason: { type: 'string' },
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
  }, async (request) => {
    const { issueIds, reason } = request.body as any;
    const now = new Date();
    const actorId = request.user?.sub;

    await server.prisma.issue.updateMany({
      where: { id: { in: issueIds } },
      data: { isNoise: true, noiseReason: reason, updatedAt: now },
    });

    await server.prisma.issueActivity.createMany({
      data: issueIds.map((issueId: string) => ({
        issueId,
        actorId,
        actorName: actorId || 'system',
        action: 'noise_dismissed',
        details: { reason },
        createdAt: now,
      })),
    });

    return { data: { count: issueIds.length }, error: null };
  });

  // ── Get single issue with comments ────────────────────────────────
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

  // ── Update issue ──────────────────────────────────────────────────
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

  // ── Transition status (kanban column move) ────────────────────────
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

  // ── Add comment ───────────────────────────────────────────────────
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

  // ── Resolve with notes ────────────────────────────────────────────
  server.post(`${prefix}/:id/resolve`, {
    schema: {
      tags: ['Triage'],
      summary: 'Resolve an issue with resolution notes',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      body: {
        type: 'object',
        required: ['resolutionNotes'],
        properties: {
          resolutionNotes: { type: 'string' },
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
    const { id } = request.params as any;
    const { resolutionNotes } = request.body as any;
    const actorId = request.user?.sub;
    const now = new Date();

    // Load the issue to compute timeToResolution
    const existing = await server.prisma.issue.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({ data: null, error: 'Issue not found' });
    }

    const timeToResolution = Math.round((now.getTime() - existing.createdAt.getTime()) / 60000);

    const issue = await server.prisma.issue.update({
      where: { id },
      data: {
        status: 'resolved',
        resolvedAt: now,
        resolvedBy: actorId || null,
        resolutionNotes,
        timeToResolution,
      },
    });

    // Create activity record
    await server.prisma.issueActivity.create({
      data: {
        issueId: id,
        actorId,
        actorName: actorId || 'system',
        action: 'resolved',
        details: { resolutionNotes, timeToResolution },
        createdAt: now,
      },
    });

    // Publish event
    try {
      const eventBus = container.resolve<IEventBus>(TOKENS.IEventBus);
      await eventBus.publish(createEvent({
        type: EVENT_TYPES.TRIAGE_ISSUE_STATUS_CHANGED,
        orgId: issue.orgId,
        actorId,
        entityType: 'issue',
        entityId: issue.id,
        payload: { issueNumber: issue.issueNumber, newStatus: 'resolved', resolutionNotes },
      }));
    } catch {
      // Non-blocking
    }

    return { data: issue, error: null };
  });

  // ── Timeline: activity records ────────────────────────────────────
  server.get(`${prefix}/:id/timeline`, {
    schema: {
      tags: ['Triage'],
      summary: 'Get activity timeline for an issue',
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
  }, async (request, reply) => {
    const { id } = request.params as any;

    // Verify issue exists
    const exists = await server.prisma.issue.findUnique({ where: { id }, select: { id: true } });
    if (!exists) {
      return reply.status(404).send({ data: null, error: 'Issue not found' });
    }

    const activities = await server.prisma.issueActivity.findMany({
      where: { issueId: id },
      orderBy: { createdAt: 'asc' },
    });

    return { data: activities, error: null };
  });

  // ── Context: rich context for an issue ────────────────────────────
  server.get(`${prefix}/:id/context`, {
    schema: {
      tags: ['Triage'],
      summary: 'Rich context — issue with related shipment, order, sensor readings, device events',
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
    const { id } = request.params as any;

    const issue = await server.prisma.issue.findUnique({
      where: { id },
      include: { comments: { orderBy: { createdAt: 'asc' } } },
    });

    if (!issue) {
      return reply.status(404).send({ data: null, error: 'Issue not found' });
    }

    let shipment = null;
    let order = null;
    let sensorReadings: any[] = [];
    let deviceEvents: any[] = [];

    // Load shipment context
    if (issue.shipmentId) {
      const [shipmentResult, sensorResult, deviceResult] = await Promise.all([
        server.prisma.shipment.findUnique({
          where: { id: issue.shipmentId },
          include: {
            events: { orderBy: { createdAt: 'desc' }, take: 50 },
            stops: { orderBy: { sequenceNumber: 'asc' } },
            carrier: true,
            customer: true,
          },
        }),
        server.prisma.sensorReading.findMany({
          where: { shipmentId: issue.shipmentId },
          orderBy: { eventTime: 'desc' },
          take: 100,
        }),
        server.prisma.deviceEvent.findMany({
          where: { shipmentId: issue.shipmentId },
          orderBy: { startTime: 'desc' },
          take: 50,
        }),
      ]);
      shipment = shipmentResult;
      sensorReadings = sensorResult;
      deviceEvents = deviceResult;
    }

    // Load order context
    if (issue.orderId) {
      order = await server.prisma.order.findUnique({
        where: { id: issue.orderId },
        include: {
          trackableUnits: true,
        },
      });
    }

    return {
      data: {
        issue,
        shipment,
        order,
        sensorReadings,
        deviceEvents,
      },
      error: null,
    };
  });
}
