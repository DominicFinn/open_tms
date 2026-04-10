import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { container, TOKENS } from '../di/index.js';
import { ICommandBus } from '../commands/CommandBus.js';
import { CREATE_ISSUE } from '../commands/issues/CreateIssueCommand.js';
import { UPDATE_ISSUE } from '../commands/issues/UpdateIssueCommand.js';
import { ESCALATE_ISSUE } from '../commands/issues/EscalateIssueCommand.js';

export async function issueRoutes(server: FastifyInstance) {
  const prisma = server.prisma;
  const commandBus = container.resolve<ICommandBus>(TOKENS.ICommandBus);

  const getOrgId = async () => {
    const org = await prisma.organization.findFirst({ select: { id: true } });
    return org?.id || 'default';
  };

  // GET /api/v1/issues — List all issues (from read model)
  server.get('/api/v1/issues', {
    schema: {
      tags: ['Issues'],
      summary: 'List all issues',
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['open', 'in_progress', 'resolved', 'closed'] },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
          category: { type: 'string' },
          assigneeName: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, _reply: FastifyReply) => {
    const query = req.query as {
      status?: string;
      priority?: string;
      category?: string;
      assigneeName?: string;
    };

    const where: Record<string, string> = {};
    if (query.status) where.status = query.status;
    if (query.priority) where.priority = query.priority;
    if (query.category) where.category = query.category;
    if (query.assigneeName) where.assigneeName = query.assigneeName;

    const issues = await prisma.issueReadModel.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return { data: issues, error: null };
  });

  // GET /api/v1/issues/:id — Get single issue (full write model)
  server.get('/api/v1/issues/:id', {
    schema: {
      tags: ['Issues'],
      summary: 'Get issue by ID',
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const issue = await prisma.issue.findUnique({ where: { id } });
    if (!issue) {
      reply.code(404);
      return { data: null, error: 'Issue not found' };
    }
    return { data: issue, error: null };
  });

  // POST /api/v1/issues — Create a new issue
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
          category: { type: 'string' },
          sourceEntityType: { type: 'string' },
          sourceEntityId: { type: 'string' },
          sourceEventId: { type: 'string' },
          assigneeId: { type: 'string' },
          assigneeName: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
      category: z.string().min(1),
      sourceEntityType: z.string().optional(),
      sourceEntityId: z.string().optional(),
      sourceEventId: z.string().optional(),
      assigneeId: z.string().optional(),
      assigneeName: z.string().optional(),
    }).parse(req.body);

    const result = await commandBus.dispatch({
      type: CREATE_ISSUE,
      orgId: await getOrgId(),
      actorId: null,
      payload: body,
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error };
    }

    const created = await prisma.issue.findUnique({
      where: { id: (result.data as { id: string }).id },
    });
    reply.code(201);
    return { data: created, error: null };
  });

  // PATCH /api/v1/issues/:id — Update an issue
  server.patch('/api/v1/issues/:id', {
    schema: {
      tags: ['Issues'],
      summary: 'Update an issue',
      body: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          status: { type: 'string', enum: ['open', 'in_progress', 'resolved', 'closed'] },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
          assigneeId: { type: 'string' },
          assigneeName: { type: 'string' },
          resolution: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      title: z.string().min(1).optional(),
      description: z.string().optional(),
      status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
      priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
      assigneeId: z.string().optional(),
      assigneeName: z.string().optional(),
      resolution: z.string().optional(),
    }).parse(req.body);

    const result = await commandBus.dispatch({
      type: UPDATE_ISSUE,
      orgId: await getOrgId(),
      actorId: null,
      payload: { id, data: body },
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(result.error?.includes('not found') ? 404 : 400);
      return { data: null, error: result.error };
    }

    const updated = await prisma.issue.findUnique({ where: { id } });
    return { data: updated, error: null };
  });

  // POST /api/v1/issues/:id/escalate — Escalate an issue
  server.post('/api/v1/issues/:id/escalate', {
    schema: {
      tags: ['Issues'],
      summary: 'Escalate an issue',
      body: {
        type: 'object',
        required: ['escalatedTo'],
        properties: {
          escalatedTo: { type: 'string' },
          reason: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      escalatedTo: z.string().min(1),
      reason: z.string().optional(),
    }).parse(req.body);

    const result = await commandBus.dispatch({
      type: ESCALATE_ISSUE,
      orgId: await getOrgId(),
      actorId: null,
      payload: { id, ...body },
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(result.error?.includes('not found') ? 404 : 400);
      return { data: null, error: result.error };
    }

    const escalated = await prisma.issue.findUnique({ where: { id } });
    return { data: escalated, error: null };
  });
}
