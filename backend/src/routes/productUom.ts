import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { container, TOKENS } from '../di/index.js';
import { PrismaClient } from '@prisma/client';

export async function productUomRoutes(server: FastifyInstance) {
  const prisma = container.resolve<PrismaClient>(TOKENS.PrismaClient);

  // GET /api/v1/product-uom?sku=xxx
  server.get('/api/v1/product-uom', {
    schema: {
      tags: ['WMS - Product UOM'],
      summary: 'List product UOM records, optionally filtered by SKU',
      querystring: {
        type: 'object',
        properties: {
          sku: { type: 'string' },
          search: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest) => {
    const q = req.query as any;
    const orgId = (req as any).orgId || 'default-org';
    const where: any = { orgId };
    if (q.sku) where.sku = q.sku;
    if (q.search) where.sku = { contains: q.search, mode: 'insensitive' };

    const records = await prisma.productUom.findMany({
      where,
      orderBy: [{ sku: 'asc' }, { uomCode: 'asc' }],
      take: 200,
    });

    return { data: records, error: null };
  });

  // GET /api/v1/product-uom/:id
  server.get('/api/v1/product-uom/:id', {
    schema: { tags: ['WMS - Product UOM'], summary: 'Get product UOM detail' },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const record = await prisma.productUom.findUnique({ where: { id } });
    if (!record) { reply.code(404); return { data: null, error: 'Not found' }; }
    return { data: record, error: null };
  });

  // POST /api/v1/product-uom
  server.post('/api/v1/product-uom', {
    schema: {
      tags: ['WMS - Product UOM'],
      summary: 'Create or update product UOM dimensions',
      body: {
        type: 'object', required: ['sku', 'uomCode'],
        properties: {
          sku: { type: 'string' },
          uomCode: { type: 'string', description: 'EA, INNER, CASE, PALLET' },
          parentUomCode: { type: 'string', nullable: true },
          conversionFactor: { type: 'integer', minimum: 1 },
          lengthMm: { type: 'integer', nullable: true },
          widthMm: { type: 'integer', nullable: true },
          heightMm: { type: 'integer', nullable: true },
          weightGrams: { type: 'integer', nullable: true },
          barcodeGtin: { type: 'string', nullable: true },
          isDefault: { type: 'boolean' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      sku: z.string().min(1),
      uomCode: z.string().min(1).max(20),
      parentUomCode: z.string().nullable().optional(),
      conversionFactor: z.number().int().min(1).optional().default(1),
      lengthMm: z.number().int().positive().nullable().optional(),
      widthMm: z.number().int().positive().nullable().optional(),
      heightMm: z.number().int().positive().nullable().optional(),
      weightGrams: z.number().int().positive().nullable().optional(),
      barcodeGtin: z.string().nullable().optional(),
      isDefault: z.boolean().optional().default(false),
    }).parse((req as any).body);

    const orgId = (req as any).orgId || 'default-org';

    // Upsert by org+sku+uomCode
    const existing = await prisma.productUom.findFirst({
      where: { orgId, sku: body.sku, uomCode: body.uomCode },
    });

    let record;
    if (existing) {
      record = await prisma.productUom.update({ where: { id: existing.id }, data: body });
    } else {
      record = await prisma.productUom.create({ data: { ...body, orgId } });
    }

    reply.code(existing ? 200 : 201);
    return { data: record, error: null };
  });

  // PUT /api/v1/product-uom/:id
  server.put('/api/v1/product-uom/:id', {
    schema: {
      tags: ['WMS - Product UOM'],
      summary: 'Update product UOM dimensions',
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      parentUomCode: z.string().nullable().optional(),
      conversionFactor: z.number().int().min(1).optional(),
      lengthMm: z.number().int().positive().nullable().optional(),
      widthMm: z.number().int().positive().nullable().optional(),
      heightMm: z.number().int().positive().nullable().optional(),
      weightGrams: z.number().int().positive().nullable().optional(),
      barcodeGtin: z.string().nullable().optional(),
      isDefault: z.boolean().optional(),
    }).parse((req as any).body);

    const record = await prisma.productUom.findUnique({ where: { id } });
    if (!record) { reply.code(404); return { data: null, error: 'Not found' }; }

    const updated = await prisma.productUom.update({ where: { id }, data: body });
    return { data: updated, error: null };
  });

  // DELETE /api/v1/product-uom/:id
  server.delete('/api/v1/product-uom/:id', {
    schema: { tags: ['WMS - Product UOM'], summary: 'Delete product UOM record' },
  }, async (req: FastifyRequest) => {
    const { id } = req.params as { id: string };
    await prisma.productUom.delete({ where: { id } }).catch(() => null);
    return { data: { deleted: true }, error: null };
  });

  // GET /api/v1/product-uom/lookup/:sku — get dimensions for cartonization
  server.get('/api/v1/product-uom/lookup/:sku', {
    schema: { tags: ['WMS - Product UOM'], summary: 'Look up dimensions for a SKU (for cartonization)' },
  }, async (req: FastifyRequest) => {
    const { sku } = req.params as { sku: string };
    const orgId = (req as any).orgId || 'default-org';

    const uom = await prisma.productUom.findFirst({
      where: { orgId, sku, isDefault: true },
    });
    if (!uom) {
      // Fall back to any UOM for this SKU
      const any = await prisma.productUom.findFirst({ where: { orgId, sku } });
      return { data: any, error: null };
    }
    return { data: uom, error: null };
  });
}
