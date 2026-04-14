/**
 * Commission Tracking - CRUD for broker agent commissions.
 */

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

export async function commissionRoutes(server: FastifyInstance) {
  const getOrgId = async () => {
    const org = await server.prisma.organization.findFirst({ select: { id: true } });
    return org?.id || 'default';
  };

  // List commissions with filters
  server.get('/api/v1/commissions', {
    schema: {
      tags: ['Brokerage - Commissions'],
      summary: 'List commissions with optional filters',
      querystring: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
          shipmentId: { type: 'string' },
          status: { type: 'string', enum: ['accrued', 'approved', 'paid'] },
        },
      },
    },
  }, async (req: FastifyRequest) => {
    const query = req.query as Record<string, string>;
    const where: any = {};
    if (query.userId) where.userId = query.userId;
    if (query.shipmentId) where.shipmentId = query.shipmentId;
    if (query.status) where.status = query.status;

    const commissions = await server.prisma.commission.findMany({
      where,
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        shipment: { select: { id: true, reference: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { data: commissions, error: null };
  });

  // Create a commission
  server.post('/api/v1/commissions', {
    schema: {
      tags: ['Brokerage - Commissions'],
      summary: 'Create a commission for a broker agent on a shipment',
      body: {
        type: 'object',
        required: ['userId', 'shipmentId', 'commissionPercent'],
        properties: {
          userId: { type: 'string' },
          shipmentId: { type: 'string' },
          basisType: { type: 'string', enum: ['margin', 'revenue'], default: 'margin' },
          commissionPercent: { type: 'number', minimum: 0, maximum: 100 },
          notes: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      userId: z.string(),
      shipmentId: z.string(),
      basisType: z.enum(['margin', 'revenue']).default('margin'),
      commissionPercent: z.number().min(0).max(100),
      notes: z.string().optional(),
    }).parse((req as any).body);

    const orgId = await getOrgId();

    // Look up the shipment's financial summary
    const summary = await server.prisma.shipmentFinancialSummary.findUnique({
      where: { shipmentId: body.shipmentId },
    });

    if (!summary) {
      reply.code(400);
      return { data: null, error: 'No financial summary found for this shipment' };
    }

    const revenue = summary.actualRevenueCents || summary.expectedRevenueCents;
    const cost = summary.actualCostCents || summary.expectedCostCents;
    const margin = revenue - cost;

    const basisAmountCents = body.basisType === 'margin' ? margin : revenue;
    const commissionCents = Math.round(basisAmountCents * body.commissionPercent / 100);

    const commission = await server.prisma.commission.create({
      data: {
        orgId,
        userId: body.userId,
        shipmentId: body.shipmentId,
        basisType: body.basisType,
        basisAmountCents: basisAmountCents,
        commissionPercent: body.commissionPercent,
        commissionCents,
        notes: body.notes,
      },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        shipment: { select: { id: true, reference: true } },
      },
    });

    reply.code(201);
    return { data: commission, error: null };
  });

  // Approve a commission
  server.post('/api/v1/commissions/:id/approve', {
    schema: {
      tags: ['Brokerage - Commissions'],
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const commission = await server.prisma.commission.findUnique({ where: { id } });

    if (!commission) { reply.code(404); return { data: null, error: 'Commission not found' }; }
    if (commission.status !== 'accrued') {
      reply.code(400);
      return { data: null, error: `Cannot approve commission in status "${commission.status}"` };
    }

    const updated = await server.prisma.commission.update({
      where: { id },
      data: {
        status: 'approved',
        approvedBy: (req as any).user?.sub ?? 'system',
        approvedAt: new Date(),
      },
    });

    return { data: updated, error: null };
  });

  // Mark a commission as paid
  server.post('/api/v1/commissions/:id/pay', {
    schema: {
      tags: ['Brokerage - Commissions'],
      body: {
        type: 'object',
        properties: {
          paymentReference: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = (req as any).body || {};

    const commission = await server.prisma.commission.findUnique({ where: { id } });
    if (!commission) { reply.code(404); return { data: null, error: 'Commission not found' }; }
    if (commission.status !== 'approved') {
      reply.code(400);
      return { data: null, error: 'Commission must be approved before payment' };
    }

    const updated = await server.prisma.commission.update({
      where: { id },
      data: {
        status: 'paid',
        paidAt: new Date(),
        paymentReference: body.paymentReference,
      },
    });

    return { data: updated, error: null };
  });

  // Commission summary by agent
  server.get('/api/v1/commissions/summary', {
    schema: {
      tags: ['Brokerage - Commissions'],
      summary: 'Commission totals grouped by agent',
      querystring: {
        type: 'object',
        properties: {
          dateFrom: { type: 'string', format: 'date' },
          dateTo: { type: 'string', format: 'date' },
        },
      },
    },
  }, async (req: FastifyRequest) => {
    const query = req.query as { dateFrom?: string; dateTo?: string };
    const where: any = {};
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
      if (query.dateTo) where.createdAt.lte = new Date(query.dateTo + 'T23:59:59Z');
    }

    const commissions = await server.prisma.commission.findMany({
      where,
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    const byAgent = new Map<string, {
      userId: string;
      userName: string;
      email: string;
      totalCommissionCents: number;
      accruedCents: number;
      approvedCents: number;
      paidCents: number;
      count: number;
    }>();

    for (const c of commissions) {
      const uid = c.userId;
      const name = [c.user.firstName, c.user.lastName].filter(Boolean).join(' ') || c.user.email;
      const existing = byAgent.get(uid) || {
        userId: uid,
        userName: name,
        email: c.user.email,
        totalCommissionCents: 0,
        accruedCents: 0,
        approvedCents: 0,
        paidCents: 0,
        count: 0,
      };
      existing.totalCommissionCents += c.commissionCents;
      existing.count++;
      if (c.status === 'accrued') existing.accruedCents += c.commissionCents;
      if (c.status === 'approved') existing.approvedCents += c.commissionCents;
      if (c.status === 'paid') existing.paidCents += c.commissionCents;
      byAgent.set(uid, existing);
    }

    return { data: Array.from(byAgent.values()), error: null };
  });
}
