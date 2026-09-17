import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { container, TOKENS } from '../di/index.js';
import { PrismaClient } from '@prisma/client';
import { registerWmsGuard } from '../auth/wmsGuard.js';

export async function cartonCatalogueRoutes(server: FastifyInstance) {
  // WMS permission guard (#134): wms:read for reads, wms:write for mutations
  await registerWmsGuard(server);

  const prisma = container.resolve<PrismaClient>(TOKENS.PrismaClient);

  // GET /api/v1/carton-catalogue?facilityId=xxx&includeArchived=true
  server.get('/api/v1/carton-catalogue', {
    schema: {
      tags: ['WMS - Cartonization'],
      summary: 'List carton types for a location',
      querystring: {
        type: 'object',
        properties: {
          facilityId: { type: 'string', format: 'uuid' },
          includeArchived: { type: 'boolean' },
        },
      },
    },
  }, async (req: FastifyRequest) => {
    const q = req.query as any;
    const orgId = req.orgId!;
    const where: any = { orgId };
    const includeArchived = q.includeArchived === true || q.includeArchived === 'true';
    if (!includeArchived) where.active = true;
    if (q.facilityId) where.facilityId = q.facilityId;

    const cartons = await prisma.cartonCatalogue.findMany({
      where,
      orderBy: [{ active: 'desc' }, { lengthMm: 'asc' }, { widthMm: 'asc' }],
    });

    return { data: cartons, error: null };
  });

  // POST /api/v1/carton-catalogue
  server.post('/api/v1/carton-catalogue', {
    schema: {
      tags: ['WMS - Cartonization'],
      summary: 'Add a carton type to the catalogue',
      body: {
        type: 'object', required: ['facilityId', 'name', 'lengthMm', 'widthMm', 'heightMm', 'maxWeightGrams'],
        properties: {
          facilityId: { type: 'string', format: 'uuid' },
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
      facilityId: z.string().uuid(),
      name: z.string().min(1),
      lengthMm: z.number().int().min(1),
      widthMm: z.number().int().min(1),
      heightMm: z.number().int().min(1),
      maxWeightGrams: z.number().int().min(1),
      unitCostCents: z.number().int().nullable().optional(),
      temperatureZone: z.enum(['any', 'ambient', 'refrigerated', 'frozen', 'dry_ice']).optional(),
      insulated: z.boolean().optional(),
      insulationHours: z.number().int().nullable().optional(),
      tamperEvident: z.boolean().optional(),
      valueClass: z.enum(['any', 'standard', 'high_value']).optional(),
      hazmatRated: z.boolean().optional(),
      hazmatClasses: z.array(z.string()).optional(),
      materialType: z.enum(['corrugated', 'plastic', 'metal', 'foam', 'composite']).optional(),
    }).parse((req as any).body);

    const orgId = req.orgId!;
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
      temperatureZone: z.enum(['any', 'ambient', 'refrigerated', 'frozen', 'dry_ice']).optional(),
      insulated: z.boolean().optional(),
      insulationHours: z.number().int().nullable().optional(),
      tamperEvident: z.boolean().optional(),
      valueClass: z.enum(['any', 'standard', 'high_value']).optional(),
      hazmatRated: z.boolean().optional(),
      hazmatClasses: z.array(z.string()).optional(),
      materialType: z.enum(['corrugated', 'plastic', 'metal', 'foam', 'composite']).optional(),
      active: z.boolean().optional(),
    }).parse((req as any).body);

    const existing = await prisma.cartonCatalogue.findFirst({ where: { id, orgId: req.orgId! } });
    if (!existing) { reply.code(404); return { data: null, error: 'Not found' }; }
    const updated = await prisma.cartonCatalogue.update({ where: { id: existing.id, orgId: req.orgId! }, data: body });
    return { data: updated, error: null };
  });

  // DELETE /api/v1/carton-catalogue/:id
  // Falls back to archive (active=false) if the carton is referenced by pack audits —
  // preserving history for quality compliance.
  server.delete('/api/v1/carton-catalogue/:id', {
    schema: { tags: ['WMS - Cartonization'], summary: 'Archive (soft-delete) or remove a carton type' },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const orgId = req.orgId!;

    const existing = await prisma.cartonCatalogue.findFirst({ where: { id, orgId } });
    if (!existing) { reply.code(404); return { data: null, error: 'Not found' }; }

    const referencedCount = await prisma.packAudit.count({ where: { cartonCatalogueId: id, orgId } });
    if (referencedCount > 0) {
      await prisma.cartonCatalogue.update({ where: { id: existing.id, orgId }, data: { active: false } });
      return { data: { archived: true, referencedCount }, error: null };
    }

    await prisma.cartonCatalogue.delete({ where: { id: existing.id, orgId } });
    return { data: { deleted: true }, error: null };
  });
}
