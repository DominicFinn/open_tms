import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { container, TOKENS } from '../di/index.js';
import { STANDARD_PALLET_TYPES } from '../services/palletization/standardPalletTypes.js';
import { planHomogeneousPallet, recommendPalletType } from '../services/palletization/PalletizationPlanner.js';

export async function palletTypesRoutes(server: FastifyInstance) {
  const prisma = container.resolve<PrismaClient>(TOKENS.PrismaClient);

  async function resolveOrgId(req: FastifyRequest): Promise<string> {
    const fromReq = (req as any).orgId;
    if (fromReq) return fromReq;
    const org = await prisma.organization.findFirst({ select: { id: true } });
    return org?.id ?? 'default-org';
  }

  server.get('/api/v1/pallet-types', {
    schema: {
      tags: ['WMS - Pallet Types'],
      summary: 'List pallet types for this org',
      querystring: {
        type: 'object',
        properties: { activeOnly: { type: 'boolean' } },
      },
    },
  }, async (req: FastifyRequest) => {
    const orgId = await resolveOrgId(req);
    const q = req.query as { activeOnly?: boolean };
    const where: any = { orgId };
    if (q.activeOnly === true) where.active = true;
    const rows = await prisma.palletType.findMany({
      where,
      orderBy: [{ active: 'desc' }, { code: 'asc' }],
    });
    return { data: rows, error: null };
  });

  server.get('/api/v1/pallet-types/standards', {
    schema: { tags: ['WMS - Pallet Types'], summary: 'Available seed data for standard pallet types' },
  }, async () => {
    return { data: STANDARD_PALLET_TYPES, error: null };
  });

  server.get('/api/v1/pallet-types/:id', {
    schema: { tags: ['WMS - Pallet Types'], summary: 'Pallet type detail' },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const row = await prisma.palletType.findUnique({ where: { id } });
    if (!row) { reply.code(404); return { data: null, error: 'Pallet type not found' }; }
    return { data: row, error: null };
  });

  const PalletBody = z.object({
    code: z.string().min(1).max(64),
    name: z.string().min(1).max(200),
    description: z.string().optional(),
    lengthMm: z.number().int().positive(),
    widthMm: z.number().int().positive(),
    heightMm: z.number().int().positive(),
    tareWeightGrams: z.number().int().nonnegative(),
    maxLoadGrams: z.number().int().positive(),
    maxStackHeightMm: z.number().int().positive().nullable().optional(),
    material: z.enum(['wood', 'plastic', 'metal', 'cardboard', 'composite']),
    reusable: z.boolean().optional(),
    isoCertified: z.boolean().optional(),
    stackable: z.boolean().optional(),
    active: z.boolean().optional(),
    imageUrl: z.string().url().optional(),
  });

  server.post('/api/v1/pallet-types', {
    schema: {
      tags: ['WMS - Pallet Types'],
      summary: 'Create a pallet type',
      body: { type: 'object' }, // validated with zod below
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = await resolveOrgId(req);
    const body = PalletBody.parse((req as any).body);
    try {
      const created = await prisma.palletType.create({ data: { ...body, orgId } });
      reply.code(201);
      return { data: created, error: null };
    } catch (err: any) {
      if (err.code === 'P2002') { reply.code(409); return { data: null, error: `Code "${body.code}" already exists for this org` }; }
      throw err;
    }
  });

  server.put('/api/v1/pallet-types/:id', {
    schema: { tags: ['WMS - Pallet Types'], summary: 'Update a pallet type' },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = PalletBody.partial().parse((req as any).body);
    const existing = await prisma.palletType.findUnique({ where: { id } });
    if (!existing) { reply.code(404); return { data: null, error: 'Pallet type not found' }; }
    const updated = await prisma.palletType.update({ where: { id }, data: body });
    return { data: updated, error: null };
  });

  server.delete('/api/v1/pallet-types/:id', {
    schema: { tags: ['WMS - Pallet Types'], summary: 'Delete (or deactivate) a pallet type' },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const existing = await prisma.palletType.findUnique({ where: { id }, include: { _count: { select: { trackableUnits: true } } } });
    if (!existing) { reply.code(404); return { data: null, error: 'Pallet type not found' }; }
    // Soft-deactivate if referenced; hard-delete otherwise
    if (existing._count.trackableUnits > 0) {
      const updated = await prisma.palletType.update({ where: { id }, data: { active: false } });
      return { data: { ...updated, softDeleted: true }, error: null };
    }
    await prisma.palletType.delete({ where: { id } });
    return { data: { success: true }, error: null };
  });

  server.post('/api/v1/pallet-types/seed-standards', {
    schema: {
      tags: ['WMS - Pallet Types'],
      summary: 'Bulk-seed the standard pallet types (skips rows whose code already exists)',
    },
  }, async (req: FastifyRequest) => {
    const orgId = await resolveOrgId(req);
    const existing = await prisma.palletType.findMany({
      where: { orgId, code: { in: STANDARD_PALLET_TYPES.map(s => s.code) } },
      select: { code: true },
    });
    const existingCodes = new Set(existing.map(e => e.code));
    const toCreate = STANDARD_PALLET_TYPES.filter(s => !existingCodes.has(s.code));
    if (toCreate.length > 0) {
      await prisma.palletType.createMany({
        data: toCreate.map(s => ({ ...s, orgId })),
      });
    }
    return {
      data: { created: toCreate.length, skipped: existingCodes.size, total: STANDARD_PALLET_TYPES.length },
      error: null,
    };
  });

  server.post('/api/v1/pallet-types/:id/plan', {
    schema: {
      tags: ['WMS - Pallet Types'],
      summary: 'Estimate how a carton fits on this pallet type',
      body: {
        type: 'object',
        required: ['lengthMm', 'widthMm', 'heightMm', 'weightGrams'],
        properties: {
          lengthMm: { type: 'integer', minimum: 1 },
          widthMm: { type: 'integer', minimum: 1 },
          heightMm: { type: 'integer', minimum: 1 },
          weightGrams: { type: 'integer', minimum: 1 },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = req.body as any;
    const pallet = await prisma.palletType.findUnique({ where: { id } });
    if (!pallet) { reply.code(404); return { data: null, error: 'Pallet type not found' }; }
    const result = planHomogeneousPallet(pallet, body);
    return { data: result, error: null };
  });

  server.post('/api/v1/pallet-types/recommend', {
    schema: {
      tags: ['WMS - Pallet Types'],
      summary: 'Recommend the best pallet type for a carton across all active types',
      body: {
        type: 'object',
        required: ['lengthMm', 'widthMm', 'heightMm', 'weightGrams'],
        properties: {
          lengthMm: { type: 'integer', minimum: 1 },
          widthMm: { type: 'integer', minimum: 1 },
          heightMm: { type: 'integer', minimum: 1 },
          weightGrams: { type: 'integer', minimum: 1 },
        },
      },
    },
  }, async (req: FastifyRequest) => {
    const orgId = await resolveOrgId(req);
    const body = req.body as any;
    const palletTypes = await prisma.palletType.findMany({ where: { orgId, active: true } });
    const result = recommendPalletType(palletTypes, body);
    return { data: result, error: null };
  });
}
