import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { container, TOKENS } from '../di/index.js';
import { WAREHOUSE_SCOPE_QUERY, WAREHOUSE_SCOPE_ONE_OF, warehouseScopeFrom } from '../repositories/warehouseScope.js';
import { ICommandBus } from '../commands/CommandBus.js';
import { CREATE_REPLENISHMENT_RULE } from '../commands/warehouse/CreateReplenishmentRuleCommand.js';
import { CHECK_REPLENISHMENT } from '../commands/warehouse/CheckReplenishmentCommand.js';
import { IReplenishmentRuleRepository } from '../repositories/ReplenishmentRuleRepository.js';
import { UPDATE_REPLENISHMENT_RULE } from '../commands/warehouse/UpdateReplenishmentRuleCommand.js';
import { DELETE_REPLENISHMENT_RULE } from '../commands/warehouse/DeleteReplenishmentRuleCommand.js';
import crypto from 'crypto';
import { registerWmsGuard } from '../auth/wmsGuard.js';

export async function replenishmentRoutes(server: FastifyInstance) {
  // WMS permission guard (#134): wms:read for reads, wms:write for mutations
  await registerWmsGuard(server);

  const commandBus = container.resolve<ICommandBus>(TOKENS.ICommandBus);
  const repo = container.resolve<IReplenishmentRuleRepository>(TOKENS.IReplenishmentRuleRepository);

  // GET /api/v1/replenishment/rules?locationId=xxx
  server.get('/api/v1/replenishment/rules', {
    schema: {
      tags: ['WMS - Replenishment'],
      summary: 'List replenishment rules for a location',
      querystring: {
        type: 'object', oneOf: WAREHOUSE_SCOPE_ONE_OF,
        properties: { ...WAREHOUSE_SCOPE_QUERY },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const q = req.query as { facilityId?: string; locationId?: string; };
    const rules = await repo.find(req.orgId!, warehouseScopeFrom(q));
    return { data: rules, error: null };
  });

  // POST /api/v1/replenishment/rules
  server.post('/api/v1/replenishment/rules', {
    schema: {
      tags: ['WMS - Replenishment'],
      summary: 'Create a replenishment rule',
      body: {
        type: 'object',
        required: ['facilityId', 'sku', 'pickFaceBinId', 'bulkZoneId', 'minQuantity', 'maxQuantity'],
        properties: {
          facilityId: { type: 'string', format: 'uuid' },
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
      facilityId: z.string().uuid(),
      sku: z.string().min(1),
      pickFaceBinId: z.string().uuid(),
      bulkZoneId: z.string().uuid(),
      minQuantity: z.number().int().min(1),
      maxQuantity: z.number().int().min(1),
    }).parse((req as any).body);

    const result = await commandBus.dispatch({
      type: CREATE_REPLENISHMENT_RULE, orgId: req.orgId!, actorId: req.user?.sub ?? null, payload: body,
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

    const result = await commandBus.dispatch({
      type: UPDATE_REPLENISHMENT_RULE,
      orgId: req.orgId!,
      actorId: req.user?.sub ?? null,
      payload: { ruleId: id, ...body },
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) {
      const notFound = result.error?.includes('not found');
      return reply.code(notFound ? 404 : 400).send({ data: null, error: result.error });
    }

    return { data: result.data, error: null };
  });

  // DELETE /api/v1/replenishment/rules/:id
  server.delete('/api/v1/replenishment/rules/:id', {
    schema: { tags: ['WMS - Replenishment'], summary: 'Delete a replenishment rule' },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const result = await commandBus.dispatch({
      type: DELETE_REPLENISHMENT_RULE,
      orgId: req.orgId!,
      actorId: req.user?.sub ?? null,
      payload: { ruleId: id },
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) {
      const notFound = result.error?.includes('not found');
      return reply.code(notFound ? 404 : 400).send({ data: null, error: result.error });
    }

    return { data: { deleted: true }, error: null };
  });

  // POST /api/v1/replenishment/check — manually trigger replenishment check
  server.post('/api/v1/replenishment/check', {
    schema: {
      tags: ['WMS - Replenishment'],
      summary: 'Check replenishment rules and create putaway tasks for depleted pick faces',
      body: {
        type: 'object', required: ['facilityId'],
        properties: {
          facilityId: { type: 'string', format: 'uuid' },
          sku: { type: 'string', description: 'Optionally scope to a single SKU' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      facilityId: z.string().uuid(),
      sku: z.string().optional(),
    }).parse((req as any).body);

    const result = await commandBus.dispatch({
      type: CHECK_REPLENISHMENT, orgId: req.orgId!, actorId: req.user?.sub ?? null, payload: body,
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) { reply.code(400); return { data: null, error: result.error }; }
    return { data: result.data, error: null };
  });
}
