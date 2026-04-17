import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { container, TOKENS } from '../di/index.js';
import { PrismaClient } from '@prisma/client';

export async function cartonCatalogueRoutes(server: FastifyInstance) {
  const prisma = container.resolve<PrismaClient>(TOKENS.PrismaClient);

  // GET /api/v1/carton-catalogue?locationId=xxx
  server.get('/api/v1/carton-catalogue', {
    schema: {
      tags: ['WMS - Cartonization'],
      summary: 'List available carton types for a location',
      querystring: { type: 'object', properties: { locationId: { type: 'string', format: 'uuid' } } },
    },
  }, async (req: FastifyRequest) => {
    const q = req.query as any;
    const orgId = (req as any).orgId || 'default-org';
    const where: any = { orgId, active: true };
    if (q.locationId) where.locationId = q.locationId;

    const cartons = await prisma.cartonCatalogue.findMany({
      where,
      orderBy: [{ lengthMm: 'asc' }, { widthMm: 'asc' }],
    });

    return { data: cartons, error: null };
  });

  // POST /api/v1/carton-catalogue
  server.post('/api/v1/carton-catalogue', {
    schema: {
      tags: ['WMS - Cartonization'],
      summary: 'Add a carton type to the catalogue',
      body: {
        type: 'object', required: ['locationId', 'name', 'lengthMm', 'widthMm', 'heightMm', 'maxWeightGrams'],
        properties: {
          locationId: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          lengthMm: { type: 'integer', minimum: 1 },
          widthMm: { type: 'integer', minimum: 1 },
          heightMm: { type: 'integer', minimum: 1 },
          maxWeightGrams: { type: 'integer', minimum: 1 },
          unitCostCents: { type: 'integer', nullable: true },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      locationId: z.string().uuid(),
      name: z.string().min(1),
      lengthMm: z.number().int().min(1),
      widthMm: z.number().int().min(1),
      heightMm: z.number().int().min(1),
      maxWeightGrams: z.number().int().min(1),
      unitCostCents: z.number().int().nullable().optional(),
    }).parse((req as any).body);

    const orgId = (req as any).orgId || 'default-org';
    const carton = await prisma.cartonCatalogue.create({ data: { ...body, orgId } });

    reply.code(201);
    return { data: carton, error: null };
  });

  // PUT /api/v1/carton-catalogue/:id
  server.put('/api/v1/carton-catalogue/:id', {
    schema: { tags: ['WMS - Cartonization'], summary: 'Update a carton type' },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      name: z.string().min(1).optional(),
      lengthMm: z.number().int().min(1).optional(),
      widthMm: z.number().int().min(1).optional(),
      heightMm: z.number().int().min(1).optional(),
      maxWeightGrams: z.number().int().min(1).optional(),
      unitCostCents: z.number().int().nullable().optional(),
      active: z.boolean().optional(),
    }).parse((req as any).body);

    const updated = await prisma.cartonCatalogue.update({ where: { id }, data: body }).catch(() => null);
    if (!updated) { reply.code(404); return { data: null, error: 'Not found' }; }
    return { data: updated, error: null };
  });

  // DELETE /api/v1/carton-catalogue/:id
  server.delete('/api/v1/carton-catalogue/:id', {
    schema: { tags: ['WMS - Cartonization'], summary: 'Remove a carton type' },
  }, async (req: FastifyRequest) => {
    const { id } = req.params as { id: string };
    await prisma.cartonCatalogue.delete({ where: { id } }).catch(() => null);
    return { data: { deleted: true }, error: null };
  });
}
