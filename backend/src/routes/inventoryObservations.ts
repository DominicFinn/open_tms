import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { container, TOKENS } from '../di/index.js';
import { ICommandBus } from '../commands/CommandBus.js';
import { RECORD_INVENTORY_OBSERVATION } from '../commands/inventory/RecordInventoryObservationCommand.js';
import { IInventoryObservationRepository } from '../repositories/InventoryObservationRepository.js';
import { registerOrgScope } from '../auth/orgScopeMiddleware.js';
import { registerWmsGuard } from '../auth/wmsGuard.js';

/**
 * Inventory observations (#233): ad hoc scan/spot-check records, distinct from CycleCount.
 * Reachable by the admin JWT (wms:read/wms:write, same family the rest of the inventory module
 * already uses) and by the narrower `scope: 'inventory'` mobile session — see jwtAuth.ts.
 */
export async function inventoryObservationRoutes(server: FastifyInstance) {
  await registerOrgScope(server);
  await registerWmsGuard(server);

  const commandBus = container.resolve<ICommandBus>(TOKENS.ICommandBus);
  const repo = container.resolve<IInventoryObservationRepository>(TOKENS.IInventoryObservationRepository);

  // GET /api/v1/inventory/observations?locationId=xxx&sku=xxx — recent observations, newest first
  server.get('/api/v1/inventory/observations', {
    schema: {
      tags: ['Inventory - Observations'],
      summary: 'List recent inventory observations for a location',
      querystring: {
        type: 'object',
        required: ['locationId'],
        properties: {
          locationId: { type: 'string', format: 'uuid' },
          sku: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const q = req.query as { locationId: string; sku?: string };
    const observations = await repo.listRecent(req.orgId!, q.locationId, q.sku);
    return { data: observations, error: null };
  });

  // POST /api/v1/inventory/observations — record an ad hoc scan/spot-check
  server.post('/api/v1/inventory/observations', {
    schema: {
      tags: ['Inventory - Observations'],
      summary: 'Record an inventory observation (scan or spot-check)',
      body: {
        type: 'object',
        required: ['locationId', 'binId', 'sku'],
        properties: {
          locationId: { type: 'string', format: 'uuid' },
          binId: { type: 'string', format: 'uuid' },
          sku: { type: 'string', minLength: 1 },
          uomCode: { type: 'string' },
          observedQuantity: { type: 'integer', minimum: 0 },
          lotNumber: { type: 'string' },
          notes: { type: 'string', maxLength: 2000 },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      locationId: z.string().uuid(),
      binId: z.string().uuid(),
      sku: z.string().min(1),
      uomCode: z.string().optional(),
      observedQuantity: z.number().int().min(0).optional(),
      lotNumber: z.string().optional(),
      notes: z.string().max(2000).optional(),
    }).parse(req.body);

    const result = await commandBus.dispatch({
      type: RECORD_INVENTORY_OBSERVATION,
      orgId: req.orgId!,
      actorId: req.user?.sub ?? null,
      payload: body,
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error };
    }

    reply.code(201);
    return { data: result.data, error: null };
  });
}
