/**
 * Broker Reports - Margin analysis by customer, carrier, lane, and time period.
 * Target margin variance tracking.
 */

import { FastifyInstance, FastifyRequest } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { container, TOKENS } from '../di/index.js';

export async function brokerReportRoutes(server: FastifyInstance) {
  const prisma = container.resolve<PrismaClient>(TOKENS.PrismaClient);

  // Margin by customer
  server.get('/api/v1/reports/margin/by-customer', {
    schema: {
      tags: ['Broker Reports'],
      summary: 'Margin analysis grouped by customer',
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

    const summaries = await prisma.shipmentFinancialSummary.findMany({
      where,
      include: {
        shipment: {
          select: {
            customerId: true,
            customer: { select: { id: true, name: true, targetMarginPercent: true } },
          },
        },
      },
    });

    // Group by customer
    const byCustomer = new Map<string, {
      customerId: string;
      customerName: string;
      targetMarginPercent: number | null;
      shipmentCount: number;
      totalRevenueCents: number;
      totalCostCents: number;
      totalMarginCents: number;
    }>();

    for (const s of summaries) {
      const cid = s.shipment.customerId;
      const existing = byCustomer.get(cid) || {
        customerId: cid,
        customerName: s.shipment.customer.name,
        targetMarginPercent: s.shipment.customer.targetMarginPercent ? Number(s.shipment.customer.targetMarginPercent) : null,
        shipmentCount: 0,
        totalRevenueCents: 0,
        totalCostCents: 0,
        totalMarginCents: 0,
      };
      existing.shipmentCount++;
      existing.totalRevenueCents += s.actualRevenueCents || s.expectedRevenueCents;
      existing.totalCostCents += s.actualCostCents || s.expectedCostCents;
      existing.totalMarginCents += (s.actualRevenueCents || s.expectedRevenueCents) - (s.actualCostCents || s.expectedCostCents);
      byCustomer.set(cid, existing);
    }

    const results = Array.from(byCustomer.values()).map(c => ({
      ...c,
      marginPercent: c.totalRevenueCents > 0 ? Math.round((c.totalMarginCents / c.totalRevenueCents) * 10000) / 100 : 0,
      varianceFromTarget: c.targetMarginPercent != null && c.totalRevenueCents > 0
        ? Math.round(((c.totalMarginCents / c.totalRevenueCents) * 100 - c.targetMarginPercent) * 100) / 100
        : null,
    }));

    results.sort((a, b) => b.totalMarginCents - a.totalMarginCents);

    return { data: results, error: null };
  });

  // Margin by carrier
  server.get('/api/v1/reports/margin/by-carrier', {
    schema: {
      tags: ['Broker Reports'],
      summary: 'Margin analysis grouped by carrier',
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

    const summaries = await prisma.shipmentFinancialSummary.findMany({
      where,
      include: {
        shipment: {
          select: {
            carrierId: true,
            carrier: { select: { id: true, name: true } },
          },
        },
      },
    });

    const byCarrier = new Map<string, {
      carrierId: string;
      carrierName: string;
      shipmentCount: number;
      totalRevenueCents: number;
      totalCostCents: number;
      totalMarginCents: number;
    }>();

    for (const s of summaries) {
      const cid = s.shipment.carrierId || 'unassigned';
      const existing = byCarrier.get(cid) || {
        carrierId: cid,
        carrierName: s.shipment.carrier?.name || 'Unassigned',
        shipmentCount: 0,
        totalRevenueCents: 0,
        totalCostCents: 0,
        totalMarginCents: 0,
      };
      existing.shipmentCount++;
      existing.totalRevenueCents += s.actualRevenueCents || s.expectedRevenueCents;
      existing.totalCostCents += s.actualCostCents || s.expectedCostCents;
      existing.totalMarginCents += (s.actualRevenueCents || s.expectedRevenueCents) - (s.actualCostCents || s.expectedCostCents);
      byCarrier.set(cid, existing);
    }

    const results = Array.from(byCarrier.values()).map(c => ({
      ...c,
      marginPercent: c.totalRevenueCents > 0 ? Math.round((c.totalMarginCents / c.totalRevenueCents) * 10000) / 100 : 0,
    }));

    results.sort((a, b) => b.totalMarginCents - a.totalMarginCents);

    return { data: results, error: null };
  });

  // Margin by lane
  server.get('/api/v1/reports/margin/by-lane', {
    schema: {
      tags: ['Broker Reports'],
      summary: 'Margin analysis grouped by lane',
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

    const summaries = await prisma.shipmentFinancialSummary.findMany({
      where,
      include: {
        shipment: {
          select: {
            laneId: true,
            lane: { select: { id: true, name: true } },
          },
        },
      },
    });

    const byLane = new Map<string, {
      laneId: string;
      laneName: string;
      shipmentCount: number;
      totalRevenueCents: number;
      totalCostCents: number;
      totalMarginCents: number;
    }>();

    for (const s of summaries) {
      const lid = s.shipment.laneId || 'no-lane';
      const existing = byLane.get(lid) || {
        laneId: lid,
        laneName: s.shipment.lane?.name || 'No Lane',
        shipmentCount: 0,
        totalRevenueCents: 0,
        totalCostCents: 0,
        totalMarginCents: 0,
      };
      existing.shipmentCount++;
      existing.totalRevenueCents += s.actualRevenueCents || s.expectedRevenueCents;
      existing.totalCostCents += s.actualCostCents || s.expectedCostCents;
      existing.totalMarginCents += (s.actualRevenueCents || s.expectedRevenueCents) - (s.actualCostCents || s.expectedCostCents);
      byLane.set(lid, existing);
    }

    const results = Array.from(byLane.values()).map(l => ({
      ...l,
      marginPercent: l.totalRevenueCents > 0 ? Math.round((l.totalMarginCents / l.totalRevenueCents) * 10000) / 100 : 0,
    }));

    results.sort((a, b) => b.totalMarginCents - a.totalMarginCents);

    return { data: results, error: null };
  });

  // Margin over time (daily/weekly/monthly)
  server.get('/api/v1/reports/margin/over-time', {
    schema: {
      tags: ['Broker Reports'],
      summary: 'Margin trends over time',
      querystring: {
        type: 'object',
        properties: {
          dateFrom: { type: 'string', format: 'date' },
          dateTo: { type: 'string', format: 'date' },
          granularity: { type: 'string', enum: ['daily', 'weekly', 'monthly'], default: 'weekly' },
        },
      },
    },
  }, async (req: FastifyRequest) => {
    const query = req.query as { dateFrom?: string; dateTo?: string; granularity?: string };
    const granularity = query.granularity || 'weekly';

    const dateFrom = query.dateFrom ? new Date(query.dateFrom) : new Date(Date.now() - 90 * 86400000);
    const dateTo = query.dateTo ? new Date(query.dateTo + 'T23:59:59Z') : new Date();

    const summaries = await prisma.shipmentFinancialSummary.findMany({
      where: {
        createdAt: { gte: dateFrom, lte: dateTo },
      },
      select: {
        actualRevenueCents: true,
        actualCostCents: true,
        expectedRevenueCents: true,
        expectedCostCents: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group by period
    const buckets = new Map<string, { revenue: number; cost: number; count: number }>();

    for (const s of summaries) {
      const d = s.createdAt;
      let key: string;
      if (granularity === 'daily') {
        key = d.toISOString().slice(0, 10);
      } else if (granularity === 'monthly') {
        key = d.toISOString().slice(0, 7);
      } else {
        // Weekly: ISO week start (Monday)
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d);
        monday.setDate(diff);
        key = monday.toISOString().slice(0, 10);
      }

      const bucket = buckets.get(key) || { revenue: 0, cost: 0, count: 0 };
      bucket.revenue += s.actualRevenueCents || s.expectedRevenueCents;
      bucket.cost += s.actualCostCents || s.expectedCostCents;
      bucket.count++;
      buckets.set(key, bucket);
    }

    const results = Array.from(buckets.entries()).map(([period, b]) => ({
      period,
      shipmentCount: b.count,
      revenueCents: b.revenue,
      costCents: b.cost,
      marginCents: b.revenue - b.cost,
      marginPercent: b.revenue > 0 ? Math.round(((b.revenue - b.cost) / b.revenue) * 10000) / 100 : 0,
    }));

    return { data: results, error: null };
  });
}
