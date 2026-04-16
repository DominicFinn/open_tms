import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { container, TOKENS } from '../di/index.js';
import { ICommandBus } from '../commands/CommandBus.js';
import { CREATE_PACK_TASK } from '../commands/warehouse/CreatePackTaskCommand.js';
import { COMPLETE_PACK_LINE } from '../commands/warehouse/CompletePackLineCommand.js';
import { CREATE_STAGING_ASSIGNMENT } from '../commands/warehouse/CreateStagingAssignmentCommand.js';
import { COMPLETE_LOADING } from '../commands/warehouse/CompleteLoadingCommand.js';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

export async function packingRoutes(server: FastifyInstance) {
  const commandBus = container.resolve<ICommandBus>(TOKENS.ICommandBus);
  const prisma = container.resolve<PrismaClient>(TOKENS.PrismaClient);

  // ═══════════════════════════════════════════════════════════
  // PACK TASKS
  // ═══════════════════════════════════════════════════════════

  // GET /api/v1/pack-tasks?locationId=xxx&status=xxx
  server.get('/api/v1/pack-tasks', {
    schema: {
      tags: ['WMS - Packing & Loading'],
      summary: 'List pack tasks',
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

    const tasks = await prisma.packTask.findMany({
      where,
      include: {
        packLines: { select: { id: true, status: true } },
        packStationBin: { select: { label: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const mapped = tasks.map(t => ({
      ...t,
      lineCount: t.packLines.length,
      packedLines: t.packLines.filter(l => l.status === 'packed').length,
      packStation: (t as any).packStationBin?.label ?? null,
      packLines: undefined,
      packStationBin: undefined,
    }));

    return { data: mapped, error: null };
  });

  // GET /api/v1/pack-tasks/:id
  server.get('/api/v1/pack-tasks/:id', {
    schema: { tags: ['WMS - Packing & Loading'], summary: 'Get pack task detail with lines' },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const task = await prisma.packTask.findUnique({
      where: { id },
      include: {
        packLines: { orderBy: { createdAt: 'asc' } },
        packStationBin: { select: { label: true } },
        pickTask: { select: { id: true, wave: { select: { waveNumber: true } } } },
      },
    });
    if (!task) { reply.code(404); return { data: null, error: 'Pack task not found' }; }
    return { data: task, error: null };
  });

  // POST /api/v1/pack-tasks
  server.post('/api/v1/pack-tasks', {
    schema: {
      tags: ['WMS - Packing & Loading'],
      summary: 'Create a pack task (typically after pick completion)',
      body: {
        type: 'object', required: ['locationId', 'orderId', 'lines'],
        properties: {
          locationId: { type: 'string', format: 'uuid' },
          orderId: { type: 'string', format: 'uuid' },
          pickTaskId: { type: 'string', format: 'uuid', nullable: true },
          packStationBinId: { type: 'string', format: 'uuid', nullable: true },
          lines: { type: 'array', items: { type: 'object', required: ['orderLineItemId', 'trackableUnitId', 'sku', 'expectedQuantity'], properties: {
            orderLineItemId: { type: 'string' }, trackableUnitId: { type: 'string' },
            sku: { type: 'string' }, expectedQuantity: { type: 'integer' },
          }}},
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      locationId: z.string().uuid(),
      orderId: z.string().uuid(),
      pickTaskId: z.string().uuid().nullable().optional(),
      packStationBinId: z.string().uuid().nullable().optional(),
      lines: z.array(z.object({
        orderLineItemId: z.string(), trackableUnitId: z.string(),
        sku: z.string(), expectedQuantity: z.number().int().min(1),
      })).min(1),
    }).parse((req as any).body);

    const orgId = (req as any).orgId || 'default-org';
    const actorId = (req as any).userId || 'system';

    const result = await commandBus.dispatch({
      type: CREATE_PACK_TASK, orgId, actorId, payload: body,
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) { reply.code(400); return { data: null, error: result.error }; }
    reply.code(201);
    return { data: result.data, error: null };
  });

  // POST /api/v1/pack-lines/:id/complete
  server.post('/api/v1/pack-lines/:id/complete', {
    schema: {
      tags: ['WMS - Packing & Loading'],
      summary: 'Verify and pack a line item',
      body: {
        type: 'object', required: ['packedQuantity'],
        properties: {
          packedQuantity: { type: 'integer', minimum: 0 },
          trackableUnitId: { type: 'string', format: 'uuid', description: 'Outbound package unit' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      packedQuantity: z.number().int().min(0),
      trackableUnitId: z.string().uuid().optional(),
    }).parse((req as any).body);

    const orgId = (req as any).orgId || 'default-org';
    const actorId = (req as any).userId || 'system';

    const result = await commandBus.dispatch({
      type: COMPLETE_PACK_LINE, orgId, actorId,
      payload: { packLineId: id, ...body },
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) { reply.code(400); return { data: null, error: result.error }; }
    return { data: result.data, error: null };
  });

  // ═══════════════════════════════════════════════════════════
  // STAGING & LOADING
  // ═══════════════════════════════════════════════════════════

  // GET /api/v1/staging?locationId=xxx&status=xxx
  server.get('/api/v1/staging', {
    schema: {
      tags: ['WMS - Packing & Loading'],
      summary: 'List staging assignments',
      querystring: {
        type: 'object', required: ['locationId'],
        properties: {
          locationId: { type: 'string', format: 'uuid' },
          status: { type: 'string', enum: ['staged', 'loading', 'loaded', 'dispatched'] },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const q = req.query as any;
    const where: any = { locationId: q.locationId };
    if (q.status) where.status = q.status;

    const assignments = await prisma.stagingAssignment.findMany({
      where,
      include: {
        stagingBin: { select: { label: true } },
        trackableUnit: { select: { identifier: true, unitType: true } },
      },
      orderBy: [{ loadSequence: 'asc' }, { createdAt: 'desc' }],
    });

    return { data: assignments, error: null };
  });

  // POST /api/v1/staging
  server.post('/api/v1/staging', {
    schema: {
      tags: ['WMS - Packing & Loading'],
      summary: 'Create a staging assignment (move packed unit to staging area)',
      body: {
        type: 'object', required: ['locationId', 'orderId', 'trackableUnitId', 'stagingBinId'],
        properties: {
          locationId: { type: 'string', format: 'uuid' },
          orderId: { type: 'string', format: 'uuid' },
          trackableUnitId: { type: 'string', format: 'uuid' },
          stagingBinId: { type: 'string', format: 'uuid' },
          shipmentId: { type: 'string', nullable: true },
          loadSequence: { type: 'integer', nullable: true },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      locationId: z.string().uuid(),
      orderId: z.string().uuid(),
      trackableUnitId: z.string().uuid(),
      stagingBinId: z.string().uuid(),
      shipmentId: z.string().nullable().optional(),
      loadSequence: z.number().int().nullable().optional(),
    }).parse((req as any).body);

    const orgId = (req as any).orgId || 'default-org';
    const actorId = (req as any).userId || 'system';

    const result = await commandBus.dispatch({
      type: CREATE_STAGING_ASSIGNMENT, orgId, actorId, payload: body,
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) { reply.code(400); return { data: null, error: result.error }; }
    reply.code(201);
    return { data: result.data, error: null };
  });

  // POST /api/v1/staging/load — mark assignments as loaded onto vehicle
  server.post('/api/v1/staging/load', {
    schema: {
      tags: ['WMS - Packing & Loading'],
      summary: 'Complete loading: mark staged assignments as loaded',
      body: {
        type: 'object', required: ['assignmentIds'],
        properties: {
          assignmentIds: { type: 'array', items: { type: 'string', format: 'uuid' }, minItems: 1 },
          shipmentId: { type: 'string', nullable: true },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      assignmentIds: z.array(z.string().uuid()).min(1),
      shipmentId: z.string().nullable().optional(),
    }).parse((req as any).body);

    const orgId = (req as any).orgId || 'default-org';
    const actorId = (req as any).userId || 'system';

    const result = await commandBus.dispatch({
      type: COMPLETE_LOADING, orgId, actorId, payload: body,
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) { reply.code(400); return { data: null, error: result.error }; }
    return { data: result.data, error: null };
  });
}
