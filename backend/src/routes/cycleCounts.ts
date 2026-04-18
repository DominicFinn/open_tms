import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { container, TOKENS } from '../di/index.js';
import { ICommandBus } from '../commands/CommandBus.js';
import { CREATE_CYCLE_COUNT } from '../commands/warehouse/CreateCycleCountCommand.js';
import { RECORD_CYCLE_COUNT_LINE } from '../commands/warehouse/RecordCycleCountLineCommand.js';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

export async function cycleCountRoutes(server: FastifyInstance) {
  const commandBus = container.resolve<ICommandBus>(TOKENS.ICommandBus);
  const prisma = container.resolve<PrismaClient>(TOKENS.PrismaClient);

  // GET /api/v1/cycle-counts?locationId=xxx&status=xxx
  server.get('/api/v1/cycle-counts', {
    schema: {
      tags: ['WMS - Cycle Counting'],
      summary: 'List cycle counts',
      querystring: {
        type: 'object', required: ['locationId'],
        properties: {
          locationId: { type: 'string', format: 'uuid' },
          status: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const q = req.query as any;
    const where: any = { locationId: q.locationId };
    if (q.status) where.status = q.status;

    const counts = await prisma.cycleCount.findMany({
      where,
      include: { _count: { select: { lines: true } } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    return { data: counts, error: null };
  });

  // GET /api/v1/cycle-counts/:id
  server.get('/api/v1/cycle-counts/:id', {
    schema: { tags: ['WMS - Cycle Counting'], summary: 'Get cycle count detail with lines' },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const count = await prisma.cycleCount.findUnique({
      where: { id },
      include: {
        lines: {
          include: { },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!count) { reply.code(404); return { data: null, error: 'Cycle count not found' }; }
    return { data: count, error: null };
  });

  // POST /api/v1/cycle-counts
  server.post('/api/v1/cycle-counts', {
    schema: {
      tags: ['WMS - Cycle Counting'],
      summary: 'Create a cycle count (full, zone, or random sample)',
      body: {
        type: 'object', required: ['locationId', 'countType'],
        properties: {
          locationId: { type: 'string', format: 'uuid' },
          countType: { type: 'string', enum: ['full', 'zone', 'random_sample'] },
          zoneId: { type: 'string', format: 'uuid', nullable: true },
          assignedToUserId: { type: 'string', nullable: true },
          plannedAt: { type: 'string', nullable: true },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      locationId: z.string().uuid(),
      countType: z.enum(['full', 'zone', 'random_sample']),
      zoneId: z.string().uuid().nullable().optional(),
      assignedToUserId: z.string().nullable().optional(),
      plannedAt: z.string().nullable().optional(),
    }).parse((req as any).body);

    const orgId = (req as any).orgId || 'default-org';
    const actorId = (req as any).userId || 'system';

    const result = await commandBus.dispatch({
      type: CREATE_CYCLE_COUNT, orgId, actorId, payload: body,
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) { reply.code(400); return { data: null, error: result.error }; }
    reply.code(201);
    return { data: result.data, error: null };
  });

  // POST /api/v1/cycle-count-lines/:id/record
  server.post('/api/v1/cycle-count-lines/:id/record', {
    schema: {
      tags: ['WMS - Cycle Counting'],
      summary: 'Record a counted quantity for a cycle count line',
      body: {
        type: 'object', required: ['countedQuantity'],
        properties: {
          countedQuantity: { type: 'integer', minimum: 0 },
          notes: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      countedQuantity: z.number().int().min(0),
      notes: z.string().optional(),
    }).parse((req as any).body);

    const orgId = (req as any).orgId || 'default-org';
    const actorId = (req as any).userId || 'system';

    const result = await commandBus.dispatch({
      type: RECORD_CYCLE_COUNT_LINE, orgId, actorId,
      payload: { lineId: id, ...body },
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) { reply.code(400); return { data: null, error: result.error }; }
    return { data: result.data, error: null };
  });
}
