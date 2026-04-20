import { FastifyInstance, FastifyRequest } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { container, TOKENS } from '../di/index.js';
import { ContainerIntelligenceService } from '../services/containers/ContainerIntelligenceService.js';

export async function containerIntelligenceRoutes(server: FastifyInstance) {
  const prisma = container.resolve<PrismaClient>(TOKENS.PrismaClient);
  const service = new ContainerIntelligenceService();

  server.post('/api/v1/containers/recommend', {
    schema: {
      tags: ['WMS - Container Intelligence'],
      summary: 'Recommend package split + ancillaries for a list of pack items',
      body: {
        type: 'object',
        required: ['items'],
        properties: {
          locationId: { type: 'string', format: 'uuid' },
          transitHours: { type: 'integer' },
          forceSingleContainer: { type: 'boolean' },
          items: {
            type: 'array', minItems: 1,
            items: {
              type: 'object',
              required: ['sku', 'quantity', 'lengthMm', 'widthMm', 'heightMm', 'weightGrams', 'temperatureZone'],
              properties: {
                sku: { type: 'string' },
                quantity: { type: 'integer', minimum: 1 },
                lengthMm: { type: 'integer', minimum: 1 },
                widthMm: { type: 'integer', minimum: 1 },
                heightMm: { type: 'integer', minimum: 1 },
                weightGrams: { type: 'integer', minimum: 1 },
                temperatureZone: { type: 'string', enum: ['ambient', 'refrigerated', 'frozen', 'dry_ice'] },
                hazmat: { type: 'boolean' },
                hazmatClass: { type: 'string' },
                valueClass: { type: 'string', enum: ['standard', 'high_value'] },
                fragile: { type: 'boolean' },
                humiditySensitive: { type: 'boolean' },
              },
            },
          },
        },
      },
    },
  }, async (req: FastifyRequest) => {
    const body = req.body as any;
    const orgId = (req as any).orgId
      || (await prisma.organization.findFirst({ select: { id: true } }))?.id
      || 'default-org';

    const where: any = { orgId, active: true };
    if (body.locationId) where.locationId = body.locationId;
    const cartons = await prisma.cartonCatalogue.findMany({ where });

    const result = service.recommend(
      body.items,
      cartons,
      { transitHours: body.transitHours, forceSingleContainer: body.forceSingleContainer },
    );
    return { data: result, error: null };
  });
}
