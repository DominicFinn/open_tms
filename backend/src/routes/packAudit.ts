import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { container, TOKENS } from '../di/index.js';
import { ICommandBus } from '../commands/CommandBus.js';
import { RECORD_PACK_AUDIT } from '../commands/packAudit/RecordPackAuditCommand.js';

export async function packAuditRoutes(server: FastifyInstance) {
  const commandBus = container.resolve<ICommandBus>(TOKENS.ICommandBus);
  const prisma = container.resolve<PrismaClient>(TOKENS.PrismaClient);

  // GET /api/v1/pack-audits - list with filters
  server.get('/api/v1/pack-audits', {
    schema: {
      tags: ['WMS - Pack Audit'],
      summary: 'List pack audits with filters',
      querystring: {
        type: 'object',
        properties: {
          verdict: { type: 'string', enum: ['pass', 'warning', 'fail'] },
          packTaskId: { type: 'string', format: 'uuid' },
          limit: { type: 'integer', default: 100 },
        },
      },
    },
  }, async (req: FastifyRequest) => {
    const q = req.query as { verdict?: string; packTaskId?: string; limit?: number };
    const orgId = (req as any).orgId || 'default-org';
    const where: any = { orgId };
    if (q.verdict) where.verdict = q.verdict;
    if (q.packTaskId) where.packTaskId = q.packTaskId;
    const audits = await prisma.packAudit.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: q.limit || 100,
      include: { packTask: { select: { id: true, orderId: true, locationId: true } } },
    });
    return { data: audits, error: null };
  });

  // GET /api/v1/pack-audits/stats - aggregate stats for dashboard
  server.get('/api/v1/pack-audits/stats', {
    schema: { tags: ['WMS - Pack Audit'], summary: 'Aggregate pack audit stats' },
  }, async (req: FastifyRequest) => {
    const orgId = (req as any).orgId || 'default-org';
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);

    const [total, pass, warning, fail] = await Promise.all([
      prisma.packAudit.count({ where: { orgId, createdAt: { gte: since } } }),
      prisma.packAudit.count({ where: { orgId, verdict: 'pass', createdAt: { gte: since } } }),
      prisma.packAudit.count({ where: { orgId, verdict: 'warning', createdAt: { gte: since } } }),
      prisma.packAudit.count({ where: { orgId, verdict: 'fail', createdAt: { gte: since } } }),
    ]);

    return {
      data: {
        windowDays: 30,
        total,
        pass, warning, fail,
        passRatePercent: total > 0 ? Number(((pass / total) * 100).toFixed(1)) : null,
      },
      error: null,
    };
  });

  // GET /api/v1/pack-audits/:id
  server.get('/api/v1/pack-audits/:id', {
    schema: { tags: ['WMS - Pack Audit'], summary: 'Pack audit detail' },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const audit = await prisma.packAudit.findUnique({
      where: { id },
      include: {
        packTask: { include: { packLines: true } },
      },
    });
    if (!audit) { reply.code(404); return { data: null, error: 'Pack audit not found' }; }
    return { data: audit, error: null };
  });

  // POST /api/v1/pack-audits - record a new pack audit
  server.post('/api/v1/pack-audits', {
    schema: {
      tags: ['WMS - Pack Audit'],
      summary: 'Record a pack audit (weight + optional dims)',
      body: {
        type: 'object',
        required: ['packTaskId', 'actualWeightGrams'],
        properties: {
          packTaskId: { type: 'string', format: 'uuid' },
          cartonCatalogueId: { type: 'string', format: 'uuid' },
          actualWeightGrams: { type: 'integer', minimum: 1 },
          actualLengthMm: { type: 'integer' },
          actualWidthMm: { type: 'integer' },
          actualHeightMm: { type: 'integer' },
          expectedWeightGramsOverride: { type: 'integer' },
          weightTolerancePercent: { type: 'number', minimum: 0, maximum: 100 },
          notes: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = (req as any).orgId || 'default-org';
    const actorId = (req as any).userId || 'system';
    const body = req.body as any;

    const result = await commandBus.dispatch({
      type: RECORD_PACK_AUDIT, orgId, actorId, payload: body,
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) { reply.code(400); return { data: null, error: result.error }; }
    return { data: result.data, error: null };
  });

  // GET /api/v1/warehouse/pack-tasks/:id/audit-context - pre-compute expected for the mobile app
  server.get('/api/v1/warehouse/pack-tasks/:id/audit-context', {
    schema: {
      tags: ['WMS - Pack Audit'],
      summary: 'Expected totals and SKU catalog data for a pack task, to show alongside the scale reading on the mobile app',
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const orgId = (req as any).orgId || 'default-org';
    const packTask = await prisma.packTask.findUnique({
      where: { id },
      include: { packLines: true },
    });
    if (!packTask) { reply.code(404); return { data: null, error: 'Pack task not found' }; }

    const skus = Array.from(new Set(packTask.packLines.map(l => l.sku)));
    const uoms = await prisma.productUom.findMany({
      where: { orgId, sku: { in: skus }, isDefault: true },
      select: { sku: true, weightGrams: true, lengthMm: true, widthMm: true, heightMm: true },
    });
    const bySku = new Map(uoms.map(u => [u.sku, u]));

    let expectedWeightGrams = 0;
    const lines = packTask.packLines.map(l => {
      const uom = bySku.get(l.sku);
      const weightPerUnit = uom?.weightGrams ?? 0;
      expectedWeightGrams += weightPerUnit * l.expectedQuantity;
      return {
        sku: l.sku,
        expectedQuantity: l.expectedQuantity,
        weightGramsPerUnit: weightPerUnit,
        lineWeightGrams: weightPerUnit * l.expectedQuantity,
      };
    });

    const existingAudits = await prisma.packAudit.findMany({
      where: { packTaskId: id },
      orderBy: { createdAt: 'desc' },
    });

    return {
      data: {
        packTaskId: id,
        orderId: packTask.orderId,
        status: packTask.status,
        lines,
        expectedWeightGrams,
        existingAudits,
      },
      error: null,
    };
  });
}
