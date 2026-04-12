/**
 * Financial Reports — AR aging, carrier spend, margin analysis, CSV export.
 */

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { container, TOKENS } from '../di/index.js';

interface AgingBucket {
  current: number;    // not yet due
  days1to30: number;  // 1-30 days past due
  days31to60: number; // 31-60
  days61to90: number; // 61-90
  days90plus: number; // 90+
  total: number;
}

interface CustomerAging {
  customerId: string;
  customerName: string;
  invoiceCount: number;
  buckets: AgingBucket;
}

interface AgingSummary {
  totals: AgingBucket;
  customers: CustomerAging[];
  generatedAt: string;
  asOfDate: string;
}

export async function financialReportRoutes(server: FastifyInstance) {
  const prisma = container.resolve<PrismaClient>(TOKENS.PrismaClient);

  // AR Aging Report — JSON
  server.get('/api/v1/reports/ar-aging', {
    schema: {
      tags: ['Financial - Reports'],
      summary: 'Accounts Receivable aging report — outstanding invoices bucketed by days past due per customer',
      querystring: {
        type: 'object',
        properties: {
          customerId: { type: 'string', description: 'Filter to a single customer' },
          asOfDate: { type: 'string', description: 'Calculate aging as of this date (YYYY-MM-DD, default: today)' },
        },
      },
    },
  }, async (req: FastifyRequest) => {
    const query = req.query as Record<string, string>;
    const asOf = query.asOfDate ? new Date(query.asOfDate + 'T23:59:59Z') : new Date();

    // Fetch all unpaid invoices
    const invoices = await prisma.invoice.findMany({
      where: {
        status: { in: ['sent', 'partial_paid', 'overdue'] },
        balanceCents: { gt: 0 },
        ...(query.customerId && { customerId: query.customerId }),
      },
      select: {
        id: true,
        invoiceNumber: true,
        customerId: true,
        totalCents: true,
        paidCents: true,
        balanceCents: true,
        issueDate: true,
        dueDate: true,
        status: true,
        customer: { select: { name: true } },
      },
      orderBy: { dueDate: 'asc' },
    });

    // Group by customer and bucket by days past due
    const customerMap = new Map<string, CustomerAging>();
    const totals: AgingBucket = { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, days90plus: 0, total: 0 };

    for (const inv of invoices) {
      const daysPast = Math.floor((asOf.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24));
      const balance = inv.balanceCents;

      if (!customerMap.has(inv.customerId)) {
        customerMap.set(inv.customerId, {
          customerId: inv.customerId,
          customerName: inv.customer.name,
          invoiceCount: 0,
          buckets: { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, days90plus: 0, total: 0 },
        });
      }

      const customer = customerMap.get(inv.customerId)!;
      customer.invoiceCount++;
      customer.buckets.total += balance;
      totals.total += balance;

      if (daysPast <= 0) {
        customer.buckets.current += balance;
        totals.current += balance;
      } else if (daysPast <= 30) {
        customer.buckets.days1to30 += balance;
        totals.days1to30 += balance;
      } else if (daysPast <= 60) {
        customer.buckets.days31to60 += balance;
        totals.days31to60 += balance;
      } else if (daysPast <= 90) {
        customer.buckets.days61to90 += balance;
        totals.days61to90 += balance;
      } else {
        customer.buckets.days90plus += balance;
        totals.days90plus += balance;
      }
    }

    // Sort customers by total outstanding (highest first)
    const customers = [...customerMap.values()].sort((a, b) => b.buckets.total - a.buckets.total);

    const summary: AgingSummary = {
      totals,
      customers,
      generatedAt: new Date().toISOString(),
      asOfDate: asOf.toISOString().slice(0, 10),
    };

    return { data: summary, error: null };
  });

  // AR Aging Report — CSV export
  server.get('/api/v1/reports/ar-aging/csv', {
    schema: {
      tags: ['Financial - Reports'],
      summary: 'Download AR aging report as CSV',
      querystring: {
        type: 'object',
        properties: {
          customerId: { type: 'string' },
          asOfDate: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const query = req.query as Record<string, string>;
    const asOf = query.asOfDate ? new Date(query.asOfDate + 'T23:59:59Z') : new Date();

    const invoices = await prisma.invoice.findMany({
      where: {
        status: { in: ['sent', 'partial_paid', 'overdue'] },
        balanceCents: { gt: 0 },
        ...(query.customerId && { customerId: query.customerId }),
      },
      select: {
        invoiceNumber: true,
        customerId: true,
        totalCents: true,
        paidCents: true,
        balanceCents: true,
        issueDate: true,
        dueDate: true,
        status: true,
        customer: { select: { name: true } },
      },
      orderBy: [{ customer: { name: 'asc' } }, { dueDate: 'asc' }],
    });

    const fmt = (cents: number) => (cents / 100).toFixed(2);
    const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

    const rows = [
      ['Customer', 'Invoice #', 'Issue Date', 'Due Date', 'Days Past Due', 'Total', 'Paid', 'Balance', 'Aging Bucket'].join(','),
    ];

    for (const inv of invoices) {
      const daysPast = Math.max(0, Math.floor((asOf.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24)));
      let bucket = 'Current';
      if (daysPast > 90) bucket = '90+ Days';
      else if (daysPast > 60) bucket = '61-90 Days';
      else if (daysPast > 30) bucket = '31-60 Days';
      else if (daysPast > 0) bucket = '1-30 Days';

      rows.push([
        `"${inv.customer.name}"`,
        inv.invoiceNumber,
        fmtDate(inv.issueDate),
        fmtDate(inv.dueDate),
        String(daysPast),
        fmt(inv.totalCents),
        fmt(inv.paidCents),
        fmt(inv.balanceCents),
        bucket,
      ].join(','));
    }

    const dateStr = asOf.toISOString().slice(0, 10);
    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename="ar-aging-${dateStr}.csv"`);
    return rows.join('\n');
  });

  // Carrier spend summary
  server.get('/api/v1/reports/carrier-spend', {
    schema: {
      tags: ['Financial - Reports'],
      summary: 'Carrier spend summary — total paid and outstanding per carrier',
      querystring: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
          to: { type: 'string', description: 'End date (YYYY-MM-DD)' },
        },
      },
    },
  }, async (req: FastifyRequest) => {
    const query = req.query as Record<string, string>;
    const from = query.from ? new Date(query.from + 'T00:00:00Z') : new Date(Date.now() - 90 * 86400000);
    const to = query.to ? new Date(query.to + 'T23:59:59Z') : new Date();

    const carrierInvoices = await prisma.carrierInvoice.findMany({
      where: {
        receivedDate: { gte: from, lte: to },
      },
      select: {
        carrierId: true,
        totalCents: true,
        approvedCents: true,
        paidCents: true,
        status: true,
        carrier: { select: { name: true, scacCode: true } },
      },
    });

    const carrierMap = new Map<string, {
      carrierId: string;
      carrierName: string;
      scacCode: string | null;
      invoiceCount: number;
      totalInvoicedCents: number;
      totalApprovedCents: number;
      totalPaidCents: number;
      outstandingCents: number;
    }>();

    for (const ci of carrierInvoices) {
      if (!carrierMap.has(ci.carrierId)) {
        carrierMap.set(ci.carrierId, {
          carrierId: ci.carrierId,
          carrierName: ci.carrier.name,
          scacCode: ci.carrier.scacCode,
          invoiceCount: 0,
          totalInvoicedCents: 0,
          totalApprovedCents: 0,
          totalPaidCents: 0,
          outstandingCents: 0,
        });
      }
      const entry = carrierMap.get(ci.carrierId)!;
      entry.invoiceCount++;
      entry.totalInvoicedCents += ci.totalCents;
      entry.totalApprovedCents += ci.approvedCents ?? 0;
      entry.totalPaidCents += ci.paidCents;
      entry.outstandingCents += (ci.approvedCents ?? ci.totalCents) - ci.paidCents;
    }

    const carriers = [...carrierMap.values()].sort((a, b) => b.totalInvoicedCents - a.totalInvoicedCents);

    return {
      data: {
        period: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
        totalInvoicedCents: carriers.reduce((s, c) => s + c.totalInvoicedCents, 0),
        totalPaidCents: carriers.reduce((s, c) => s + c.totalPaidCents, 0),
        carriers,
      },
      error: null,
    };
  });

  // Margin analysis by customer
  server.get('/api/v1/reports/margin-analysis', {
    schema: {
      tags: ['Financial - Reports'],
      summary: 'Margin analysis — revenue vs cost per customer from shipment financial summaries',
      querystring: {
        type: 'object',
        properties: {
          customerId: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest) => {
    const query = req.query as Record<string, string>;

    const shipmentWhere: any = {};
    if (query.customerId) shipmentWhere.customerId = query.customerId;

    const shipments = await prisma.shipment.findMany({
      where: shipmentWhere,
      select: {
        id: true,
        customerId: true,
        customer: { select: { name: true } },
        shipmentFinancialSummary: {
          select: {
            expectedRevenueCents: true,
            expectedCostCents: true,
            expectedMarginCents: true,
            actualRevenueCents: true,
            actualCostCents: true,
            actualMarginCents: true,
          },
        },
      },
    });

    const customerMap = new Map<string, {
      customerId: string;
      customerName: string;
      shipmentCount: number;
      totalRevenueCents: number;
      totalCostCents: number;
      totalMarginCents: number;
      marginPercent: number;
    }>();

    for (const s of shipments) {
      const fin = s.shipmentFinancialSummary;
      if (!fin) continue;

      if (!customerMap.has(s.customerId)) {
        customerMap.set(s.customerId, {
          customerId: s.customerId,
          customerName: s.customer.name,
          shipmentCount: 0,
          totalRevenueCents: 0,
          totalCostCents: 0,
          totalMarginCents: 0,
          marginPercent: 0,
        });
      }
      const entry = customerMap.get(s.customerId)!;
      entry.shipmentCount++;
      entry.totalRevenueCents += fin.expectedRevenueCents;
      entry.totalCostCents += fin.expectedCostCents;
      entry.totalMarginCents += fin.expectedMarginCents;
    }

    const customers = [...customerMap.values()].map(c => ({
      ...c,
      marginPercent: c.totalRevenueCents > 0
        ? Math.round((c.totalMarginCents / c.totalRevenueCents) * 10000) / 100
        : 0,
    })).sort((a, b) => b.totalRevenueCents - a.totalRevenueCents);

    return {
      data: {
        totalRevenueCents: customers.reduce((s, c) => s + c.totalRevenueCents, 0),
        totalCostCents: customers.reduce((s, c) => s + c.totalCostCents, 0),
        totalMarginCents: customers.reduce((s, c) => s + c.totalMarginCents, 0),
        customers,
      },
      error: null,
    };
  });
}
