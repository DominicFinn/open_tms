import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { container, TOKENS } from '../di/index.js';
import { ICommandBus } from '../commands/CommandBus.js';
import { ASSIGN_PUTAWAY_TASK } from '../commands/warehouse/AssignPutawayTaskCommand.js';
import { COMPLETE_PUTAWAY } from '../commands/warehouse/CompletePutawayCommand.js';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

export async function putawayRoutes(server: FastifyInstance) {
  const commandBus = container.resolve<ICommandBus>(TOKENS.ICommandBus);
  const prisma = container.resolve<PrismaClient>(TOKENS.PrismaClient);

  // GET /api/v1/putaway/tasks?locationId=xxx&status=xxx
  server.get('/api/v1/putaway/tasks', {
    schema: {
      tags: ['WMS - Putaway'],
      summary: 'List putaway tasks for a location',
      querystring: {
        type: 'object',
        required: ['locationId'],
        properties: {
          locationId: { type: 'string', format: 'uuid' },
          status: { type: 'string', enum: ['pending', 'assigned', 'in_progress', 'completed', 'cancelled'] },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { locationId, status } = req.query as { locationId: string; status?: string };
    const where: any = { locationId };
    if (status) where.status = status;

    const tasks = await prisma.putawayTask.findMany({
      where,
      include: {
        trackableUnit: { select: { id: true, identifier: true, unitType: true, barcode: true } },
        sourceBin: { select: { id: true, label: true } },
        targetBin: { select: { id: true, label: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { data: tasks, error: null };
  });

  // GET /api/v1/putaway/tasks/:id
  server.get('/api/v1/putaway/tasks/:id', {
    schema: {
      tags: ['WMS - Putaway'],
      summary: 'Get putaway task detail',
      params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const task = await prisma.putawayTask.findUnique({
      where: { id },
      include: {
        trackableUnit: {
          select: {
            id: true, identifier: true, unitType: true, barcode: true,
            lotNumber: true, expiryDate: true, qualityStatus: true,
            lineItems: { select: { sku: true, description: true, quantity: true, weight: true, temperature: true, hazmat: true } },
          },
        },
        sourceBin: { select: { id: true, label: true, binType: true }, },
        targetBin: {
          select: {
            id: true, label: true, binType: true,
            temperatureZone: true, hazmatCertified: true,
            zone: { select: { name: true, zoneType: true, temperatureZone: true, hazmatCertified: true } },
          },
        },
        receivingTask: { select: { id: true, receivingType: true } },
      },
    });

    if (!task) {
      reply.code(404);
      return { data: null, error: 'Putaway task not found' };
    }

    return { data: task, error: null };
  });

  // POST /api/v1/putaway/tasks/:id/assign
  server.post('/api/v1/putaway/tasks/:id/assign', {
    schema: {
      tags: ['WMS - Putaway'],
      summary: 'Assign a putaway task to a worker',
      body: {
        type: 'object',
        required: ['assignedToUserId'],
        properties: {
          assignedToUserId: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      assignedToUserId: z.string().min(1),
    }).parse((req as any).body);

    const orgId = (req as any).orgId || 'default-org';
    const actorId = (req as any).userId || 'system';

    const result = await commandBus.dispatch({
      type: ASSIGN_PUTAWAY_TASK,
      orgId,
      actorId,
      payload: { taskId: id, ...body },
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error };
    }

    return { data: result.data, error: null };
  });

  // POST /api/v1/putaway/tasks/:id/complete — scan-to-confirm completion
  server.post('/api/v1/putaway/tasks/:id/complete', {
    schema: {
      tags: ['WMS - Putaway'],
      summary: 'Complete putaway by scanning the destination bin',
      description: 'The worker scans the bin label where they physically placed the unit. If the scanned bin differs from the directed target, a deviation is recorded but the putaway still completes. Bin constraints (temperature, hazmat) are validated and warnings returned.',
      body: {
        type: 'object',
        required: ['scannedBinLabel'],
        properties: {
          scannedBinLabel: { type: 'string', description: 'The bin label the worker scanned' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      scannedBinLabel: z.string().min(1),
    }).parse((req as any).body);

    const orgId = (req as any).orgId || 'default-org';
    const actorId = (req as any).userId || 'system';

    const result = await commandBus.dispatch({
      type: COMPLETE_PUTAWAY,
      orgId,
      actorId,
      payload: { taskId: id, ...body },
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error };
    }

    return { data: result.data, error: null };
  });

  // GET /api/v1/putaway/rules?locationId=xxx
  server.get('/api/v1/putaway/rules', {
    schema: {
      tags: ['WMS - Putaway'],
      summary: 'List putaway rules for a location',
      querystring: {
        type: 'object',
        required: ['locationId'],
        properties: { locationId: { type: 'string', format: 'uuid' } },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { locationId } = req.query as { locationId: string };
    const rules = await prisma.putawayRule.findMany({
      where: { locationId },
      orderBy: { priority: 'asc' },
    });
    return { data: rules, error: null };
  });

  // POST /api/v1/putaway/rules — create a putaway rule
  server.post('/api/v1/putaway/rules', {
    schema: {
      tags: ['WMS - Putaway'],
      summary: 'Create a putaway rule',
      body: {
        type: 'object',
        required: ['locationId', 'name', 'targetType'],
        properties: {
          locationId: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          priority: { type: 'integer' },
          skuPattern: { type: 'string', nullable: true },
          temperatureRequirement: { type: 'string', nullable: true },
          hazmat: { type: 'boolean', nullable: true },
          customerId: { type: 'string', nullable: true },
          velocityClass: { type: 'string', nullable: true },
          unitType: { type: 'string', nullable: true },
          crossDockSortBy: { type: 'string', nullable: true },
          targetType: { type: 'string', enum: ['zone', 'specific_bin', 'next_available_in_zone'] },
          targetZoneId: { type: 'string', format: 'uuid', nullable: true },
          targetBinId: { type: 'string', format: 'uuid', nullable: true },
          preferLevel: { type: 'string', enum: ['low', 'medium', 'high'], nullable: true },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      locationId: z.string().uuid(),
      name: z.string().min(1).max(100),
      priority: z.number().int().min(1).max(100).optional().default(50),
      skuPattern: z.string().nullable().optional(),
      temperatureRequirement: z.string().nullable().optional(),
      hazmat: z.boolean().nullable().optional(),
      customerId: z.string().nullable().optional(),
      velocityClass: z.string().nullable().optional(),
      unitType: z.string().nullable().optional(),
      crossDockSortBy: z.string().nullable().optional(),
      targetType: z.enum(['zone', 'specific_bin', 'next_available_in_zone']),
      targetZoneId: z.string().uuid().nullable().optional(),
      targetBinId: z.string().uuid().nullable().optional(),
      preferLevel: z.enum(['low', 'medium', 'high']).nullable().optional(),
    }).parse((req as any).body);

    const orgId = (req as any).orgId || 'default-org';

    const rule = await prisma.putawayRule.create({
      data: { ...body, orgId },
    });

    reply.code(201);
    return { data: rule, error: null };
  });
}
