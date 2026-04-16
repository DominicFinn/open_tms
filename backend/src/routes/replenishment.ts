import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { container, TOKENS } from '../di/index.js';
import { ICommandBus } from '../commands/CommandBus.js';
import { CREATE_REPLENISHMENT_RULE } from '../commands/warehouse/CreateReplenishmentRuleCommand.js';
import { CHECK_REPLENISHMENT } from '../commands/warehouse/CheckReplenishmentCommand.js';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

export async function replenishmentRoutes(server: FastifyInstance) {
  const commandBus = container.resolve<ICommandBus>(TOKENS.ICommandBus);
  const prisma = container.resolve<PrismaClient>(TOKENS.PrismaClient);

  // GET /api/v1/replenishment/rules?locationId=xxx
  server.get('/api/v1/replenishment/rules', {
    schema: {
      tags: ['WMS - Replenishment'],
      summary: 'List replenishment rules for a location',
      querystring: {
        type: 'object', required: ['locationId'],
        properties: { locationId: { type: 'string', format: 'uuid' } },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { locationId } = req.query as { locationId: string };
    const rules = await prisma.replenishmentRule.findMany({
      where: { locationId },
      orderBy: { sku: 'asc' },
    });
    return { data: rules, error: null };
  });

  // POST /api/v1/replenishment/rules
  server.post('/api/v1/replenishment/rules', {
    schema: {
      tags: ['WMS - Replenishment'],
      summary: 'Create a replenishment rule',
      body: {
        type: 'object',
        required: ['locationId', 'sku', 'pickFaceBinId', 'bulkZoneId', 'minQuantity', 'maxQuantity'],
        properties: {
          locationId: { type: 'string', format: 'uuid' },
          sku: { type: 'string' },
          pickFaceBinId: { type: 'string', format: 'uuid' },
          bulkZoneId: { type: 'string', format: 'uuid' },
          minQuantity: { type: 'integer', minimum: 1 },
          maxQuantity: { type: 'integer', minimum: 1 },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      locationId: z.string().uuid(),
      sku: z.string().min(1),
      pickFaceBinId: z.string().uuid(),
      bulkZoneId: z.string().uuid(),
      minQuantity: z.number().int().min(1),
      maxQuantity: z.number().int().min(1),
    }).parse((req as any).body);

    const orgId = (req as any).orgId || 'default-org';
    const actorId = (req as any).userId || 'system';

    const result = await commandBus.dispatch({
      type: CREATE_REPLENISHMENT_RULE, orgId, actorId, payload: body,
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) { reply.code(400); return { data: null, error: result.error }; }
    reply.code(201);
    return { data: result.data, error: null };
  });

  // PUT /api/v1/replenishment/rules/:id — update rule
  server.put('/api/v1/replenishment/rules/:id', {
    schema: {
      tags: ['WMS - Replenishment'],
      summary: 'Update a replenishment rule',
      body: {
        type: 'object',
        properties: {
          minQuantity: { type: 'integer', minimum: 1 },
          maxQuantity: { type: 'integer', minimum: 1 },
          active: { type: 'boolean' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      minQuantity: z.number().int().min(1).optional(),
      maxQuantity: z.number().int().min(1).optional(),
      active: z.boolean().optional(),
    }).parse((req as any).body);

    const rule = await prisma.replenishmentRule.findUnique({ where: { id } });
    if (!rule) { reply.code(404); return { data: null, error: 'Rule not found' }; }

    const updated = await prisma.replenishmentRule.update({ where: { id }, data: body });
    return { data: updated, error: null };
  });

  // DELETE /api/v1/replenishment/rules/:id
  server.delete('/api/v1/replenishment/rules/:id', {
    schema: { tags: ['WMS - Replenishment'], summary: 'Delete a replenishment rule' },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    await prisma.replenishmentRule.delete({ where: { id } }).catch(() => null);
    return { data: { deleted: true }, error: null };
  });

  // POST /api/v1/replenishment/check — manually trigger replenishment check
  server.post('/api/v1/replenishment/check', {
    schema: {
      tags: ['WMS - Replenishment'],
      summary: 'Check replenishment rules and create putaway tasks for depleted pick faces',
      body: {
        type: 'object', required: ['locationId'],
        properties: {
          locationId: { type: 'string', format: 'uuid' },
          sku: { type: 'string', description: 'Optionally scope to a single SKU' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      locationId: z.string().uuid(),
      sku: z.string().optional(),
    }).parse((req as any).body);

    const orgId = (req as any).orgId || 'default-org';
    const actorId = (req as any).userId || 'system';

    const result = await commandBus.dispatch({
      type: CHECK_REPLENISHMENT, orgId, actorId, payload: body,
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) { reply.code(400); return { data: null, error: result.error }; }
    return { data: result.data, error: null };
  });
}
