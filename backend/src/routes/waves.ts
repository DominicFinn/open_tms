import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { container, TOKENS } from '../di/index.js';
import { ICommandBus } from '../commands/CommandBus.js';
import { CREATE_WAVE } from '../commands/warehouse/CreateWaveCommand.js';
import { RELEASE_WAVE } from '../commands/warehouse/ReleaseWaveCommand.js';
import { COMPLETE_PICK_LINE } from '../commands/warehouse/CompletePickLineCommand.js';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

export async function waveRoutes(server: FastifyInstance) {
  const commandBus = container.resolve<ICommandBus>(TOKENS.ICommandBus);
  const prisma = container.resolve<PrismaClient>(TOKENS.PrismaClient);

  // ═══════════════════════════════════════════════════════════
  // WAVES
  // ═══════════════════════════════════════════════════════════

  // GET /api/v1/waves?locationId=xxx&status=xxx
  server.get('/api/v1/waves', {
    schema: {
      tags: ['WMS - Waves & Picking'],
      summary: 'List waves for a location',
      querystring: {
        type: 'object',
        required: ['locationId'],
        properties: {
          locationId: { type: 'string', format: 'uuid' },
          status: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { locationId, status } = req.query as { locationId: string; status?: string };
    const where: any = { locationId };
    if (status) where.status = status;

    const waves = await prisma.wave.findMany({
      where,
      include: { _count: { select: { pickTasks: true, waveOrders: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return { data: waves, error: null };
  });

  // GET /api/v1/waves/:id
  server.get('/api/v1/waves/:id', {
    schema: {
      tags: ['WMS - Waves & Picking'],
      summary: 'Get wave detail with pick tasks',
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const wave = await prisma.wave.findUnique({
      where: { id },
      include: {
        waveOrders: { select: { orderId: true, priority: true } },
        pickTasks: {
          include: {
            _count: { select: { pickLines: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!wave) {
      reply.code(404);
      return { data: null, error: 'Wave not found' };
    }
    return { data: wave, error: null };
  });

  // POST /api/v1/waves
  server.post('/api/v1/waves', {
    schema: {
      tags: ['WMS - Waves & Picking'],
      summary: 'Create a wave from selected orders',
      body: {
        type: 'object',
        required: ['locationId', 'pickStrategy', 'orderIds'],
        properties: {
          locationId: { type: 'string', format: 'uuid' },
          templateId: { type: 'string', format: 'uuid', nullable: true },
          pickStrategy: { type: 'string', enum: ['discrete', 'batch', 'zone'] },
          orderIds: { type: 'array', items: { type: 'string', format: 'uuid' }, minItems: 1 },
          cutoffAt: { type: 'string', nullable: true },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      locationId: z.string().uuid(),
      templateId: z.string().uuid().nullable().optional(),
      pickStrategy: z.enum(['discrete', 'batch', 'zone']),
      orderIds: z.array(z.string().uuid()).min(1),
      cutoffAt: z.string().nullable().optional(),
    }).parse((req as any).body);

    const orgId = (req as any).orgId || 'default-org';
    const actorId = (req as any).userId || 'system';

    const result = await commandBus.dispatch({
      type: CREATE_WAVE,
      orgId, actorId,
      payload: body,
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) { reply.code(400); return { data: null, error: result.error }; }
    reply.code(201);
    return { data: result.data, error: null };
  });

  // POST /api/v1/waves/:id/release — allocate inventory and create pick tasks
  server.post('/api/v1/waves/:id/release', {
    schema: {
      tags: ['WMS - Waves & Picking'],
      summary: 'Release wave: allocate inventory and generate pick tasks',
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const orgId = (req as any).orgId || 'default-org';
    const actorId = (req as any).userId || 'system';

    const result = await commandBus.dispatch({
      type: RELEASE_WAVE,
      orgId, actorId,
      payload: { waveId: id },
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) { reply.code(400); return { data: null, error: result.error }; }
    return { data: result.data, error: null };
  });

  // ═══════════════════════════════════════════════════════════
  // PICK TASKS
  // ═══════════════════════════════════════════════════════════

  // GET /api/v1/pick-tasks?locationId=xxx&status=xxx
  server.get('/api/v1/pick-tasks', {
    schema: {
      tags: ['WMS - Waves & Picking'],
      summary: 'List pick tasks',
      querystring: {
        type: 'object',
        required: ['locationId'],
        properties: {
          locationId: { type: 'string', format: 'uuid' },
          status: { type: 'string' },
          waveId: { type: 'string', format: 'uuid' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const q = req.query as any;
    const where: any = { locationId: q.locationId };
    if (q.status) where.status = q.status;
    if (q.waveId) where.waveId = q.waveId;

    const tasks = await prisma.pickTask.findMany({
      where,
      include: {
        wave: { select: { waveNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { data: tasks, error: null };
  });

  // GET /api/v1/pick-tasks/:id
  server.get('/api/v1/pick-tasks/:id', {
    schema: {
      tags: ['WMS - Waves & Picking'],
      summary: 'Get pick task detail with lines',
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const task = await prisma.pickTask.findUnique({
      where: { id },
      include: {
        wave: { select: { waveNumber: true, pickStrategy: true } },
        pickLines: {
          include: {
            bin: { select: { label: true, zone: { select: { name: true } } } },
          },
          orderBy: { walkSequence: 'asc' },
        },
      },
    });
    if (!task) { reply.code(404); return { data: null, error: 'Pick task not found' }; }
    return { data: task, error: null };
  });

  // POST /api/v1/pick-tasks/:id/assign
  server.post('/api/v1/pick-tasks/:id/assign', {
    schema: {
      tags: ['WMS - Waves & Picking'],
      summary: 'Assign pick task to a worker',
      body: { type: 'object', required: ['assignedToUserId'], properties: { assignedToUserId: { type: 'string' } } },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const { assignedToUserId } = (req as any).body;

    const task = await prisma.pickTask.findUnique({ where: { id } });
    if (!task) { reply.code(404); return { data: null, error: 'Pick task not found' }; }

    const updated = await prisma.pickTask.update({
      where: { id },
      data: { assignedToUserId, status: 'assigned' },
    });

    return { data: updated, error: null };
  });

  // POST /api/v1/pick-lines/:id/complete — complete a single pick line
  server.post('/api/v1/pick-lines/:id/complete', {
    schema: {
      tags: ['WMS - Waves & Picking'],
      summary: 'Complete a pick line (scan item at bin)',
      body: {
        type: 'object',
        required: ['pickedQuantity'],
        properties: {
          pickedQuantity: { type: 'integer', minimum: 0 },
          shortPickAction: { type: 'string', enum: ['backorder', 'cancel_line'] },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      pickedQuantity: z.number().int().min(0),
      shortPickAction: z.enum(['backorder', 'cancel_line']).optional(),
    }).parse((req as any).body);

    const orgId = (req as any).orgId || 'default-org';
    const actorId = (req as any).userId || 'system';

    const result = await commandBus.dispatch({
      type: COMPLETE_PICK_LINE,
      orgId, actorId,
      payload: { pickLineId: id, ...body },
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) { reply.code(400); return { data: null, error: result.error }; }
    return { data: result.data, error: null };
  });
}
