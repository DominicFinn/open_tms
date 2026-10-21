import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { container, TOKENS } from '../di/index.js';
import { ICommandBus } from '../commands/CommandBus.js';
import { ADJUST_INVENTORY } from '../commands/warehouse/AdjustInventoryCommand.js';
import { TRANSFER_INVENTORY } from '../commands/warehouse/TransferInventoryCommand.js';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { registerWmsGuard } from '../auth/wmsGuard.js';
import type { ICustomersRepository } from '../repositories/CustomersRepository.js';

/**
 * Inventory holds the owning customer as a soft id since #297, so the name comes from core rather
 * than a join. The response keeps its `ownerCustomer: { id, name } | null` shape.
 */
async function withOwnerCustomers<T extends { ownerCustomerId: string | null }>(
  customers: ICustomersRepository,
  orgId: string,
  records: T[],
): Promise<Array<T & { ownerCustomer: { id: string; name: string } | null }>> {
  const ids = [...new Set(records.map(r => r.ownerCustomerId).filter((id): id is string => id !== null))];
  const names = new Map((await customers.namesByIds(orgId, ids)).map(c => [c.id, c]));
  return records.map(r => ({ ...r, ownerCustomer: r.ownerCustomerId ? names.get(r.ownerCustomerId) ?? null : null }));
}

const REASON_CODES = ['damage', 'expired', 'recount', 'scrap', 'found', 'return', 'other'] as const;

export async function inventoryRoutes(server: FastifyInstance) {
  // WMS permission guard (#134): wms:read for reads, wms:write for mutations
  await registerWmsGuard(server);

  const commandBus = container.resolve<ICommandBus>(TOKENS.ICommandBus);
  const prisma = container.resolve<PrismaClient>(TOKENS.PrismaClient);
  const customers = container.resolve<ICustomersRepository>(TOKENS.ICustomersRepository);

  // GET /api/v1/inventory?facilityId=xxx&sku=xxx&binId=xxx
  server.get('/api/v1/inventory', {
    schema: {
      tags: ['WMS - Inventory'],
      summary: 'List inventory records with optional filters',
      querystring: {
        type: 'object',
        required: ['facilityId'],
        properties: {
          facilityId: { type: 'string', format: 'uuid' },
          sku: { type: 'string' },
          binId: { type: 'string', format: 'uuid' },
          zoneId: { type: 'string', format: 'uuid' },
          ownerCustomerId: { type: 'string', format: 'uuid' },
          hasStock: { type: 'boolean', description: 'Only show records with quantityOnHand > 0' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const q = req.query as any;
    const where: any = { orgId: req.orgId!, facilityId: q.facilityId };
    if (q.sku) where.sku = { contains: q.sku, mode: 'insensitive' };
    if (q.binId) where.binId = q.binId;
    if (q.zoneId) where.bin = { zoneId: q.zoneId };
    if (q.ownerCustomerId) where.ownerCustomerId = q.ownerCustomerId;
    if (q.hasStock === true || q.hasStock === 'true') where.quantityOnHand = { gt: 0 };

    const records = await prisma.inventoryRecord.findMany({
      where,
      include: {
        bin: { select: { id: true, label: true, binType: true, zone: { select: { id: true, name: true, zoneType: true } } } },
      },
      orderBy: [{ sku: 'asc' }, { bin: { walkSequence: 'asc' } }],
      take: 500,
    });

    return { data: await withOwnerCustomers(customers, req.orgId!, records), error: null };
  });

  // GET /api/v1/inventory/summary?facilityId=xxx: aggregate by SKU
  server.get('/api/v1/inventory/summary', {
    schema: {
      tags: ['WMS - Inventory'],
      summary: 'Inventory summary aggregated by SKU across all bins',
      querystring: {
        type: 'object',
        required: ['facilityId'],
        properties: {
          facilityId: { type: 'string', format: 'uuid' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { facilityId } = req.query as { facilityId: string };

    const summary = await prisma.inventoryRecord.groupBy({
      by: ['sku', 'uomCode'],
      where: { orgId: req.orgId!, facilityId, quantityOnHand: { gt: 0 } },
      _sum: {
        quantityOnHand: true,
        quantityAllocated: true,
        quantityAvailable: true,
        quantityOnHold: true,
      },
      _count: { id: true },
      orderBy: { sku: 'asc' },
    });

    const mapped = summary.map(s => ({
      sku: s.sku,
      uomCode: s.uomCode,
      totalOnHand: s._sum.quantityOnHand ?? 0,
      totalAllocated: s._sum.quantityAllocated ?? 0,
      totalAvailable: s._sum.quantityAvailable ?? 0,
      totalOnHold: s._sum.quantityOnHold ?? 0,
      binCount: s._count.id,
    }));

    return { data: mapped, error: null };
  });

  // GET /api/v1/inventory/:id — single record detail
  server.get('/api/v1/inventory/:id', {
    schema: {
      tags: ['WMS - Inventory'],
      summary: 'Get inventory record detail with transaction history',
      params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const record = await prisma.inventoryRecord.findFirst({
      where: { id, orgId: req.orgId! },
      include: {
        bin: { select: { id: true, label: true, binType: true, zone: { select: { name: true, zoneType: true } } } },
        transactions: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });

    if (!record) {
      reply.code(404);
      return { data: null, error: 'Inventory record not found' };
    }

    const [withOwner] = await withOwnerCustomers(customers, req.orgId!, [record]);
    return { data: withOwner, error: null };
  });

  // GET /api/v1/inventory/transactions?facilityId=xxx: recent transaction ledger
  server.get('/api/v1/inventory/transactions', {
    schema: {
      tags: ['WMS - Inventory'],
      summary: 'Recent inventory transactions (ledger)',
      querystring: {
        type: 'object',
        required: ['facilityId'],
        properties: {
          facilityId: { type: 'string', format: 'uuid' },
          transactionType: { type: 'string' },
          limit: { type: 'integer', minimum: 1, maximum: 500, default: 100 },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const q = req.query as any;
    const where: any = { orgId: req.orgId!, inventoryRecord: { facilityId: q.facilityId } };
    if (q.transactionType) where.transactionType = q.transactionType;

    const transactions = await prisma.inventoryTransaction.findMany({
      where,
      include: {
        inventoryRecord: { select: { sku: true, bin: { select: { label: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: q.limit ?? 100,
    });

    return { data: transactions, error: null };
  });

  // POST /api/v1/inventory/:id/adjust — manual stock adjustment
  server.post('/api/v1/inventory/:id/adjust', {
    schema: {
      tags: ['WMS - Inventory'],
      summary: 'Adjust stock quantity with reason code',
      body: {
        type: 'object',
        required: ['quantityChange', 'reasonCode'],
        properties: {
          quantityChange: { type: 'integer', description: 'Positive to add, negative to remove' },
          reasonCode: { type: 'string', enum: [...REASON_CODES] },
          notes: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      quantityChange: z.number().int(),
      reasonCode: z.enum(REASON_CODES),
      notes: z.string().optional(),
    }).parse((req as any).body);

    const orgId = req.orgId!;
    const actorId = req.user?.sub ?? null;

    const record = await prisma.inventoryRecord.findFirst({ where: { id, orgId }, select: { id: true } });
    if (!record) {
      reply.code(404);
      return { data: null, error: 'Inventory record not found' };
    }

    const result = await commandBus.dispatch({
      type: ADJUST_INVENTORY,
      orgId,
      actorId,
      payload: { inventoryRecordId: id, ...body },
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error };
    }

    return { data: result.data, error: null };
  });

  // POST /api/v1/inventory/:id/transfer — transfer stock to another bin
  server.post('/api/v1/inventory/:id/transfer', {
    schema: {
      tags: ['WMS - Inventory'],
      summary: 'Transfer stock from this record to another bin',
      body: {
        type: 'object',
        required: ['targetBinId', 'quantity'],
        properties: {
          targetBinId: { type: 'string', format: 'uuid' },
          quantity: { type: 'integer', minimum: 1 },
          notes: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      targetBinId: z.string().uuid(),
      quantity: z.number().int().min(1),
      notes: z.string().optional(),
    }).parse((req as any).body);

    const orgId = req.orgId!;
    const actorId = req.user?.sub ?? null;

    const [record, targetBin] = await Promise.all([
      prisma.inventoryRecord.findFirst({ where: { id, orgId }, select: { id: true } }),
      prisma.warehouseBin.findFirst({ where: { id: body.targetBinId, orgId }, select: { id: true } }),
    ]);
    if (!record || !targetBin) {
      reply.code(404);
      return { data: null, error: record ? 'Target bin not found' : 'Inventory record not found' };
    }

    const result = await commandBus.dispatch({
      type: TRANSFER_INVENTORY,
      orgId,
      actorId,
      payload: { inventoryRecordId: id, ...body },
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error };
    }

    return { data: result.data, error: null };
  });
}
