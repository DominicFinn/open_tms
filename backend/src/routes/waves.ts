import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { container, TOKENS } from '../di/index.js';
import { WAREHOUSE_SCOPE_QUERY, WAREHOUSE_SCOPE_ONE_OF, warehouseScopeFrom } from '../repositories/warehouseScope.js';
import { ICommandBus } from '../commands/CommandBus.js';
import { CREATE_WAVE } from '../commands/warehouse/CreateWaveCommand.js';
import { RELEASE_WAVE } from '../commands/warehouse/ReleaseWaveCommand.js';
import { COMPLETE_PICK_LINE } from '../commands/warehouse/CompletePickLineCommand.js';
import { IWaveRepository } from '../repositories/WaveRepository.js';
import { ASSIGN_PICK_TASK } from '../commands/warehouse/AssignPickTaskCommand.js';
import crypto from 'crypto';
import { registerWmsGuard } from '../auth/wmsGuard.js';

export async function waveRoutes(server: FastifyInstance) {
  // WMS permission guard (#134): wms:read for reads, wms:write for mutations
  await registerWmsGuard(server);

  const commandBus = container.resolve<ICommandBus>(TOKENS.ICommandBus);
  const repo = container.resolve<IWaveRepository>(TOKENS.IWaveRepository);

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
        oneOf: WAREHOUSE_SCOPE_ONE_OF,
        properties: {
          ...WAREHOUSE_SCOPE_QUERY,
          status: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const q = req.query as { facilityId?: string; locationId?: string; status?: string };
    const waves = await repo.findWaves(req.orgId!, warehouseScopeFrom(q), q.status);
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
    // A cross-tenant id misses rather than 403s, so existence stays opaque.
    const wave = await repo.findWaveById(req.orgId!, id);
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

    const result = await commandBus.dispatch({
      type: CREATE_WAVE,
      orgId: req.orgId!,
      actorId: req.user?.sub ?? null,
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
    const result = await commandBus.dispatch({
      type: RELEASE_WAVE,
      orgId: req.orgId!,
      actorId: req.user?.sub ?? null,
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
        oneOf: WAREHOUSE_SCOPE_ONE_OF,
        properties: {
          ...WAREHOUSE_SCOPE_QUERY,
          status: { type: 'string' },
          waveId: { type: 'string', format: 'uuid' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const q = req.query as { facilityId?: string; locationId?: string; status?: string; waveId?: string };
    const tasks = await repo.findPickTasks(req.orgId!, warehouseScopeFrom(q), {
      status: q.status,
      waveId: q.waveId,
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
    const task = await repo.findPickTaskById(req.orgId!, id);
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
    const { assignedToUserId } = z.object({
      assignedToUserId: z.string().min(1),
    }).parse(req.body);

    const result = await commandBus.dispatch({
      type: ASSIGN_PICK_TASK,
      orgId: req.orgId!,
      actorId: req.user?.sub ?? null,
      payload: { taskId: id, assignedToUserId },
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) {
      if (result.error?.includes('not found')) {
        return reply.code(404).send({ data: null, error: result.error });
      }
      const conflict = result.error?.includes('Cannot assign');
      return reply.code(conflict ? 409 : 400).send({ data: null, error: result.error });
    }

    return { data: result.data, error: null };
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

    const result = await commandBus.dispatch({
      type: COMPLETE_PICK_LINE,
      orgId: req.orgId!,
      actorId: req.user?.sub ?? null,
      payload: { pickLineId: id, ...body },
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) { reply.code(400); return { data: null, error: result.error }; }
    return { data: result.data, error: null };
  });
}
