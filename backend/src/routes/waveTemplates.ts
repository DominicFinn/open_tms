import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { container, TOKENS } from '../di/index.js';
import { ICommandBus } from '../commands/CommandBus.js';
import { CREATE_WAVE_TEMPLATE } from '../commands/warehouse/CreateWaveTemplateCommand.js';
import { APPLY_WAVE_TEMPLATE } from '../commands/warehouse/ApplyWaveTemplateCommand.js';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

export async function waveTemplateRoutes(server: FastifyInstance) {
  const commandBus = container.resolve<ICommandBus>(TOKENS.ICommandBus);
  const prisma = container.resolve<PrismaClient>(TOKENS.PrismaClient);

  // GET /api/v1/wave-templates?locationId=xxx
  server.get('/api/v1/wave-templates', {
    schema: {
      tags: ['WMS - Wave Templates'],
      summary: 'List wave templates',
      querystring: { type: 'object', required: ['locationId'], properties: { locationId: { type: 'string', format: 'uuid' } } },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { locationId } = req.query as { locationId: string };
    const templates = await prisma.waveTemplate.findMany({
      where: { locationId },
      include: { _count: { select: { waves: true } } },
      orderBy: { priority: 'asc' },
    });
    return { data: templates, error: null };
  });

  // GET /api/v1/wave-templates/:id
  server.get('/api/v1/wave-templates/:id', {
    schema: { tags: ['WMS - Wave Templates'], summary: 'Get wave template detail' },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const template = await prisma.waveTemplate.findUnique({
      where: { id },
      include: { waves: { orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, waveNumber: true, status: true, orderCount: true, createdAt: true } } },
    });
    if (!template) { reply.code(404); return { data: null, error: 'Template not found' }; }
    return { data: template, error: null };
  });

  // POST /api/v1/wave-templates
  server.post('/api/v1/wave-templates', {
    schema: {
      tags: ['WMS - Wave Templates'],
      summary: 'Create a wave template',
      body: {
        type: 'object', required: ['locationId', 'name', 'pickStrategy'],
        properties: {
          locationId: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          groupingRules: { type: 'object', nullable: true, description: 'e.g. { customer: "id", status: "accepted" }' },
          cutoffTime: { type: 'string', nullable: true, description: 'HH:MM format' },
          pickStrategy: { type: 'string', enum: ['discrete', 'batch', 'zone'] },
          minOrders: { type: 'integer', nullable: true },
          maxOrders: { type: 'integer', nullable: true },
          maxLabourHours: { type: 'number', nullable: true },
          priority: { type: 'integer' },
          releaseSchedule: { type: 'string', nullable: true, description: 'Cron expression for auto-release' },
          autoRelease: { type: 'boolean' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      locationId: z.string().uuid(),
      name: z.string().min(1).max(100),
      groupingRules: z.record(z.unknown()).nullable().optional(),
      cutoffTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
      pickStrategy: z.enum(['discrete', 'batch', 'zone']),
      minOrders: z.number().int().min(1).nullable().optional(),
      maxOrders: z.number().int().min(1).nullable().optional(),
      maxLabourHours: z.number().positive().nullable().optional(),
      priority: z.number().int().min(1).max(100).optional(),
      releaseSchedule: z.string().nullable().optional(),
      autoRelease: z.boolean().optional(),
    }).parse((req as any).body);

    const orgId = (req as any).orgId || 'default-org';
    const actorId = (req as any).userId || 'system';

    const result = await commandBus.dispatch({
      type: CREATE_WAVE_TEMPLATE, orgId, actorId, payload: body,
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) { reply.code(400); return { data: null, error: result.error }; }
    reply.code(201);
    return { data: result.data, error: null };
  });

  // PUT /api/v1/wave-templates/:id
  server.put('/api/v1/wave-templates/:id', {
    schema: {
      tags: ['WMS - Wave Templates'],
      summary: 'Update a wave template',
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          groupingRules: { type: 'object', nullable: true },
          cutoffTime: { type: 'string', nullable: true },
          pickStrategy: { type: 'string', enum: ['discrete', 'batch', 'zone'] },
          minOrders: { type: 'integer', nullable: true },
          maxOrders: { type: 'integer', nullable: true },
          priority: { type: 'integer' },
          releaseSchedule: { type: 'string', nullable: true },
          autoRelease: { type: 'boolean' },
          active: { type: 'boolean' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      name: z.string().min(1).max(100).optional(),
      groupingRules: z.record(z.unknown()).nullable().optional(),
      cutoffTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
      pickStrategy: z.enum(['discrete', 'batch', 'zone']).optional(),
      minOrders: z.number().int().min(1).nullable().optional(),
      maxOrders: z.number().int().min(1).nullable().optional(),
      priority: z.number().int().min(1).max(100).optional(),
      releaseSchedule: z.string().nullable().optional(),
      autoRelease: z.boolean().optional(),
      active: z.boolean().optional(),
    }).parse((req as any).body);

    const template = await prisma.waveTemplate.findUnique({ where: { id } });
    if (!template) { reply.code(404); return { data: null, error: 'Template not found' }; }

    const updated = await prisma.waveTemplate.update({ where: { id }, data: body });
    return { data: updated, error: null };
  });

  // POST /api/v1/wave-templates/:id/apply — run the template now
  server.post('/api/v1/wave-templates/:id/apply', {
    schema: {
      tags: ['WMS - Wave Templates'],
      summary: 'Apply template: find eligible orders and create a wave',
      body: {
        type: 'object',
        properties: { autoRelease: { type: 'boolean', description: 'Override auto-release for this run' } },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = z.object({ autoRelease: z.boolean().optional() }).parse((req as any).body ?? {});

    const orgId = (req as any).orgId || 'default-org';
    const actorId = (req as any).userId || 'system';

    const result = await commandBus.dispatch({
      type: APPLY_WAVE_TEMPLATE, orgId, actorId,
      payload: { templateId: id, ...body },
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) { reply.code(400); return { data: null, error: result.error }; }
    return { data: result.data, error: null };
  });

  // DELETE /api/v1/wave-templates/:id
  server.delete('/api/v1/wave-templates/:id', {
    schema: { tags: ['WMS - Wave Templates'], summary: 'Delete a wave template' },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    await prisma.waveTemplate.delete({ where: { id } }).catch(() => null);
    return { data: { deleted: true }, error: null };
  });
}
