/**
 * Executive Dashboard API - single endpoint returning all KPIs.
 *
 * Performance: ALL queries hit read models and pre-aggregated tables
 * via count(), groupBy(), and aggregate() on indexed columns.
 * No write model scans. All queries run in parallel via Promise.all.
 */

import { FastifyInstance, FastifyRequest } from 'fastify';

export async function reportsDashboardRoutes(server: FastifyInstance) {

  server.get('/api/v1/reports/dashboard', {
    schema: {
      tags: ['Reports'],
      summary: 'Executive dashboard - all KPIs in a single call (read-model-only queries)',
      querystring: {
        type: 'object',
        properties: {
          dateFrom: { type: 'string', format: 'date', description: 'Period start (default: 30 days ago)' },
          dateTo: { type: 'string', format: 'date', description: 'Period end (default: today)' },
        },
      },
    },
  }, async (req: FastifyRequest) => {
    const query = req.query as { dateFrom?: string; dateTo?: string };

    const now = new Date();
    const dateTo = query.dateTo ? new Date(query.dateTo + 'T23:59:59Z') : now;
    const dateFrom = query.dateFrom ? new Date(query.dateFrom) : new Date(dateTo.getTime() - 30 * 86400000);

    // Prior period (same duration, shifted back) for trend comparison
    const periodMs = dateTo.getTime() - dateFrom.getTime();
    const priorTo = new Date(dateFrom.getTime());
    const priorFrom = new Date(dateFrom.getTime() - periodMs);

    const periodFilter = { createdAt: { gte: dateFrom, lte: dateTo } };
    const priorFilter = { createdAt: { gte: priorFrom, lte: priorTo } };

    // ── All queries in parallel ─────────────────────────────────────────
    const [
      shipmentsByStatus,
      ordersByStatus,
      ordersByDelivery,
      issueOpen,
      issueInProgress,
      issueCritical,
      financialCurrent,
      billingPipeline,
      invoiceOutstanding,
      invoiceOverdue,
      financialPrior,
      shipmentCountCurrent,
      shipmentCountPrior,
      orderCountCurrent,
      orderCountPrior,
    ] = await Promise.all([
      // 1. Shipments by status (snapshot - no date filter)
      server.prisma.shipmentReadModel.groupBy({
        by: ['status'],
        _count: true,
      }),

      // 2. Orders by status (snapshot)
      server.prisma.orderReadModel.groupBy({
        by: ['status'],
        _count: true,
      }),

      // 3. Orders by delivery status (snapshot)
      server.prisma.orderReadModel.groupBy({
        by: ['deliveryStatus'],
        _count: true,
      }),

      // 4-6. Issue counts
      server.prisma.issueReadModel.count({ where: { status: 'open' } }),
      server.prisma.issueReadModel.count({ where: { status: 'in_progress' } }),
      server.prisma.issueReadModel.count({ where: { priority: 'critical', status: { in: ['open', 'in_progress'] } } }),

      // 7. Financial totals for current period
      server.prisma.shipmentFinancialSummary.aggregate({
        where: periodFilter,
        _sum: {
          actualRevenueCents: true,
          actualCostCents: true,
          expectedRevenueCents: true,
          expectedCostCents: true,
        },
        _count: true,
      }),

      // 8. Billing pipeline (current period)
      server.prisma.shipmentFinancialSummary.groupBy({
        by: ['billingStatus'],
        where: periodFilter,
        _count: true,
      }),

      // 9. Outstanding invoices
      server.prisma.invoiceReadModel.aggregate({
        where: { status: { in: ['sent', 'partial_paid', 'overdue'] } },
        _sum: { balanceCents: true },
        _count: true,
      }),

      // 10. Overdue invoices
      server.prisma.invoiceReadModel.aggregate({
        where: { daysPastDue: { gt: 0 }, status: { not: 'paid' } },
        _sum: { balanceCents: true },
        _count: true,
      }),

      // 11. Financial totals for prior period (trends)
      server.prisma.shipmentFinancialSummary.aggregate({
        where: priorFilter,
        _sum: {
          actualRevenueCents: true,
          actualCostCents: true,
          expectedRevenueCents: true,
          expectedCostCents: true,
        },
        _count: true,
      }),

      // 12-15. Shipment and order counts for trend comparison
      server.prisma.shipmentReadModel.count({ where: periodFilter }),
      server.prisma.shipmentReadModel.count({ where: priorFilter }),
      server.prisma.orderReadModel.count({ where: periodFilter }),
      server.prisma.orderReadModel.count({ where: priorFilter }),
    ]);

    // ── Assemble shipment stats ─────────────────────────────────────────
    const shipmentStatusMap: Record<string, number> = {};
    let shipmentTotal = 0;
    for (const row of shipmentsByStatus) {
      shipmentStatusMap[row.status] = row._count;
      shipmentTotal += row._count;
    }

    const inTransit = shipmentStatusMap['in_transit'] || 0;
    const atLocations = (shipmentStatusMap['at_pickup'] || 0) + (shipmentStatusMap['at_delivery'] || 0);
    const complete = shipmentStatusMap['delivered'] || 0;

    // ── Assemble order stats ────────────────────────────────────────────
    const orderStatusMap: Record<string, number> = {};
    let orderTotal = 0;
    for (const row of ordersByStatus) {
      orderStatusMap[row.status] = row._count;
      orderTotal += row._count;
    }

    const deliveryStatusMap: Record<string, number> = {};
    for (const row of ordersByDelivery) {
      deliveryStatusMap[row.deliveryStatus] = row._count;
    }

    // ── Assemble financial stats ────────────────────────────────────────
    const revenue = (financialCurrent._sum.actualRevenueCents || 0) || (financialCurrent._sum.expectedRevenueCents || 0);
    const cost = (financialCurrent._sum.actualCostCents || 0) || (financialCurrent._sum.expectedCostCents || 0);
    const margin = revenue - cost;
    const marginPercent = revenue > 0 ? Math.round((margin / revenue) * 10000) / 100 : 0;

    const billingMap: Record<string, number> = {};
    for (const row of billingPipeline) {
      billingMap[row.billingStatus] = row._count;
    }

    // ── Compute trends ──────────────────────────────────────────────────
    const priorRevenue = (financialPrior._sum.actualRevenueCents || 0) || (financialPrior._sum.expectedRevenueCents || 0);
    const priorCost = (financialPrior._sum.actualCostCents || 0) || (financialPrior._sum.expectedCostCents || 0);
    const priorMargin = priorRevenue - priorCost;

    const pctChange = (current: number, prior: number): number | null => {
      if (prior === 0) return current > 0 ? null : null; // can't compute % change from zero
      return Math.round(((current - prior) / prior) * 1000) / 10;
    };

    // ── Build period label ──────────────────────────────────────────────
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const periodLabel = `${fmt(dateFrom)} - ${fmt(dateTo)}`;

    return {
      data: {
        periodLabel,
        dateFrom: dateFrom.toISOString(),
        dateTo: dateTo.toISOString(),

        shipments: {
          total: shipmentTotal,
          byStatus: shipmentStatusMap,
          inTransit,
          atLocations,
          complete,
        },

        orders: {
          total: orderTotal,
          byStatus: orderStatusMap,
          byDeliveryStatus: deliveryStatusMap,
        },

        issues: {
          open: issueOpen,
          inProgress: issueInProgress,
          critical: issueCritical,
        },

        financial: {
          periodLabel,
          totalRevenueCents: revenue,
          totalCostCents: cost,
          totalMarginCents: margin,
          marginPercent,
          shipmentCount: financialCurrent._count,
          notInvoiced: (billingMap['not_ready'] || 0) + (billingMap['ready_to_invoice'] || 0),
          invoiced: billingMap['invoiced'] || 0,
          paid: billingMap['paid'] || 0,
        },

        invoices: {
          outstanding: invoiceOutstanding._count,
          overdueCount: invoiceOverdue._count,
          totalBalanceCents: invoiceOutstanding._sum.balanceCents || 0,
          overdueBalanceCents: invoiceOverdue._sum.balanceCents || 0,
        },

        trends: {
          shipmentCountChange: pctChange(shipmentCountCurrent, shipmentCountPrior),
          revenueChange: pctChange(revenue, priorRevenue),
          marginChange: pctChange(margin, priorMargin),
          orderCountChange: pctChange(orderCountCurrent, orderCountPrior),
        },
      },
      error: null,
    };
  });
}
