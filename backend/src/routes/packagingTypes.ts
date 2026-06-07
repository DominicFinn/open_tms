import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { container, TOKENS } from '../di/index.js';
import { STANDARD_PACKAGING_TYPES } from '../services/palletization/standardPackagingTypes.js';
import { planHomogeneousPallet, recommendPalletType } from '../services/palletization/PalletizationPlanner.js';
import { registerOrgScope } from '../auth/orgScopeMiddleware.js';

const PACKAGING_KINDS = ['pallet', 'carton', 'crate', 'drum', 'roll', 'bag', 'tote', 'loose', 'custom'] as const;
const MATERIALS = ['wood', 'plastic', 'metal', 'cardboard', 'composite', 'fiber', 'textile'] as const;

export async function packagingTypesRoutes(server: FastifyInstance) {
  await registerOrgScope(server);
  const prisma = container.resolve<PrismaClient>(TOKENS.PrismaClient);

  server.get('/api/v1/packaging-types', {
    schema: {
      tags: ['WMS - Packaging Types'],
      summary: 'List packaging types for this org',
      querystring: {
        type: 'object',
        properties: {
          activeOnly: { type: 'boolean' },
          kind: { type: 'string', enum: [...PACKAGING_KINDS] },
        },
      },
    },
  }, async (req: FastifyRequest) => {
    const q = req.query as { activeOnly?: boolean; kind?: string };
    const where: any = { orgId: req.orgId! };
    if (q.activeOnly === true) where.active = true;
    if (q.kind) where.kind = q.kind;
    const rows = await prisma.packagingType.findMany({
      where,
      orderBy: [{ active: 'desc' }, { kind: 'asc' }, { code: 'asc' }],
    });
    return { data: rows, error: null };
  });

  server.get('/api/v1/packaging-types/standards', {
    schema: { tags: ['WMS - Packaging Types'], summary: 'Available seed data for standard packaging types' },
  }, async () => {
    return { data: STANDARD_PACKAGING_TYPES, error: null };
  });

  server.get('/api/v1/packaging-types/:id', {
    schema: { tags: ['WMS - Packaging Types'], summary: 'Packaging type detail' },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const row = await prisma.packagingType.findFirst({ where: { id, orgId: req.orgId! } });
    if (!row) { reply.code(404); return { data: null, error: 'Packaging type not found' }; }
    return { data: row, error: null };
  });

  const PackagingBody = z.object({
    code: z.string().min(1).max(64),
    name: z.string().min(1).max(200),
    description: z.string().optional(),
    kind: z.enum(PACKAGING_KINDS),
    lengthMm: z.number().int().positive(),
    widthMm: z.number().int().positive(),
    heightMm: z.number().int().positive(),
    tareWeightGrams: z.number().int().nonnegative().nullable().optional(),
    maxLoadGrams: z.number().int().positive().nullable().optional(),
    maxStackHeightMm: z.number().int().positive().nullable().optional(),
    material: z.enum(MATERIALS).nullable().optional(),
    reusable: z.boolean().optional(),
    isoCertified: z.boolean().optional(),
    stackable: z.boolean().optional(),
    active: z.boolean().optional(),
    imageUrl: z.string().url().optional(),
  });

  server.post('/api/v1/packaging-types', {
    schema: {
      tags: ['WMS - Packaging Types'],
      summary: 'Create a packaging type',
      body: { type: 'object' },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = PackagingBody.parse((req as any).body);
    try {
      const created = await prisma.packagingType.create({ data: { ...body, orgId: req.orgId! } });
      reply.code(201);
      return { data: created, error: null };
    } catch (err: any) {
      if (err.code === 'P2002') { reply.code(409); return { data: null, error: `Code "${body.code}" already exists for this org` }; }
      throw err;
    }
  });

  server.put('/api/v1/packaging-types/:id', {
    schema: { tags: ['WMS - Packaging Types'], summary: 'Update a packaging type' },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = PackagingBody.partial().parse((req as any).body);
    const existing = await prisma.packagingType.findFirst({ where: { id, orgId: req.orgId! } });
    if (!existing) { reply.code(404); return { data: null, error: 'Packaging type not found' }; }
    const updated = await prisma.packagingType.update({ where: { id }, data: body });
    return { data: updated, error: null };
  });

  server.delete('/api/v1/packaging-types/:id', {
    schema: { tags: ['WMS - Packaging Types'], summary: 'Delete (or deactivate) a packaging type' },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const existing = await prisma.packagingType.findFirst({
      where: { id, orgId: req.orgId! },
      include: { _count: { select: { trackableUnits: true } } },
    });
    if (!existing) { reply.code(404); return { data: null, error: 'Packaging type not found' }; }
    if (existing._count.trackableUnits > 0) {
      const updated = await prisma.packagingType.update({ where: { id }, data: { active: false } });
      return { data: { ...updated, softDeleted: true }, error: null };
    }
    await prisma.packagingType.delete({ where: { id } });
    return { data: { success: true }, error: null };
  });

  server.post('/api/v1/packaging-types/seed-standards', {
    schema: {
      tags: ['WMS - Packaging Types'],
      summary: 'Bulk-seed the standard packaging types (skips rows whose code already exists)',
    },
  }, async (req: FastifyRequest) => {
    const orgId = req.orgId!;
    const existing = await prisma.packagingType.findMany({
      where: { orgId, code: { in: STANDARD_PACKAGING_TYPES.map(s => s.code) } },
      select: { code: true },
    });
    const existingCodes = new Set(existing.map(e => e.code));
    const toCreate = STANDARD_PACKAGING_TYPES.filter(s => !existingCodes.has(s.code));
    if (toCreate.length > 0) {
      await prisma.packagingType.createMany({
        data: toCreate.map(s => ({ ...s, orgId })),
      });
    }
    return {
      data: { created: toCreate.length, skipped: existingCodes.size, total: STANDARD_PACKAGING_TYPES.length },
      error: null,
    };
  });

  // Planner endpoints — only meaningful for kind = 'pallet'.

  server.post('/api/v1/packaging-types/:id/plan', {
    schema: {
      tags: ['WMS - Packaging Types'],
      summary: 'Estimate how a carton fits on this pallet (kind=pallet only)',
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
    const pallet = await prisma.packagingType.findFirst({ where: { id, orgId: req.orgId! } });
    if (!pallet) { reply.code(404); return { data: null, error: 'Packaging type not found' }; }
    if (pallet.kind !== 'pallet') {
      reply.code(400);
      return { data: null, error: 'Palletization plan is only meaningful for kind=pallet' };
    }
    const result = planHomogeneousPallet(pallet, body);
    return { data: result, error: null };
  });

  server.post('/api/v1/packaging-types/recommend', {
    schema: {
      tags: ['WMS - Packaging Types'],
      summary: 'Recommend the best pallet for a carton across all active pallets',
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
    const body = req.body as any;
    const palletTypes = await prisma.packagingType.findMany({ where: { orgId: req.orgId!, active: true } });
    const result = recommendPalletType(palletTypes, body);
    return { data: result, error: null };
  });
}
