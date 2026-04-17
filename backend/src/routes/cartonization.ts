import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { container, TOKENS } from '../di/index.js';
import { ICartonizationService } from '../services/CartonizationService.js';

export async function cartonizationRoutes(server: FastifyInstance) {
  const cartonService = container.resolve<ICartonizationService>(TOKENS.ICartonizationService);

  // POST /api/v1/cartonization/recommend
  server.post('/api/v1/cartonization/recommend', {
    schema: {
      tags: ['WMS - Cartonization'],
      summary: 'Get carton recommendation for a set of items',
      description: 'Looks up item dimensions from ProductUom (then OrderLineItem fallback), calculates total volume/weight, recommends smallest fitting carton from the catalogue.',
      body: {
        type: 'object', required: ['locationId', 'items'],
        properties: {
          locationId: { type: 'string', format: 'uuid' },
          items: {
            type: 'array', minItems: 1,
            items: {
              type: 'object', required: ['sku', 'quantity'],
              properties: {
                sku: { type: 'string' },
                quantity: { type: 'integer', minimum: 1 },
                orderLineItemId: { type: 'string', format: 'uuid' },
              },
            },
          },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      locationId: z.string().uuid(),
      items: z.array(z.object({
        sku: z.string().min(1),
        quantity: z.number().int().min(1),
        orderLineItemId: z.string().uuid().optional(),
      })).min(1),
    }).parse((req as any).body);

    const orgId = (req as any).orgId || 'default-org';

    const result = await cartonService.recommend(body.locationId, orgId, body.items);
    return { data: result, error: null };
  });
}
