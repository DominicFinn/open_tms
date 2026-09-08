import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { container, TOKENS } from '../di/index.js';
import { WAREHOUSE_SCOPE_QUERY, WAREHOUSE_SCOPE_ONE_OF, warehouseScopeFrom } from '../repositories/warehouseScope.js';
import { ICommandBus } from '../commands/CommandBus.js';
import { CREATE_WAVE_TEMPLATE } from '../commands/warehouse/CreateWaveTemplateCommand.js';
import { APPLY_WAVE_TEMPLATE } from '../commands/warehouse/ApplyWaveTemplateCommand.js';
import { IWaveTemplateRepository } from '../repositories/WaveTemplateRepository.js';
import { UPDATE_WAVE_TEMPLATE } from '../commands/warehouse/UpdateWaveTemplateCommand.js';
import { DELETE_WAVE_TEMPLATE } from '../commands/warehouse/DeleteWaveTemplateCommand.js';
import crypto from 'crypto';
import { registerWmsGuard } from '../auth/wmsGuard.js';

export async function waveTemplateRoutes(server: FastifyInstance) {
  // WMS permission guard (#134): wms:read for reads, wms:write for mutations
  await registerWmsGuard(server);

  const commandBus = container.resolve<ICommandBus>(TOKENS.ICommandBus);
  const repo = container.resolve<IWaveTemplateRepository>(TOKENS.IWaveTemplateRepository);

  // GET /api/v1/wave-templates?locationId=xxx
  server.get('/api/v1/wave-templates', {
    schema: {
      tags: ['WMS - Wave Templates'],
      summary: 'List wave templates',
      querystring: { type: 'object', oneOf: WAREHOUSE_SCOPE_ONE_OF, properties: { ...WAREHOUSE_SCOPE_QUERY } },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const q = req.query as { facilityId?: string; locationId?: string; };
    const templates = await repo.find(req.orgId!, warehouseScopeFrom(q));
    return { data: templates, error: null };
  });

  // GET /api/v1/wave-templates/:id
  server.get('/api/v1/wave-templates/:id', {
    schema: { tags: ['WMS - Wave Templates'], summary: 'Get wave template detail' },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    // A cross-tenant id misses rather than 403s, so existence stays opaque.
    const template = await repo.findById(req.orgId!, id);
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
          zonePickMode: { type: 'string', enum: ['sequential', 'parallel'], nullable: true, description: 'Only used when pickStrategy=zone. sequential = pick-and-pass, parallel = pick-and-merge' },
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
      zonePickMode: z.enum(['sequential', 'parallel']).nullable().optional(),
      minOrders: z.number().int().min(1).nullable().optional(),
      maxOrders: z.number().int().min(1).nullable().optional(),
      maxLabourHours: z.number().positive().nullable().optional(),
      priority: z.number().int().min(1).max(100).optional(),
      releaseSchedule: z.string().nullable().optional(),
      autoRelease: z.boolean().optional(),
    }).parse((req as any).body);

    const result = await commandBus.dispatch({
      type: CREATE_WAVE_TEMPLATE, orgId: req.orgId!, actorId: req.user?.sub ?? null, payload: body,
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
          zonePickMode: { type: 'string', enum: ['sequential', 'parallel'], nullable: true },
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
      zonePickMode: z.enum(['sequential', 'parallel']).nullable().optional(),
      minOrders: z.number().int().min(1).nullable().optional(),
      maxOrders: z.number().int().min(1).nullable().optional(),
      priority: z.number().int().min(1).max(100).optional(),
      releaseSchedule: z.string().nullable().optional(),
      autoRelease: z.boolean().optional(),
      active: z.boolean().optional(),
    }).parse((req as any).body);

    const result = await commandBus.dispatch({
      type: UPDATE_WAVE_TEMPLATE,
      orgId: req.orgId!,
      actorId: req.user?.sub ?? null,
      payload: { templateId: id, ...body },
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) {
      const notFound = result.error?.includes('not found');
      return reply.code(notFound ? 404 : 400).send({ data: null, error: result.error });
    }

    return { data: result.data, error: null };
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

    const result = await commandBus.dispatch({
      type: APPLY_WAVE_TEMPLATE, orgId: req.orgId!, actorId: req.user?.sub ?? null,
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
    const result = await commandBus.dispatch({
      type: DELETE_WAVE_TEMPLATE,
      orgId: req.orgId!,
      actorId: req.user?.sub ?? null,
      payload: { templateId: id },
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) {
      if (result.error?.includes('not found')) {
        return reply.code(404).send({ data: null, error: result.error });
      }
      // Released waves still point at the template, so this is a conflict, not bad input.
      const conflict = result.error?.includes('released waves');
      return reply.code(conflict ? 409 : 400).send({ data: null, error: result.error });
    }

    return { data: { deleted: true }, error: null };
  });
}
