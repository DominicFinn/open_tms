/**
 * Quality Centre Routes
 *
 * Dashboard stats, issue trends, quality summaries by dimension,
 * CAPA follow-up management, SOP/GDP checklist and audit management.
 */

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { randomUUID } from 'crypto';
import { container, TOKENS } from '../di/index.js';
import { ICommandBus } from '../commands/CommandBus.js';
import { IBinaryStorageProvider } from '../storage/IBinaryStorageProvider.js';
import { IAttachmentRepository } from '../repositories/AttachmentRepository.js';
import { CREATE_CAPA_FOLLOW_UP } from '../commands/capaFollowUps/CreateCAPAFollowUpCommand.js';
import { COMPLETE_CAPA_FOLLOW_UP } from '../commands/capaFollowUps/CompleteCAPAFollowUpCommand.js';
import { CREATE_SOP_CHECKLIST } from '../commands/sopChecklists/CreateSOPChecklistCommand.js';
import { START_SOP_AUDIT } from '../commands/sopChecklists/StartSOPAuditCommand.js';
import { COMPLETE_SOP_AUDIT } from '../commands/sopChecklists/CompleteSOPAuditCommand.js';

export async function qualityCentreRoutes(server: FastifyInstance) {
  const commandBus = container.resolve<ICommandBus>(TOKENS.ICommandBus);

  const getOrgId = async () => {
    const org = await server.prisma.organization.findFirst({ select: { id: true } });
    return org?.id || 'default-org';
  };

  // ─── Dashboard Stats ───────────────────────────────────────────────────────

  server.get('/api/v1/quality/dashboard', {
    schema: {
      tags: ['Quality Centre'],
      summary: 'Quality Centre dashboard stats',
      description: 'Returns aggregated quality metrics: issue counts, CAPA status, SOP compliance.',
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: 'object' },
            error: { type: ['string', 'null'] },
          },
        },
      },
    },
  }, async (_req: FastifyRequest, _reply: FastifyReply) => {
    const orgId = await getOrgId();
    const now = new Date();

    // Issue stats
    const [totalIssues, openIssues, criticalIssues, needsCapaCount] = await Promise.all([
      server.prisma.issueReadModel.count({ where: { orgId } }),
      server.prisma.issueReadModel.count({ where: { orgId, status: { in: ['open', 'in_progress'] } } }),
      server.prisma.issueReadModel.count({ where: { orgId, priority: 'critical', status: { not: 'closed' } } }),
      server.prisma.issueReadModel.count({ where: { orgId, needsCapa: true } }),
    ]);

    // CAPA stats
    const [totalCapas, openCapas, overdueCapas] = await Promise.all([
      server.prisma.cAPAReport.count({ where: { orgId } }),
      server.prisma.cAPAReport.count({ where: { orgId, status: { notIn: ['closed', 'verification'] } } }),
      server.prisma.cAPAFollowUp.count({
        where: { orgId, status: 'pending', dueDate: { lt: now } },
      }),
    ]);

    // SOP stats
    const [totalChecklists, overdueChecklists, recentAudits, failedAudits] = await Promise.all([
      server.prisma.sOPChecklist.count({ where: { orgId, status: 'active' } }),
      server.prisma.sOPChecklist.count({
        where: { orgId, status: 'active', nextDueDate: { lt: now } },
      }),
      server.prisma.sOPAudit.count({
        where: {
          orgId,
          createdAt: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
        },
      }),
      server.prisma.sOPAudit.count({
        where: {
          orgId,
          status: 'failed',
          createdAt: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    // Issue category breakdown
    const categoryBreakdown = await server.prisma.issueReadModel.groupBy({
      by: ['category'],
      where: { orgId },
      _count: true,
    });

    // Issue priority breakdown (open only)
    const priorityBreakdown = await server.prisma.issueReadModel.groupBy({
      by: ['priority'],
      where: { orgId, status: { not: 'closed' } },
      _count: true,
    });

    return {
      data: {
        issues: {
          total: totalIssues,
          open: openIssues,
          critical: criticalIssues,
          needsCapa: needsCapaCount,
          byCategory: categoryBreakdown.map(c => ({ category: c.category, count: c._count })),
          byPriority: priorityBreakdown.map(p => ({ priority: p.priority, count: p._count })),
        },
        capa: {
          total: totalCapas,
          open: openCapas,
          overdueFollowUps: overdueCapas,
        },
        sop: {
          activeChecklists: totalChecklists,
          overdueChecklists,
          recentAudits,
          failedAudits,
        },
      },
      error: null,
    };
  });

  // ─── Issue Trends Over Time ────────────────────────────────────────────────

  server.get('/api/v1/quality/trends', {
    schema: {
      tags: ['Quality Centre'],
      summary: 'Issue trends over time',
      description: 'Returns issue creation counts grouped by day/week/month for charting.',
      querystring: {
        type: 'object',
        properties: {
          period: { type: 'string', enum: ['7d', '30d', '90d', '12m'], default: '30d' },
          category: { type: 'string', description: 'Filter by issue category' },
        },
      },
    },
  }, async (req: FastifyRequest, _reply: FastifyReply) => {
    const { period = '30d', category } = req.query as { period?: string; category?: string };
    const orgId = await getOrgId();
    const now = new Date();

    let startDate: Date;
    switch (period) {
      case '7d': startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
      case '90d': startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); break;
      case '12m': startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000); break;
      default: startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
    }

    const where: any = {
      orgId,
      createdAt: { gte: startDate },
    };
    if (category) where.category = category;

    const issues = await server.prisma.issueReadModel.findMany({
      where,
      select: { createdAt: true, category: true, priority: true },
      orderBy: { createdAt: 'asc' },
    });

    // Group by date
    const dateMap = new Map<string, { total: number; byCategory: Record<string, number>; byPriority: Record<string, number> }>();
    for (const issue of issues) {
      const dateKey = issue.createdAt.toISOString().slice(0, 10);
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, { total: 0, byCategory: {}, byPriority: {} });
      }
      const entry = dateMap.get(dateKey)!;
      entry.total++;
      entry.byCategory[issue.category] = (entry.byCategory[issue.category] || 0) + 1;
      entry.byPriority[issue.priority] = (entry.byPriority[issue.priority] || 0) + 1;
    }

    const trends = Array.from(dateMap.entries()).map(([date, data]) => ({
      date,
      ...data,
    }));

    return { data: { period, startDate: startDate.toISOString(), trends }, error: null };
  });

  // ─── Quality Issue Summaries (by dimension) ────────────────────────────────

  server.get('/api/v1/quality/summaries', {
    schema: {
      tags: ['Quality Centre'],
      summary: 'Quality issue summaries by dimension',
      description: 'Returns aggregated issue metrics grouped by carrier, lane, location, or customer.',
      querystring: {
        type: 'object',
        properties: {
          dimensionType: { type: 'string', enum: ['carrier', 'lane', 'location', 'customer'] },
          sortBy: { type: 'string', default: 'totalIssues' },
          sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
          limit: { type: 'integer', default: 50 },
        },
      },
    },
  }, async (req: FastifyRequest, _reply: FastifyReply) => {
    const {
      dimensionType,
      sortBy = 'totalIssues',
      sortOrder = 'desc',
      limit = 50,
    } = req.query as { dimensionType?: string; sortBy?: string; sortOrder?: string; limit?: number };
    const orgId = await getOrgId();

    const where: any = { orgId };
    if (dimensionType) where.dimensionType = dimensionType;

    const summaries = await server.prisma.qualityIssueSummary.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      take: Number(limit),
    });

    return { data: summaries, error: null };
  });

  // ─── Rebuild quality summaries (admin/backfill) ────────────────────────────

  server.post('/api/v1/quality/summaries/rebuild', {
    schema: {
      tags: ['Quality Centre'],
      summary: 'Rebuild quality issue summaries',
      description: 'Rebuilds all QualityIssueSummary rows from scratch. Use after data migration or corrections.',
    },
  }, async (_req: FastifyRequest, _reply: FastifyReply) => {
    const orgId = await getOrgId();

    // Import and invoke the projection rebuild
    const { QualityIssueSummaryProjection } = await import('../events/projections/QualityIssueSummaryProjection.js');
    const projection = new QualityIssueSummaryProjection(server.prisma);
    await projection.rebuildAll(orgId);

    return { data: { message: 'Quality summaries rebuilt' }, error: null };
  });

  // ─── CAPA Follow-Ups ──────────────────────────────────────────────────────

  server.get('/api/v1/quality/capa-follow-ups', {
    schema: {
      tags: ['Quality Centre'],
      summary: 'List CAPA follow-ups',
      description: 'Returns CAPA follow-up notes. Supports filtering by CAPA report, status, and type.',
      querystring: {
        type: 'object',
        properties: {
          capaReportId: { type: 'string' },
          status: { type: 'string' },
          followUpType: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, _reply: FastifyReply) => {
    const { capaReportId, status, followUpType } = req.query as {
      capaReportId?: string; status?: string; followUpType?: string;
    };
    const orgId = await getOrgId();

    const where: any = { orgId };
    if (capaReportId) where.capaReportId = capaReportId;
    if (status) where.status = status;
    if (followUpType) where.followUpType = followUpType;

    const followUps = await server.prisma.cAPAFollowUp.findMany({
      where,
      include: {
        capaReport: { select: { reportNumber: true, title: true, status: true } },
      },
      orderBy: { dueDate: 'asc' },
    });

    return { data: followUps, error: null };
  });

  server.get('/api/v1/quality/capa-follow-ups/:id', {
    schema: {
      tags: ['Quality Centre'],
      summary: 'Get CAPA follow-up detail',
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const followUp = await server.prisma.cAPAFollowUp.findUnique({
      where: { id },
      include: {
        capaReport: { select: { reportNumber: true, title: true, status: true, issueId: true } },
      },
    });
    if (!followUp) {
      reply.code(404);
      return { data: null, error: 'Follow-up not found' };
    }
    return { data: followUp, error: null };
  });

  server.post('/api/v1/quality/capa-follow-ups', {
    schema: {
      tags: ['Quality Centre'],
      summary: 'Create CAPA follow-up',
      description: 'Creates a new follow-up note for a CAPA report (30/60/90 day review or ad-hoc).',
      body: {
        type: 'object',
        required: ['capaReportId', 'followUpType', 'dueDate'],
        properties: {
          capaReportId: { type: 'string' },
          followUpType: { type: 'string', enum: ['30_day', '60_day', '90_day', 'ad_hoc', 'effectiveness_check'] },
          dueDate: { type: 'string', format: 'date-time' },
          notes: { type: 'string' },
          actionItems: { type: 'string' },
          assigneeId: { type: 'string' },
          assigneeName: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, _reply: FastifyReply) => {
    const orgId = await getOrgId();
    const body = req.body as any;

    const result = await commandBus.dispatch({
      type: CREATE_CAPA_FOLLOW_UP,
      orgId,
      actorId: 'system',
      payload: body,
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) {
      return { data: null, error: result.error };
    }
    return { data: result.data, error: null };
  });

  server.put('/api/v1/quality/capa-follow-ups/:id/complete', {
    schema: {
      tags: ['Quality Centre'],
      summary: 'Complete a CAPA follow-up',
      description: 'Marks a follow-up as completed with outcome and notes.',
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      body: {
        type: 'object',
        required: ['outcome'],
        properties: {
          outcome: { type: 'string', enum: ['on_track', 'needs_attention', 'escalated', 'closed_effective', 'closed_ineffective'] },
          notes: { type: 'string' },
          actionItems: { type: 'string' },
          completedByName: { type: 'string', description: 'Name of person completing the review' },
        },
      },
    },
  }, async (req: FastifyRequest, _reply: FastifyReply) => {
    const orgId = await getOrgId();
    const { id } = req.params as { id: string };
    const body = req.body as any;

    const result = await commandBus.dispatch({
      type: COMPLETE_CAPA_FOLLOW_UP,
      orgId,
      actorId: 'system',
      payload: { followUpId: id, ...body },
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) {
      return { data: null, error: result.error };
    }
    return { data: result.data, error: null };
  });

  // Schedule follow-ups automatically for a CAPA (30/60/90 day)
  server.post('/api/v1/quality/capa-follow-ups/schedule', {
    schema: {
      tags: ['Quality Centre'],
      summary: 'Schedule 30/60/90 day follow-ups for a CAPA',
      description: 'Automatically creates 30, 60, and 90 day follow-up entries from the CAPA creation date.',
      body: {
        type: 'object',
        required: ['capaReportId'],
        properties: {
          capaReportId: { type: 'string' },
          assigneeId: { type: 'string' },
          assigneeName: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, _reply: FastifyReply) => {
    const orgId = await getOrgId();
    const { capaReportId, assigneeId, assigneeName } = req.body as any;

    const capa = await server.prisma.cAPAReport.findFirst({
      where: { id: capaReportId, orgId },
    });
    if (!capa) {
      return { data: null, error: 'CAPA report not found' };
    }

    const baseDate = capa.createdAt;
    const schedules = [
      { type: '30_day', days: 30 },
      { type: '60_day', days: 60 },
      { type: '90_day', days: 90 },
    ];

    const created = [];
    for (const schedule of schedules) {
      const dueDate = new Date(baseDate.getTime() + schedule.days * 24 * 60 * 60 * 1000);
      const result = await commandBus.dispatch({
        type: CREATE_CAPA_FOLLOW_UP,
        orgId,
        actorId: 'system',
        payload: {
          capaReportId,
          followUpType: schedule.type,
          dueDate: dueDate.toISOString(),
          assigneeId: assigneeId ?? null,
          assigneeName: assigneeName ?? null,
        },
        metadata: { correlationId: randomUUID(), source: 'api' },
      });
      if (result.success) created.push(result.data);
    }

    return { data: { scheduled: created }, error: null };
  });

  // ─── SOP Checklists ───────────────────────────────────────────────────────

  server.get('/api/v1/quality/sop-checklists', {
    schema: {
      tags: ['Quality Centre'],
      summary: 'List SOP checklists',
      querystring: {
        type: 'object',
        properties: {
          category: { type: 'string' },
          status: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, _reply: FastifyReply) => {
    const { category, status } = req.query as { category?: string; status?: string };
    const orgId = await getOrgId();

    const where: any = { orgId };
    if (category) where.category = category;
    if (status) where.status = status;

    const checklists = await server.prisma.sOPChecklist.findMany({
      where,
      include: {
        items: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { audits: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { data: checklists, error: null };
  });

  server.get('/api/v1/quality/sop-checklists/:id', {
    schema: {
      tags: ['Quality Centre'],
      summary: 'Get SOP checklist detail',
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const checklist = await server.prisma.sOPChecklist.findUnique({
      where: { id },
      include: {
        items: { orderBy: { sortOrder: 'asc' } },
        audits: {
          orderBy: { auditDate: 'desc' },
          take: 10,
        },
      },
    });
    if (!checklist) {
      reply.code(404);
      return { data: null, error: 'Checklist not found' };
    }
    return { data: checklist, error: null };
  });

  server.post('/api/v1/quality/sop-checklists', {
    schema: {
      tags: ['Quality Centre'],
      summary: 'Create SOP checklist',
      description: 'Creates a new SOP/GDP audit checklist template with items.',
      body: {
        type: 'object',
        required: ['title', 'category', 'items'],
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          sopReference: { type: 'string' },
          category: { type: 'string', enum: ['gdp', 'cold_chain', 'warehouse', 'transport', 'general'] },
          frequency: { type: 'string', enum: ['monthly', 'quarterly', 'annual', 'one_off'] },
          nextDueDate: { type: 'string', format: 'date-time' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              required: ['question'],
              properties: {
                sortOrder: { type: 'integer' },
                section: { type: 'string' },
                question: { type: 'string' },
                guidance: { type: 'string' },
                evidenceRequired: { type: 'boolean' },
                isCritical: { type: 'boolean' },
              },
            },
          },
        },
      },
    },
  }, async (req: FastifyRequest, _reply: FastifyReply) => {
    const orgId = await getOrgId();
    const body = req.body as any;

    const result = await commandBus.dispatch({
      type: CREATE_SOP_CHECKLIST,
      orgId,
      actorId: 'system',
      payload: body,
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) {
      return { data: null, error: result.error };
    }
    return { data: result.data, error: null };
  });

  server.put('/api/v1/quality/sop-checklists/:id', {
    schema: {
      tags: ['Quality Centre'],
      summary: 'Update SOP checklist',
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      body: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          sopReference: { type: 'string' },
          category: { type: 'string' },
          frequency: { type: 'string' },
          status: { type: 'string' },
          nextDueDate: { type: 'string', format: 'date-time' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = await getOrgId();
    const { id } = req.params as { id: string };
    const body = req.body as any;

    const existing = await server.prisma.sOPChecklist.findFirst({
      where: { id, orgId },
    });
    if (!existing) {
      reply.code(404);
      return { data: null, error: 'Checklist not found' };
    }

    const updated = await server.prisma.sOPChecklist.update({
      where: { id },
      data: {
        ...body,
        nextDueDate: body.nextDueDate ? new Date(body.nextDueDate) : undefined,
      },
    });

    return { data: updated, error: null };
  });

  // ─── SOP Audits ────────────────────────────────────────────────────────────

  server.get('/api/v1/quality/sop-audits', {
    schema: {
      tags: ['Quality Centre'],
      summary: 'List SOP audits',
      querystring: {
        type: 'object',
        properties: {
          checklistId: { type: 'string' },
          status: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, _reply: FastifyReply) => {
    const { checklistId, status } = req.query as { checklistId?: string; status?: string };
    const orgId = await getOrgId();

    const where: any = { orgId };
    if (checklistId) where.checklistId = checklistId;
    if (status) where.status = status;

    const audits = await server.prisma.sOPAudit.findMany({
      where,
      include: {
        checklist: { select: { title: true, category: true, sopReference: true } },
      },
      orderBy: { auditDate: 'desc' },
    });

    return { data: audits, error: null };
  });

  server.get('/api/v1/quality/sop-audits/:id', {
    schema: {
      tags: ['Quality Centre'],
      summary: 'Get SOP audit detail with responses',
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const audit = await server.prisma.sOPAudit.findUnique({
      where: { id },
      include: {
        checklist: { include: { items: { orderBy: { sortOrder: 'asc' } } } },
        responses: true,
      },
    });
    if (!audit) {
      reply.code(404);
      return { data: null, error: 'Audit not found' };
    }
    return { data: audit, error: null };
  });

  server.post('/api/v1/quality/sop-audits', {
    schema: {
      tags: ['Quality Centre'],
      summary: 'Start a new SOP audit',
      body: {
        type: 'object',
        required: ['checklistId'],
        properties: {
          checklistId: { type: 'string' },
          auditorId: { type: 'string' },
          auditorName: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, _reply: FastifyReply) => {
    const orgId = await getOrgId();
    const body = req.body as any;

    const result = await commandBus.dispatch({
      type: START_SOP_AUDIT,
      orgId,
      actorId: 'system',
      payload: body,
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) {
      return { data: null, error: result.error };
    }
    return { data: result.data, error: null };
  });

  server.put('/api/v1/quality/sop-audits/:id/complete', {
    schema: {
      tags: ['Quality Centre'],
      summary: 'Complete an SOP audit with responses',
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      body: {
        type: 'object',
        required: ['responses'],
        properties: {
          responses: {
            type: 'array',
            items: {
              type: 'object',
              required: ['checklistItemId', 'result'],
              properties: {
                checklistItemId: { type: 'string' },
                result: { type: 'string', enum: ['pass', 'fail', 'na', 'observation'] },
                notes: { type: 'string' },
                evidenceRef: { type: 'string' },
                correctiveAction: { type: 'string' },
              },
            },
          },
          findings: { type: 'string' },
          correctiveActions: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, _reply: FastifyReply) => {
    const orgId = await getOrgId();
    const { id } = req.params as { id: string };
    const body = req.body as any;

    const result = await commandBus.dispatch({
      type: COMPLETE_SOP_AUDIT,
      orgId,
      actorId: 'system',
      payload: { auditId: id, ...body },
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) {
      return { data: null, error: result.error };
    }
    return { data: result.data, error: null };
  });

  // ─── Quality Reports ──────────────────────────────────────────────────────

  server.get('/api/v1/quality/reports/carrier-scorecard', {
    schema: {
      tags: ['Quality Centre'],
      summary: 'Carrier quality scorecard',
      description: 'Returns quality metrics per carrier: issue counts, CAPA rates, resolution times.',
    },
  }, async (_req: FastifyRequest, _reply: FastifyReply) => {
    const orgId = await getOrgId();

    const summaries = await server.prisma.qualityIssueSummary.findMany({
      where: { orgId, dimensionType: 'carrier' },
      orderBy: { totalIssues: 'desc' },
    });

    return { data: summaries, error: null };
  });

  server.get('/api/v1/quality/reports/lane-analysis', {
    schema: {
      tags: ['Quality Centre'],
      summary: 'Lane quality analysis',
      description: 'Returns quality metrics per lane: issue frequency, common categories, problem severity.',
    },
  }, async (_req: FastifyRequest, _reply: FastifyReply) => {
    const orgId = await getOrgId();

    const summaries = await server.prisma.qualityIssueSummary.findMany({
      where: { orgId, dimensionType: 'lane' },
      orderBy: { totalIssues: 'desc' },
    });

    return { data: summaries, error: null };
  });

  server.get('/api/v1/quality/reports/capa-effectiveness', {
    schema: {
      tags: ['Quality Centre'],
      summary: 'CAPA effectiveness report',
      description: 'Returns CAPA reports with follow-up completion rates and effectiveness outcomes.',
    },
  }, async (_req: FastifyRequest, _reply: FastifyReply) => {
    const orgId = await getOrgId();

    const capas = await server.prisma.cAPAReport.findMany({
      where: { orgId },
      include: {
        followUps: {
          orderBy: { dueDate: 'asc' },
        },
        issue: {
          select: { title: true, category: true, priority: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const report = capas.map(capa => {
      const totalFollowUps = capa.followUps.length;
      const completedFollowUps = capa.followUps.filter(f => f.status === 'completed').length;
      const overdueFollowUps = capa.followUps.filter(f =>
        f.status === 'pending' && f.dueDate < new Date()
      ).length;
      const effectiveOutcomes = capa.followUps.filter(f =>
        f.outcome === 'on_track' || f.outcome === 'closed_effective'
      ).length;

      return {
        id: capa.id,
        reportNumber: capa.reportNumber,
        title: capa.title,
        status: capa.status,
        priority: capa.priority,
        rootCauseCategory: capa.rootCauseCategory,
        issue: capa.issue,
        followUpStats: {
          total: totalFollowUps,
          completed: completedFollowUps,
          overdue: overdueFollowUps,
          effective: effectiveOutcomes,
          completionRate: totalFollowUps > 0 ? Math.round((completedFollowUps / totalFollowUps) * 100) : null,
        },
        createdAt: capa.createdAt,
      };
    });

    return { data: report, error: null };
  });

  // ─── SOP Audit Evidence Upload ─────────────────────────────────────────────

  const storageProvider = container.resolve<IBinaryStorageProvider>(TOKENS.IBinaryStorageProvider);
  const attachmentRepo = container.resolve<IAttachmentRepository>(TOKENS.IAttachmentRepository);

  server.post('/api/v1/quality/sop-audits/:auditId/evidence', {
    schema: {
      tags: ['Quality Centre'],
      summary: 'Upload evidence for an SOP audit item',
      description: 'Uploads a file as evidence for a specific checklist item in an audit. Returns the attachment with storageKey for use in audit completion.',
      params: {
        type: 'object',
        required: ['auditId'],
        properties: { auditId: { type: 'string' } },
      },
      consumes: ['multipart/form-data'],
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { auditId } = req.params as { auditId: string };
    const orgId = await getOrgId();

    // Verify audit exists and belongs to org
    const audit = await server.prisma.sOPAudit.findFirst({
      where: { id: auditId, orgId },
    });
    if (!audit) {
      reply.code(404);
      return { data: null, error: 'Audit not found' };
    }

    const data = await req.file();
    if (!data) {
      reply.code(400);
      return { data: null, error: 'No file uploaded. Send multipart form with field "file".' };
    }

    const checklistItemId = (data.fields.checklistItemId as any)?.value as string | undefined;
    const description = (data.fields.description as any)?.value as string | undefined;

    const fileBuffer = await data.toBuffer();
    const maxSize = 50 * 1024 * 1024;
    if (fileBuffer.length > maxSize) {
      reply.code(400);
      return { data: null, error: 'File too large. Maximum size is 50 MB.' };
    }

    const fileName = data.filename;
    const mimeType = data.mimetype || 'application/octet-stream';
    const storageKey = `files/${randomUUID()}`;

    const retentionExpiresAt = new Date();
    retentionExpiresAt.setFullYear(retentionExpiresAt.getFullYear() + 10);

    await storageProvider.store(storageKey, fileBuffer, {
      'content-type': mimeType,
      'original-filename': fileName,
    });

    const storageBackend = process.env.S3_ENDPOINT && process.env.S3_BUCKET ? 's3' : 'database';

    const attachment = await attachmentRepo.create({
      entityType: 'sop_audit',
      entityId: auditId,
      fileName,
      mimeType,
      fileSize: fileBuffer.length,
      storageKey,
      storageBackend,
      uploadedBy: 'system',
      description: description || (checklistItemId ? `Evidence for checklist item ${checklistItemId}` : 'Audit evidence'),
      retentionExpiresAt,
    });

    return {
      data: {
        id: attachment.id,
        storageKey,
        fileName,
        mimeType,
        fileSize: fileBuffer.length,
        checklistItemId: checklistItemId || null,
      },
      error: null,
    };
  });

  server.get('/api/v1/quality/sop-audits/:auditId/evidence', {
    schema: {
      tags: ['Quality Centre'],
      summary: 'List evidence files for an SOP audit',
      params: {
        type: 'object',
        required: ['auditId'],
        properties: { auditId: { type: 'string' } },
      },
    },
  }, async (req: FastifyRequest, _reply: FastifyReply) => {
    const { auditId } = req.params as { auditId: string };
    const attachments = await attachmentRepo.findByEntity('sop_audit', auditId);
    return { data: attachments, error: null };
  });

  // Update a single audit response (for adding evidence/corrective actions after audit starts)
  server.put('/api/v1/quality/sop-audits/:auditId/responses/:responseId', {
    schema: {
      tags: ['Quality Centre'],
      summary: 'Update an audit response',
      description: 'Updates evidence reference or corrective action for a specific audit response.',
      params: {
        type: 'object',
        required: ['auditId', 'responseId'],
        properties: {
          auditId: { type: 'string' },
          responseId: { type: 'string' },
        },
      },
      body: {
        type: 'object',
        properties: {
          evidenceRef: { type: 'string', description: 'Storage key of uploaded evidence file' },
          correctiveAction: { type: 'string', description: 'Corrective action required for this item' },
          notes: { type: 'string' },
          result: { type: 'string', enum: ['pass', 'fail', 'na', 'observation'] },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { responseId } = req.params as { auditId: string; responseId: string };
    const body = req.body as any;

    const existing = await server.prisma.sOPAuditResponse.findUnique({
      where: { id: responseId },
    });
    if (!existing) {
      reply.code(404);
      return { data: null, error: 'Audit response not found' };
    }

    const updated = await server.prisma.sOPAuditResponse.update({
      where: { id: responseId },
      data: {
        evidenceRef: body.evidenceRef !== undefined ? body.evidenceRef : undefined,
        correctiveAction: body.correctiveAction !== undefined ? body.correctiveAction : undefined,
        notes: body.notes !== undefined ? body.notes : undefined,
        result: body.result !== undefined ? body.result : undefined,
      },
    });

    return { data: updated, error: null };
  });
}
