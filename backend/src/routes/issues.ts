/**
 * Issue / Triage Centre API routes
 * Full CRUD + actions (assign, escalate, snooze, close, labels, kanban views)
 */

import crypto from 'crypto';

import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { container, TOKENS } from '../di/index.js';
import { IIssueRepository } from '../repositories/IssueRepository.js';
import { ICommandBus } from '../commands/CommandBus.js';
import { CREATE_ISSUE } from '../commands/issues/CreateIssueCommand.js';
import { UPDATE_ISSUE } from '../commands/issues/UpdateIssueCommand.js';
import { ESCALATE_ISSUE } from '../commands/issues/EscalateIssueCommand.js';
import { ADD_ISSUE_LABEL } from '../commands/issues/AddIssueLabelCommand.js';
import { REMOVE_ISSUE_LABEL } from '../commands/issues/RemoveIssueLabelCommand.js';
import {
  CREATE_ISSUE_LABEL,
  UPDATE_ISSUE_LABEL,
  DELETE_ISSUE_LABEL,
} from '../commands/issueLabels/index.js';

export const issueRoutes: FastifyPluginAsync = async (server) => {
  const issueRepo = container.resolve<IIssueRepository>(TOKENS.IIssueRepository);
  const commandBus = container.resolve<ICommandBus>(TOKENS.ICommandBus);
  const prisma = container.resolve<PrismaClient>(TOKENS.PrismaClient);

  // ─── Issues CRUD ─────────────────────────────────────────────────────────

  // GET /api/v1/issues — list with filters
  server.get('/api/v1/issues', {
    schema: {
      tags: ['Issues'],
      summary: 'List issues with filters',
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Comma-separated: open,in_progress,resolved,closed' },
          priority: { type: 'string', description: 'Comma-separated: low,medium,high,critical' },
          category: { type: 'string', description: 'Comma-separated: exception,delay,damage,compliance,other' },
          sourceEntityType: { type: 'string' },
          sourceEntityId: { type: 'string' },
          assigneeId: { type: 'string' },
          needsCapa: { type: 'string', description: 'true or false' },
          snoozed: { type: 'string', description: 'true = snoozed only, false = non-snoozed only' },
          search: { type: 'string', description: 'Text search on title' },
          limit: { type: 'integer', default: 100 },
          offset: { type: 'integer', default: 0 },
        },
      },
    },
  }, async (req: FastifyRequest) => {
    const query = req.query as Record<string, string>;
    const orgId = (req as any).orgId || 'default-org';
    const result = await issueRepo.findByOrg({
      orgId,
      status: query.status,
      priority: query.priority,
      category: query.category,
      sourceEntityType: query.sourceEntityType,
      sourceEntityId: query.sourceEntityId,
      assigneeId: query.assigneeId,
      needsCapa: query.needsCapa === 'true' ? true : query.needsCapa === 'false' ? false : undefined,
      snoozed: query.snoozed === 'true' ? true : query.snoozed === 'false' ? false : undefined,
      search: query.search,
      limit: query.limit ? parseInt(query.limit) : 100,
      offset: query.offset ? parseInt(query.offset) : 0,
    });
    return { data: result.items, total: result.total, error: null };
  });

  // GET /api/v1/issues/stats — dashboard stats
  server.get('/api/v1/issues/stats', {
    schema: { tags: ['Issues'], summary: 'Issue dashboard statistics' },
  }, async (req: FastifyRequest) => {
    const orgId = (req as any).orgId || 'default-org';
    const stats = await issueRepo.getStats(orgId);
    return { data: stats, error: null };
  });

  // GET /api/v1/issues/:id — detail with relations
  server.get<{ Params: { id: string } }>('/api/v1/issues/:id', {
    schema: { tags: ['Issues'], summary: 'Get issue detail with labels, CAPA reports, SLA' },
  }, async (req, reply) => {
    const issue = await issueRepo.findByIdWithRelations(req.params.id);
    if (!issue) {
      reply.code(404);
      return { data: null, error: 'Issue not found' };
    }
    // Fetch SLA evaluations
    const slaEvals = await prisma.slaEvaluation.findMany({
      where: { entityType: 'issue', entityId: req.params.id },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    // Fetch comment count
    const commentCount = await prisma.comment.count({
      where: { entityType: 'issue', entityId: req.params.id },
    });
    return { data: { ...issue, slaEvaluations: slaEvals, commentCount }, error: null };
  });

  // POST /api/v1/issues — create issue
  server.post('/api/v1/issues', {
    schema: {
      tags: ['Issues'],
      summary: 'Create a new issue',
      body: {
        type: 'object',
        required: ['title', 'category'],
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
          category: { type: 'string', enum: ['exception', 'delay', 'damage', 'compliance', 'other'] },
          sourceEntityType: { type: 'string' },
          sourceEntityId: { type: 'string' },
          assigneeId: { type: 'string' },
          assigneeName: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as any;
    const orgId = (req as any).orgId || 'default-org';
    const actorId = (req as any).userId || 'system';
    const result = await commandBus.dispatch({
      type: CREATE_ISSUE,
      orgId,
      actorId,
      payload: body,
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });
    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error };
    }
    reply.code(201);
    return { data: result.data, error: null };
  });

  // PUT /api/v1/issues/:id — update issue
  server.put<{ Params: { id: string } }>('/api/v1/issues/:id', {
    schema: {
      tags: ['Issues'],
      summary: 'Update an issue',
      body: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
          category: { type: 'string' },
          resolution: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const body = req.body as any;
    const orgId = (req as any).orgId || 'default-org';
    const actorId = (req as any).userId || 'system';
    const result = await commandBus.dispatch({
      type: UPDATE_ISSUE,
      orgId,
      actorId,
      payload: { id: req.params.id, data: body },
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });
    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error };
    }
    return { data: result.data, error: null };
  });

  // ─── Issue Actions ───────────────────────────────────────────────────────

  // POST /api/v1/issues/:id/status — change status (kanban drag-and-drop)
  server.post<{ Params: { id: string } }>('/api/v1/issues/:id/status', {
    schema: {
      tags: ['Issues'],
      summary: 'Change issue status (kanban drag)',
      body: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['open', 'in_progress', 'resolved', 'closed'] },
          resolution: { type: 'string', description: 'Required when resolving' },
        },
      },
    },
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const body = req.body as { status: string; resolution?: string };
    const orgId = (req as any).orgId || 'default-org';
    const actorId = (req as any).userId || 'system';
    const data: any = { status: body.status };
    if (body.resolution) data.resolution = body.resolution;
    const result = await commandBus.dispatch({
      type: UPDATE_ISSUE,
      orgId,
      actorId,
      payload: { id: req.params.id, data },
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });
    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error };
    }
    return { data: result.data, error: null };
  });

  // POST /api/v1/issues/:id/assign
  server.post<{ Params: { id: string } }>('/api/v1/issues/:id/assign', {
    schema: {
      tags: ['Issues'],
      summary: 'Assign issue to a user',
      body: {
        type: 'object',
        required: ['assigneeId', 'assigneeName'],
        properties: {
          assigneeId: { type: 'string' },
          assigneeName: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const body = req.body as { assigneeId: string; assigneeName: string };
    const orgId = (req as any).orgId || 'default-org';
    const actorId = (req as any).userId || 'system';
    const result = await commandBus.dispatch({
      type: UPDATE_ISSUE,
      orgId,
      actorId,
      payload: { id: req.params.id, data: { assigneeId: body.assigneeId, assigneeName: body.assigneeName } },
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });
    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error };
    }
    return { data: result.data, error: null };
  });

  // POST /api/v1/issues/:id/escalate
  server.post<{ Params: { id: string } }>('/api/v1/issues/:id/escalate', {
    schema: {
      tags: ['Issues'],
      summary: 'Escalate issue',
      body: {
        type: 'object',
        required: ['escalatedTo'],
        properties: {
          escalatedTo: { type: 'string' },
          reason: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const body = req.body as { escalatedTo: string; reason?: string };
    const orgId = (req as any).orgId || 'default-org';
    const actorId = (req as any).userId || 'system';
    const result = await commandBus.dispatch({
      type: ESCALATE_ISSUE,
      orgId,
      actorId,
      payload: { id: req.params.id, escalatedTo: body.escalatedTo, reason: body.reason },
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });
    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error };
    }
    return { data: result.data, error: null };
  });

  // POST /api/v1/issues/:id/snooze
  server.post<{ Params: { id: string } }>('/api/v1/issues/:id/snooze', {
    schema: {
      tags: ['Issues'],
      summary: 'Snooze an issue until a specified time',
      body: {
        type: 'object',
        required: ['until'],
        properties: {
          until: { type: 'string', format: 'date-time' },
          reason: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const body = req.body as { until: string; reason?: string };
    const orgId = (req as any).orgId || 'default-org';
    const actorId = (req as any).userId || 'system';
    const result = await commandBus.dispatch({
      type: UPDATE_ISSUE,
      orgId,
      actorId,
      payload: {
        id: req.params.id,
        data: {
          snoozedUntil: body.until,
          snoozedBy: actorId,
          snoozedReason: body.reason || null,
        },
      },
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });
    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error };
    }
    return { data: result.data, error: null };
  });

  // POST /api/v1/issues/:id/unsnooze
  server.post<{ Params: { id: string } }>('/api/v1/issues/:id/unsnooze', {
    schema: { tags: ['Issues'], summary: 'Unsnooze an issue' },
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const orgId = (req as any).orgId || 'default-org';
    const actorId = (req as any).userId || 'system';
    const result = await commandBus.dispatch({
      type: UPDATE_ISSUE,
      orgId,
      actorId,
      payload: {
        id: req.params.id,
        data: { snoozedUntil: null, snoozedBy: null, snoozedReason: null },
      },
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });
    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error };
    }
    return { data: result.data, error: null };
  });

  // POST /api/v1/issues/:id/needs-capa
  server.post<{ Params: { id: string } }>('/api/v1/issues/:id/needs-capa', {
    schema: {
      tags: ['Issues'],
      summary: 'Toggle needs-CAPA flag',
      body: {
        type: 'object',
        required: ['needsCapa'],
        properties: { needsCapa: { type: 'boolean' } },
      },
    },
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const body = req.body as { needsCapa: boolean };
    const orgId = (req as any).orgId || 'default-org';
    const actorId = (req as any).userId || 'system';
    const result = await commandBus.dispatch({
      type: UPDATE_ISSUE,
      orgId,
      actorId,
      payload: { id: req.params.id, data: { needsCapa: body.needsCapa } },
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });
    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error };
    }
    return { data: result.data, error: null };
  });

  // POST /api/v1/issues/:id/close
  server.post<{ Params: { id: string } }>('/api/v1/issues/:id/close', {
    schema: {
      tags: ['Issues'],
      summary: 'Close an issue',
      body: {
        type: 'object',
        properties: { resolution: { type: 'string' } },
      },
    },
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const body = (req.body as any) || {};
    const orgId = (req as any).orgId || 'default-org';
    const actorId = (req as any).userId || 'system';
    const result = await commandBus.dispatch({
      type: UPDATE_ISSUE,
      orgId,
      actorId,
      payload: {
        id: req.params.id,
        data: { status: 'closed', resolution: body.resolution },
      },
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });
    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error };
    }
    return { data: result.data, error: null };
  });

  // POST /api/v1/issues/:id/reopen
  server.post<{ Params: { id: string } }>('/api/v1/issues/:id/reopen', {
    schema: { tags: ['Issues'], summary: 'Reopen a resolved or closed issue' },
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const orgId = (req as any).orgId || 'default-org';
    const actorId = (req as any).userId || 'system';
    const result = await commandBus.dispatch({
      type: UPDATE_ISSUE,
      orgId,
      actorId,
      payload: {
        id: req.params.id,
        data: { status: 'open', closedAt: null, closedBy: null },
      },
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });
    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error };
    }
    return { data: result.data, error: null };
  });

  // ─── Labels on Issues ────────────────────────────────────────────────────

  // POST /api/v1/issues/:id/labels — add label
  server.post<{ Params: { id: string } }>('/api/v1/issues/:id/labels', {
    schema: {
      tags: ['Issues'],
      summary: 'Add a label to an issue',
      body: {
        type: 'object',
        required: ['labelId'],
        properties: { labelId: { type: 'string' } },
      },
    },
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const body = req.body as { labelId: string };
    const orgId = (req as any).orgId || 'default-org';
    const actorId = req.user?.sub ?? null;

    const result = await commandBus.dispatch({
      type: ADD_ISSUE_LABEL,
      orgId,
      actorId,
      payload: { issueId: req.params.id, labelId: body.labelId },
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error ?? 'Failed to add label' };
    }
    const data = result.data as { alreadyAssigned: boolean };
    if (data.alreadyAssigned) {
      reply.code(409);
      return { data: null, error: 'Label already assigned' };
    }
    return { data: result.data, error: null };
  });

  // DELETE /api/v1/issues/:id/labels/:labelId — remove label
  server.delete<{ Params: { id: string; labelId: string } }>('/api/v1/issues/:id/labels/:labelId', {
    schema: { tags: ['Issues'], summary: 'Remove a label from an issue' },
  }, async (req, reply) => {
    const orgId = (req as any).orgId || 'default-org';
    const actorId = req.user?.sub ?? null;

    const result = await commandBus.dispatch({
      type: REMOVE_ISSUE_LABEL,
      orgId,
      actorId,
      payload: { issueId: req.params.id, labelId: req.params.labelId },
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error ?? 'Failed to remove label' };
    }
    return { data: { success: true }, error: null };
  });

  // ─── Activity Feed ───────────────────────────────────────────────────────

  // GET /api/v1/issues/:id/activity — merged events + comments timeline
  server.get<{ Params: { id: string } }>('/api/v1/issues/:id/activity', {
    schema: { tags: ['Issues'], summary: 'Get issue activity timeline (events + comments)' },
  }, async (req) => {
    const issueId = req.params.id;
    // Fetch domain events for this issue
    const events = await prisma.domainEventLog.findMany({
      where: { entityType: 'issue', entityId: issueId },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
    // Fetch comments
    const comments = await prisma.comment.findMany({
      where: { entityType: 'issue', entityId: issueId },
      orderBy: { createdAt: 'asc' },
      take: 500,
    });
    // Merge and sort
    const activity = [
      ...events.map(e => ({
        type: 'event' as const,
        id: e.id,
        eventType: e.type,
        payload: e.payload,
        actorId: (e.metadata as any)?.actorId || e.actorId || null,
        timestamp: e.timestamp || e.createdAt.toISOString(),
      })),
      ...comments.map(c => ({
        type: 'comment' as const,
        id: c.id,
        authorId: c.authorId,
        authorName: c.authorName,
        authorType: c.authorType,
        body: c.body,
        visibleToCustomer: c.visibleToCustomer,
        timestamp: c.createdAt.toISOString(),
      })),
    ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return { data: activity, error: null };
  });

  // ─── Issue Closure Report ──────────────────────────────────────────────

  // POST /api/v1/issues/:id/report — generate or retrieve closure report PDF
  server.post<{ Params: { id: string } }>('/api/v1/issues/:id/report', {
    schema: { tags: ['Issues'], summary: 'Generate issue closure report PDF' },
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const { IssueClosureReportService } = await import('../services/IssueClosureReportService.js');
    const storageProvider = container.resolve<any>(TOKENS.IBinaryStorageProvider);
    const reportService = new IssueClosureReportService(prisma, storageProvider);
    try {
      const result = await reportService.generateReport(req.params.id);
      reply.code(201);
      return { data: result, error: null };
    } catch (err: any) {
      reply.code(400);
      return { data: null, error: err.message };
    }
  });

  // GET /api/v1/issues/:id/report — get existing report document
  server.get<{ Params: { id: string } }>('/api/v1/issues/:id/report', {
    schema: { tags: ['Issues'], summary: 'Get issue closure report document' },
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const doc = await prisma.generatedDocument.findFirst({
      where: { documentType: 'issue_closure_report', metadata: { path: ['issueId'], equals: req.params.id } },
      orderBy: { createdAt: 'desc' },
    });
    if (!doc) {
      reply.code(404);
      return { data: null, error: 'No report generated yet. Use POST to generate.' };
    }
    return { data: { id: doc.id, fileName: doc.fileName, createdAt: doc.createdAt }, error: null };
  });

  // ─── Issue Labels CRUD ───────────────────────────────────────────────────

  // GET /api/v1/issue-labels
  server.get('/api/v1/issue-labels', {
    schema: { tags: ['Issue Labels'], summary: 'List all issue labels for the org' },
  }, async (req: FastifyRequest) => {
    const orgId = (req as any).orgId || 'default-org';
    const labels = await prisma.issueLabel.findMany({
      where: { orgId },
      orderBy: { name: 'asc' },
      take: 500,
    });
    return { data: labels, error: null };
  });

  // POST /api/v1/issue-labels
  server.post('/api/v1/issue-labels', {
    schema: {
      tags: ['Issue Labels'],
      summary: 'Create an issue label',
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          color: { type: 'string', description: 'Hex color code', default: '#6B7280' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as { name: string; color?: string };
    const orgId = (req as any).orgId || 'default-org';
    const actorId = req.user?.sub ?? null;

    const result = await commandBus.dispatch({
      type: CREATE_ISSUE_LABEL,
      orgId,
      actorId,
      payload: { name: body.name, color: body.color },
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) {
      // Prisma's unique-constraint violation surfaces as a generic error here;
      // pattern-match on the error message because the command layer doesn't
      // re-throw raw Prisma codes.
      if ((result.error || '').includes('Unique constraint') || (result.error || '').includes('P2002')) {
        reply.code(409);
        return { data: null, error: 'Label with this name already exists' };
      }
      reply.code(400);
      return { data: null, error: result.error ?? 'Failed to create label' };
    }
    reply.code(201);
    return { data: result.data, error: null };
  });

  // PUT /api/v1/issue-labels/:id
  server.put<{ Params: { id: string } }>('/api/v1/issue-labels/:id', {
    schema: {
      tags: ['Issue Labels'],
      summary: 'Update an issue label',
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          color: { type: 'string' },
        },
      },
    },
  }, async (req, reply) => {
    const body = req.body as { name?: string; color?: string };
    const orgId = (req as any).orgId || 'default-org';
    const actorId = req.user?.sub ?? null;

    const result = await commandBus.dispatch({
      type: UPDATE_ISSUE_LABEL,
      orgId,
      actorId,
      payload: { id: req.params.id, data: body },
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) {
      // Prisma raises P2025 ("record not found") via the message
      if ((result.error || '').includes('Record to update not found') || (result.error || '').includes('P2025')) {
        reply.code(404);
        return { data: null, error: 'Label not found' };
      }
      reply.code(400);
      return { data: null, error: result.error ?? 'Failed to update label' };
    }
    return { data: result.data, error: null };
  });

  // DELETE /api/v1/issue-labels/:id
  server.delete<{ Params: { id: string } }>('/api/v1/issue-labels/:id', {
    schema: { tags: ['Issue Labels'], summary: 'Delete an issue label' },
  }, async (req, reply) => {
    const orgId = (req as any).orgId || 'default-org';
    const actorId = req.user?.sub ?? null;

    const result = await commandBus.dispatch({
      type: DELETE_ISSUE_LABEL,
      orgId,
      actorId,
      payload: { id: req.params.id },
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) {
      if ((result.error || '').includes('Record to delete') || (result.error || '').includes('P2025')) {
        reply.code(404);
        return { data: null, error: 'Label not found' };
      }
      reply.code(400);
      return { data: null, error: result.error ?? 'Failed to delete label' };
    }
    return { data: { success: true }, error: null };
  });

  // ─── Kanban Views ────────────────────────────────────────────────────────

  // GET /api/v1/kanban-views
  server.get('/api/v1/kanban-views', {
    schema: { tags: ['Kanban Views'], summary: 'List saved kanban views for the org' },
  }, async (req: FastifyRequest) => {
    const orgId = (req as any).orgId || 'default-org';
    const views = await prisma.kanbanView.findMany({
      where: { orgId },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      take: 500,
    });
    return { data: views, error: null };
  });

  // POST /api/v1/kanban-views
  server.post('/api/v1/kanban-views', {
    schema: {
      tags: ['Kanban Views'],
      summary: 'Create a saved kanban view',
      body: {
        type: 'object',
        required: ['name', 'filters'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          filters: { type: 'object' },
          groupBy: { type: 'string', enum: ['status', 'priority', 'category', 'assignee'] },
          sortBy: { type: 'string', enum: ['createdAt', 'priority', 'slaStatus'] },
          isDefault: { type: 'boolean' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as any;
    const orgId = (req as any).orgId || 'default-org';
    const actorId = (req as any).userId || 'system';
    // If setting as default, unset other defaults
    if (body.isDefault) {
      await prisma.kanbanView.updateMany({
        where: { orgId, isDefault: true },
        data: { isDefault: false },
      });
    }
    const view = await prisma.kanbanView.create({
      data: {
        orgId,
        name: body.name,
        description: body.description,
        filters: body.filters,
        groupBy: body.groupBy || 'status',
        sortBy: body.sortBy || 'createdAt',
        isDefault: body.isDefault || false,
        createdBy: actorId,
      },
    });
    reply.code(201);
    return { data: view, error: null };
  });

  // PUT /api/v1/kanban-views/:id
  server.put<{ Params: { id: string } }>('/api/v1/kanban-views/:id', {
    schema: {
      tags: ['Kanban Views'],
      summary: 'Update a saved kanban view',
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          filters: { type: 'object' },
          groupBy: { type: 'string' },
          sortBy: { type: 'string' },
          isDefault: { type: 'boolean' },
        },
      },
    },
  }, async (req, reply) => {
    const body = req.body as any;
    const orgId = (req as any).orgId || 'default-org';
    if (body.isDefault) {
      await prisma.kanbanView.updateMany({
        where: { orgId, isDefault: true },
        data: { isDefault: false },
      });
    }
    try {
      const view = await prisma.kanbanView.update({
        where: { id: req.params.id },
        data: body,
      });
      return { data: view, error: null };
    } catch (err: any) {
      reply.code(404);
      return { data: null, error: 'View not found' };
    }
  });

  // DELETE /api/v1/kanban-views/:id
  server.delete<{ Params: { id: string } }>('/api/v1/kanban-views/:id', {
    schema: { tags: ['Kanban Views'], summary: 'Delete a saved kanban view' },
  }, async (req, reply) => {
    try {
      await prisma.kanbanView.delete({ where: { id: req.params.id } });
      return { data: { success: true }, error: null };
    } catch (err: any) {
      reply.code(404);
      return { data: null, error: 'View not found' };
    }
  });
};
