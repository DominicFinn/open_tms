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

    // Fetch all unpaid invoices from read model (no joins needed)
    const invoices = await prisma.invoiceReadModel.findMany({
      where: {
        status: { in: ['sent', 'partial_paid', 'overdue'] },
        balanceCents: { gt: 0 },
        ...(query.customerId && { customerId: query.customerId }),
      },
      orderBy: { dueDate: 'asc' },
      take: 10000,
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
          customerName: inv.customerName,
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

    const invoices = await prisma.invoiceReadModel.findMany({
      where: {
        status: { in: ['sent', 'partial_paid', 'overdue'] },
        balanceCents: { gt: 0 },
        ...(query.customerId && { customerId: query.customerId }),
      },
      orderBy: [{ customerName: 'asc' }, { dueDate: 'asc' }],
      take: 10000,
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
        `"${inv.customerName}"`,
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
      take: 10000,
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

    const where: any = {};
    if (query.customerId) where.customerId = query.customerId;

    // Use read model - financial fields are already denormalized
    const shipments = await prisma.shipmentReadModel.findMany({ where, take: 10000 });

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
      if (!s.expectedRevenueCents && !s.expectedCostCents) continue;

      if (!customerMap.has(s.customerId)) {
        customerMap.set(s.customerId, {
          customerId: s.customerId,
          customerName: s.customerName,
          shipmentCount: 0,
          totalRevenueCents: 0,
          totalCostCents: 0,
          totalMarginCents: 0,
          marginPercent: 0,
        });
      }
      const entry = customerMap.get(s.customerId)!;
      entry.shipmentCount++;
      entry.totalRevenueCents += s.expectedRevenueCents ?? 0;
      entry.totalCostCents += s.expectedCostCents ?? 0;
      entry.totalMarginCents += s.expectedMarginCents ?? 0;
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

  // ─── CSV Exports for Accounting ─────────────────────────────────────────────

  const fmtCents = (c: number) => (c / 100).toFixed(2);
  const fmtD = (d: Date | string | null) => d ? new Date(d).toISOString().slice(0, 10) : '';
  const csvEscape = (s: string | null | undefined) => s ? `"${String(s).replace(/"/g, '""')}"` : '';

  // Invoice register CSV
  server.get('/api/v1/reports/export/invoices', {
    schema: {
      tags: ['Financial - Exports'],
      summary: 'Download invoice register as CSV (all invoices with line items)',
      querystring: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'Issue date from (YYYY-MM-DD)' },
          to: { type: 'string', description: 'Issue date to (YYYY-MM-DD)' },
          status: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const q = req.query as Record<string, string>;
    const where: any = {};
    if (q.from) where.issueDate = { ...(where.issueDate || {}), gte: new Date(q.from + 'T00:00:00Z') };
    if (q.to) where.issueDate = { ...(where.issueDate || {}), lte: new Date(q.to + 'T23:59:59Z') };
    if (q.status) where.status = q.status;

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        customer: { select: { name: true } },
        lineItems: true,
      },
      orderBy: { issueDate: 'asc' },
      take: 50000,
    });

    const rows = ['Invoice #,Status,Customer,Issue Date,Due Date,Subtotal,Tax,Total,Paid,Balance,Currency,Line Type,Line Description,Line Amount'];

    for (const inv of invoices) {
      if (inv.lineItems.length === 0) {
        rows.push([
          inv.invoiceNumber, inv.status, csvEscape(inv.customer.name),
          fmtD(inv.issueDate), fmtD(inv.dueDate),
          fmtCents(inv.subtotalCents), fmtCents(inv.taxCents), fmtCents(inv.totalCents),
          fmtCents(inv.paidCents), fmtCents(inv.balanceCents), inv.currency,
          '', '', '',
        ].join(','));
      }
      for (const li of inv.lineItems) {
        rows.push([
          inv.invoiceNumber, inv.status, csvEscape(inv.customer.name),
          fmtD(inv.issueDate), fmtD(inv.dueDate),
          fmtCents(inv.subtotalCents), fmtCents(inv.taxCents), fmtCents(inv.totalCents),
          fmtCents(inv.paidCents), fmtCents(inv.balanceCents), inv.currency,
          li.chargeType, csvEscape(li.description), fmtCents(li.totalCents),
        ].join(','));
      }
    }

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename="invoice-register-${new Date().toISOString().slice(0, 10)}.csv"`);
    return rows.join('\n');
  });

  // Carrier invoice register CSV
  server.get('/api/v1/reports/export/carrier-invoices', {
    schema: {
      tags: ['Financial - Exports'],
      summary: 'Download carrier invoice register as CSV',
      querystring: {
        type: 'object',
        properties: {
          from: { type: 'string' },
          to: { type: 'string' },
          status: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const q = req.query as Record<string, string>;
    const where: any = {};
    if (q.from) where.receivedDate = { ...(where.receivedDate || {}), gte: new Date(q.from + 'T00:00:00Z') };
    if (q.to) where.receivedDate = { ...(where.receivedDate || {}), lte: new Date(q.to + 'T23:59:59Z') };
    if (q.status) where.status = q.status;

    const invoices = await prisma.carrierInvoice.findMany({
      where,
      include: {
        carrier: { select: { name: true, scacCode: true } },
        lineItems: true,
      },
      orderBy: { receivedDate: 'asc' },
      take: 50000,
    });

    const rows = ['Invoice #,Status,Carrier,SCAC,Received,Due,Total,Approved,Paid,Match Status,Variance,Variance %,Line Type,Line Description,Line Amount,Expected,Line Variance'];

    for (const ci of invoices) {
      if (ci.lineItems.length === 0) {
        rows.push([
          ci.invoiceNumber, ci.status, csvEscape(ci.carrier.name), ci.carrier.scacCode || '',
          fmtD(ci.receivedDate), fmtD(ci.dueDate),
          fmtCents(ci.totalCents), ci.approvedCents != null ? fmtCents(ci.approvedCents) : '', fmtCents(ci.paidCents),
          ci.matchStatus, ci.varianceCents != null ? fmtCents(ci.varianceCents) : '', ci.variancePercent != null ? String(ci.variancePercent) : '',
          '', '', '', '', '',
        ].join(','));
      }
      for (const li of ci.lineItems) {
        rows.push([
          ci.invoiceNumber, ci.status, csvEscape(ci.carrier.name), ci.carrier.scacCode || '',
          fmtD(ci.receivedDate), fmtD(ci.dueDate),
          fmtCents(ci.totalCents), ci.approvedCents != null ? fmtCents(ci.approvedCents) : '', fmtCents(ci.paidCents),
          ci.matchStatus, ci.varianceCents != null ? fmtCents(ci.varianceCents) : '', ci.variancePercent != null ? String(ci.variancePercent) : '',
          li.chargeType, csvEscape(li.description), fmtCents(li.amountCents),
          li.expectedAmountCents != null ? fmtCents(li.expectedAmountCents) : '',
          li.varianceCents != null ? fmtCents(li.varianceCents) : '',
        ].join(','));
      }
    }

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename="carrier-invoice-register-${new Date().toISOString().slice(0, 10)}.csv"`);
    return rows.join('\n');
  });

  // Payment ledger CSV
  server.get('/api/v1/reports/export/payments', {
    schema: {
      tags: ['Financial - Exports'],
      summary: 'Download payment ledger as CSV (all customer payments received)',
      querystring: {
        type: 'object',
        properties: {
          from: { type: 'string' },
          to: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const q = req.query as Record<string, string>;
    const where: any = {};
    if (q.from) where.receivedDate = { ...(where.receivedDate || {}), gte: new Date(q.from + 'T00:00:00Z') };
    if (q.to) where.receivedDate = { ...(where.receivedDate || {}), lte: new Date(q.to + 'T23:59:59Z') };

    const payments = await prisma.payment.findMany({
      where,
      include: {
        invoice: {
          select: { invoiceNumber: true, customerId: true, customer: { select: { name: true } } },
        },
      },
      orderBy: { receivedDate: 'asc' },
      take: 50000,
    });

    const rows = ['Date,Invoice #,Customer,Amount,Method,Reference,Notes'];

    for (const p of payments) {
      rows.push([
        fmtD(p.receivedDate),
        p.invoice.invoiceNumber,
        csvEscape(p.invoice.customer.name),
        fmtCents(p.amountCents),
        p.paymentMethod || '',
        csvEscape(p.referenceNumber),
        csvEscape(p.notes),
      ].join(','));
    }

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename="payment-ledger-${new Date().toISOString().slice(0, 10)}.csv"`);
    return rows.join('\n');
  });

  // Charge detail CSV
  server.get('/api/v1/reports/export/charges', {
    schema: {
      tags: ['Financial - Exports'],
      summary: 'Download all charges as CSV (revenue and cost line items)',
      querystring: {
        type: 'object',
        properties: {
          from: { type: 'string' },
          to: { type: 'string' },
          chargeCategory: { type: 'string', enum: ['revenue', 'cost'] },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const q = req.query as Record<string, string>;
    const where: any = {};
    if (q.from) where.createdAt = { ...(where.createdAt || {}), gte: new Date(q.from + 'T00:00:00Z') };
    if (q.to) where.createdAt = { ...(where.createdAt || {}), lte: new Date(q.to + 'T23:59:59Z') };
    if (q.chargeCategory) where.chargeCategory = q.chargeCategory;

    const charges = await prisma.charge.findMany({
      where,
      include: {
        shipment: { select: { reference: true, customer: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'asc' },
      take: 50000,
    });

    const rows = ['Date,Shipment,Customer,Category,Type,Description,Amount,Currency,Status,Source,Freight Class'];

    for (const c of charges) {
      rows.push([
        fmtD(c.createdAt),
        c.shipment?.reference || '',
        csvEscape(c.shipment?.customer?.name),
        c.chargeCategory,
        c.chargeType,
        csvEscape(c.description),
        fmtCents(c.amountCents),
        c.currency,
        c.status,
        c.source,
        c.freightClass || '',
      ].join(','));
    }

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename="charge-detail-${new Date().toISOString().slice(0, 10)}.csv"`);
    return rows.join('\n');
  });
}
