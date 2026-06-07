/**
 * SLA Compliance Report routes — CSV export of SLA evaluation history.
 *
 * Generates customer-facing compliance reports showing delivery performance,
 * breach history, and resolution times over a date range.
 */

import { FastifyPluginAsync } from 'fastify';

export const slaReportRoutes: FastifyPluginAsync = async (server) => {
  // GET /api/v1/reports/sla-compliance — download SLA compliance report as CSV
  server.get<{
    Querystring: {
      from?: string;
      to?: string;
      customerId?: string;
      ruleType?: string;
      format?: string;
    };
  }>('/api/v1/reports/sla-compliance', {
    schema: {
      tags: ['SLA Reports'],
      summary: 'Download SLA compliance report as CSV',
      querystring: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
          to: { type: 'string', description: 'End date (YYYY-MM-DD)' },
          customerId: { type: 'string', description: 'Filter by customer' },
          ruleType: { type: 'string', description: 'Filter by rule type (comma-separated)' },
          format: { type: 'string', enum: ['csv'], description: 'Export format (default: csv)' },
        },
      },
    },
  }, async (request, reply) => {
    const fromDate = request.query.from
      ? new Date(request.query.from + 'T00:00:00Z')
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: last 30 days
    const toDate = request.query.to
      ? new Date(request.query.to + 'T23:59:59Z')
      : new Date();
    const ruleTypes = request.query.ruleType?.split(',').filter(Boolean);

    // Build query
    const where: any = {
      createdAt: { gte: fromDate, lte: toDate },
    };
    if (request.query.customerId) {
      where.customerId = request.query.customerId;
    }
    if (ruleTypes?.length) {
      where.ruleType = { in: ruleTypes };
    }

    // Cursor-paginate to avoid silent truncation. The previous implementation
    // capped the result set at 10K rows with no warning, so high-volume orgs
    // got an incomplete report. Pull customer names lazily as we encounter
    // unseen customer IDs, instead of resolving them all up-front.
    const BATCH_SIZE = 1000;
    const HEADER_ROW = [
      'Evaluation ID',
      'Entity Type',
      'Entity ID',
      'Entity Reference',
      'Customer',
      'Rule Type',
      'Rule Name',
      'Status',
      'SLA Started',
      'SLA Due',
      'Warning At',
      'Breached At',
      'Met At',
      'Breach Duration (min)',
      'Remaining (min)',
    ].join(',');

    const fromStr = fromDate.toISOString().slice(0, 10);
    const toStr = toDate.toISOString().slice(0, 10);

    reply
      .header('Content-Type', 'text/csv')
      .header('Content-Disposition', `attachment; filename="SLA-Compliance-Report-${fromStr}-to-${toStr}.csv"`);

    // Build the CSV in memory via cursor pagination — keeps response shape
    // identical to the previous Buffer payload while removing the 10K cap.
    const csvParts: string[] = [HEADER_ROW];
    const customerMap = new Map<string, string>();
    let cursor: { id: string } | undefined;

    while (true) {
      const batch = await server.prisma.slaEvaluation.findMany({
        where,
        orderBy: [{ slaStartedAt: 'asc' }, { id: 'asc' }],
        take: BATCH_SIZE,
        ...(cursor ? { cursor, skip: 1 } : {}),
      });
      if (batch.length === 0) break;

      // Resolve any customer IDs we haven't seen yet
      const unseenCustomerIds = batch
        .map((e) => e.customerId)
        .filter((id): id is string => !!id && !customerMap.has(id));
      if (unseenCustomerIds.length > 0) {
        const customers = await server.prisma.customer.findMany({
          where: { id: { in: Array.from(new Set(unseenCustomerIds)) } },
          select: { id: true, name: true },
        });
        for (const c of customers) customerMap.set(c.id, c.name);
      }

      for (const e of batch) {
        const fields = [
          e.id,
          e.entityType,
          e.entityId,
          e.entityReference || '',
          e.customerId ? (customerMap.get(e.customerId) || e.customerId) : '',
          e.ruleType,
          e.ruleName,
          e.status,
          e.slaStartedAt.toISOString(),
          e.slaDueAt?.toISOString() || '',
          e.warningAt?.toISOString() || '',
          e.breachedAt?.toISOString() || '',
          e.metAt?.toISOString() || '',
          e.breachDurationMinutes?.toString() || '',
          e.remainingMinutes?.toString() || '',
        ];
        csvParts.push(fields.map((f) => `"${f.replace(/"/g, '""')}"`).join(','));
      }

      if (batch.length < BATCH_SIZE) break;
      cursor = { id: batch[batch.length - 1].id };
    }

    return reply.send(csvParts.join('\n'));
  });

  // GET /api/v1/reports/sla-summary — summary stats for a date range (JSON)
  server.get<{
    Querystring: {
      from?: string;
      to?: string;
      customerId?: string;
    };
  }>('/api/v1/reports/sla-summary', {
    schema: {
      tags: ['SLA Reports'],
      summary: 'SLA compliance summary stats for a date range',
      querystring: {
        type: 'object',
        properties: {
          from: { type: 'string' },
          to: { type: 'string' },
          customerId: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: 'object' },
            error: { type: 'string', nullable: true },
          },
        },
      },
    },
  }, async (request) => {
    const fromDate = request.query.from
      ? new Date(request.query.from + 'T00:00:00Z')
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = request.query.to
      ? new Date(request.query.to + 'T23:59:59Z')
      : new Date();

    const where: any = {
      createdAt: { gte: fromDate, lte: toDate },
    };
    if (request.query.customerId) {
      where.customerId = request.query.customerId;
    }

    // Aggregate by status
    const statusCounts = await server.prisma.slaEvaluation.groupBy({
      by: ['status'],
      where,
      _count: true,
    });

    // Aggregate by rule type
    const ruleTypeCounts = await server.prisma.slaEvaluation.groupBy({
      by: ['ruleType', 'status'],
      where,
      _count: true,
    });

    // Calculate compliance rate
    const total = statusCounts.reduce((sum, r) => sum + r._count, 0);
    const metCount = statusCounts.find((r) => r.status === 'met')?._count || 0;
    const breachedCount = statusCounts.find((r) => r.status === 'breached')?._count || 0;
    const complianceRate = (metCount + breachedCount) > 0
      ? Math.round((metCount / (metCount + breachedCount)) * 100)
      : 100;

    // Average breach duration
    const breached = await server.prisma.slaEvaluation.findMany({
      where: { ...where, status: 'breached', breachDurationMinutes: { not: null } },
      select: { breachDurationMinutes: true },
      take: 10000,
    });
    const avgBreachMinutes = breached.length > 0
      ? Math.round(breached.reduce((sum, b) => sum + (b.breachDurationMinutes || 0), 0) / breached.length)
      : null;

    // Build rule type breakdown
    const ruleBreakdown: Record<string, Record<string, number>> = {};
    for (const r of ruleTypeCounts) {
      if (!ruleBreakdown[r.ruleType]) ruleBreakdown[r.ruleType] = {};
      ruleBreakdown[r.ruleType][r.status] = r._count;
    }

    return {
      data: {
        period: { from: fromDate.toISOString(), to: toDate.toISOString() },
        complianceRate,
        total,
        byStatus: Object.fromEntries(statusCounts.map((r) => [r.status, r._count])),
        avgBreachDurationMinutes: avgBreachMinutes,
        byRuleType: ruleBreakdown,
      },
      error: null,
    };
  });
};
