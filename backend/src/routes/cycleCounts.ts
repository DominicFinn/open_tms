import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { container, TOKENS } from '../di/index.js';
import { WAREHOUSE_SCOPE_QUERY, WAREHOUSE_SCOPE_ONE_OF, warehouseScopeFrom } from '../repositories/warehouseScope.js';
import { ICommandBus } from '../commands/CommandBus.js';
import { CREATE_CYCLE_COUNT } from '../commands/warehouse/CreateCycleCountCommand.js';
import { RECORD_CYCLE_COUNT_LINE } from '../commands/warehouse/RecordCycleCountLineCommand.js';
import { ICycleCountRepository } from '../repositories/CycleCountRepository.js';
import crypto from 'crypto';
import { registerWmsGuard } from '../auth/wmsGuard.js';

export async function cycleCountRoutes(server: FastifyInstance) {
  // WMS permission guard (#134): wms:read for reads, wms:write for mutations
  await registerWmsGuard(server);

  const commandBus = container.resolve<ICommandBus>(TOKENS.ICommandBus);
  const repo = container.resolve<ICycleCountRepository>(TOKENS.ICycleCountRepository);

  // GET /api/v1/cycle-counts?locationId=xxx&status=xxx
  server.get('/api/v1/cycle-counts', {
    schema: {
      tags: ['WMS - Cycle Counting'],
      summary: 'List cycle counts',
      querystring: {
        type: 'object', oneOf: WAREHOUSE_SCOPE_ONE_OF,
        properties: {
          ...WAREHOUSE_SCOPE_QUERY,
          status: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const q = req.query as { facilityId?: string; locationId?: string; status?: string };
    const counts = await repo.find(req.orgId!, warehouseScopeFrom(q), q.status);

    return { data: counts, error: null };
  });

  // GET /api/v1/cycle-counts/:id
  server.get('/api/v1/cycle-counts/:id', {
    schema: {
      tags: ['WMS - Cycle Counting'],
      summary: 'Get cycle count detail with lines',
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    // A cross-tenant id misses rather than 403s, so existence stays opaque.
    const count = await repo.findById(req.orgId!, id);
    if (!count) { reply.code(404); return { data: null, error: 'Cycle count not found' }; }
    return { data: count, error: null };
  });

  // POST /api/v1/cycle-counts
  server.post('/api/v1/cycle-counts', {
    schema: {
      tags: ['WMS - Cycle Counting'],
      summary: 'Create a cycle count (full, zone, or random sample)',
      body: {
        type: 'object', required: ['facilityId', 'countType'],
        properties: {
          facilityId: { type: 'string', format: 'uuid' },
          countType: { type: 'string', enum: ['full', 'zone', 'random_sample'] },
          zoneId: { type: 'string', format: 'uuid', nullable: true },
          assignedToUserId: { type: 'string', nullable: true },
          plannedAt: { type: 'string', nullable: true },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      facilityId: z.string().uuid(),
      countType: z.enum(['full', 'zone', 'random_sample']),
      zoneId: z.string().uuid().nullable().optional(),
      assignedToUserId: z.string().nullable().optional(),
      plannedAt: z.string().nullable().optional(),
    }).parse((req as any).body);

    const result = await commandBus.dispatch({
      type: CREATE_CYCLE_COUNT, orgId: req.orgId!, actorId: req.user?.sub ?? null, payload: body,
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

    const result = await commandBus.dispatch({
      type: RECORD_CYCLE_COUNT_LINE, orgId: req.orgId!, actorId: req.user?.sub ?? null,
      payload: { lineId: id, ...body },
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) { reply.code(400); return { data: null, error: result.error }; }
    return { data: result.data, error: null };
  });
}
