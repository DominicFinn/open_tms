/**
 * Triage Centre API routes.
 *
 * The working surfaces of the Triage app: the board/search list, the signal
 * dashboard, the "what should I pick up now" queue, the QA spot-check sample,
 * batch actions, the per-issue context rollup, and the reports aggregation.
 *
 * Routes stay thin — all data access is in TriageRepository. Writes go through
 * the command bus, so a batch action is a fan-out of UPDATE_ISSUE and every
 * issue still emits its own domain events and updates the projection.
 */

import { randomUUID } from 'crypto';

import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { container, TOKENS } from '../di/index.js';
import { ICommandBus } from '../commands/CommandBus.js';
import { UPDATE_ISSUE } from '../commands/issues/UpdateIssueCommand.js';
import { registerOrgScope } from '../auth/orgScopeMiddleware.js';
import { guardWrites } from '../auth/guardWrites.js';
import {
  ITriageRepository,
  TriageFilters,
  TriageSortField,
} from '../repositories/TriageRepository.js';
import { allIssueTypes, getIssueType, NOISE_THRESHOLD } from '../services/issues/issueTypeRegistry.js';

const MAX_PER_PAGE = 200;
const DEFAULT_PER_PAGE = 50;
const SORTABLE: TriageSortField[] = [
  'createdAt', 'updatedAt', 'priority', 'signalScore', 'slaDeadline', 'lastActivityAt',
];

/** Parse a comma-separated query param into a trimmed, non-empty array. */
function csv(v?: string): string[] | undefined {
  if (!v) return undefined;
  const parts = v.split(',').map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts : undefined;
}

/** Resolve a `dateRange` shorthand (24h / 7d / 30d / 90d) to a cutoff date. */
function rangeStart(range: string, fallbackDays = 7): Date {
  const m = /^(\d+)([hd])$/.exec(range ?? '');
  if (!m) return new Date(Date.now() - fallbackDays * 86_400_000);
  const n = parseInt(m[1], 10);
  return new Date(Date.now() - (m[2] === 'h' ? n * 3_600_000 : n * 86_400_000));
}

function tri(v?: string): boolean | undefined {
  if (v === 'true') return true;
  if (v === 'false') return false;
  return undefined;
}

/** Build the shared filter object from query params. */
function filtersFrom(orgId: string, q: Record<string, string>): TriageFilters {
  return {
    orgId,
    status: csv(q.status),
    priority: csv(q.priority),
    category: csv(q.category),
    issueType: csv(q.issueType),
    sourceEntityType: q.sourceEntityType,
    sourceEntityId: q.sourceEntityId,
    assigneeId: q.assigneeId,
    signalScoreMin: q.signalScoreMin ? parseInt(q.signalScoreMin, 10) || undefined : undefined,
    showNoise: q.showNoise === 'true',
    slaBreach: tri(q.slaBreach),
    since: q.dateRange ? rangeStart(q.dateRange) : undefined,
    query: q.query,
  };
}

/** Standard paginated envelope. */
function paged<T>(items: T[], page: number, perPage: number, total: number) {
  return { data: items, meta: { page, perPage, total }, error: null };
}

export const triageRoutes: FastifyPluginAsync = async (server) => {
  await registerOrgScope(server);
  server.addHook('preHandler', guardWrites('issues'));

  const triageRepo = container.resolve<ITriageRepository>(TOKENS.ITriageRepository);
  const commandBus = container.resolve<ICommandBus>(TOKENS.ICommandBus);

  /* ── Board / search list ────────────────────────────────────────────── */

  server.get('/api/v1/triage/issues', {
    schema: {
      tags: ['Triage'],
      summary: 'Filtered, sorted, paginated issue list backing the board, search and saved boards',
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Comma-separated: open,in_progress,resolved,closed' },
          priority: { type: 'string', description: 'Comma-separated: low,medium,high,critical' },
          category: { type: 'string', description: 'Comma-separated' },
          issueType: { type: 'string', description: 'Comma-separated Issue Type registry keys' },
          sourceEntityType: { type: 'string', enum: ['shipment', 'order', 'carrier'] },
          sourceEntityId: { type: 'string' },
          assigneeId: { type: 'string' },
          signalScoreMin: { type: 'integer', minimum: 0, maximum: 100 },
          showNoise: { type: 'string', enum: ['true', 'false'], description: 'Include suppressed issues' },
          slaBreach: { type: 'string', enum: ['true', 'false'] },
          dateRange: { type: 'string', description: '24h, 7d, 30d, 90d' },
          query: { type: 'string', description: 'Text search on title and description' },
          sortBy: { type: 'string', enum: SORTABLE as unknown as string[], default: 'createdAt' },
          sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
          page: { type: 'integer', minimum: 1, default: 1 },
          perPage: { type: 'integer', minimum: 1, maximum: MAX_PER_PAGE, default: DEFAULT_PER_PAGE },
        },
      },
    },
  }, async (req: FastifyRequest) => {
    const orgId = req.orgId!;
    const q = req.query as Record<string, string>;

    const page = Math.max(1, parseInt(q.page ?? '1', 10) || 1);
    const perPage = Math.min(
      parseInt(q.perPage ?? String(DEFAULT_PER_PAGE), 10) || DEFAULT_PER_PAGE,
      MAX_PER_PAGE,
    );
    const sortBy = (SORTABLE as string[]).includes(q.sortBy) ? (q.sortBy as TriageSortField) : 'createdAt';

    const { items, total } = await triageRepo.findIssues(filtersFrom(orgId, q), {
      sortBy,
      sortOrder: q.sortOrder === 'asc' ? 'asc' : 'desc',
      limit: perPage,
      offset: (page - 1) * perPage,
    });

    return paged(items, page, perPage, total);
  });

  /* ── Signal dashboard ───────────────────────────────────────────────── */

  server.get('/api/v1/triage/signal', {
    schema: {
      tags: ['Triage'],
      summary: 'Signal dashboard: volume, noise ratio, SLA health, recurring offenders',
      querystring: {
        type: 'object',
        properties: { dateRange: { type: 'string', description: '24h, 7d, 30d, 90d. Default 7d.' } },
      },
    },
  }, async (req: FastifyRequest) => {
    const q = req.query as Record<string, string>;
    const summary = await triageRepo.signalSummary(req.orgId!, rangeStart(q.dateRange));

    // Registry keys get their display names at the edge, so the repository
    // stays free of presentation concerns.
    return {
      data: {
        ...summary,
        byType: summary.byType.map((t) => ({
          ...t, name: getIssueType(t.issueType)?.name ?? t.issueType,
        })),
        recurring: summary.recurring.map((r) => ({
          ...r, name: r.issueType ? getIssueType(r.issueType)?.name ?? r.issueType : null,
        })),
      },
      error: null,
    };
  });

  /* ── Actionable queue ───────────────────────────────────────────────── */

  server.get('/api/v1/triage/actionable', {
    schema: {
      tags: ['Triage'],
      summary: 'Highest-value open issues to work next (noise and snoozed excluded)',
      querystring: {
        type: 'object',
        properties: {
          assigneeId: { type: 'string' },
          perPage: { type: 'integer', minimum: 1, maximum: MAX_PER_PAGE, default: 25 },
        },
      },
    },
  }, async (req: FastifyRequest) => {
    const q = req.query as Record<string, string>;
    const perPage = Math.min(parseInt(q.perPage ?? '25', 10) || 25, MAX_PER_PAGE);
    const items = await triageRepo.actionable(req.orgId!, perPage, q.assigneeId);
    return paged(items, 1, perPage, items.length);
  });

  /* ── Spot check ─────────────────────────────────────────────────────── */

  server.get('/api/v1/triage/spot-check', {
    schema: {
      tags: ['Triage'],
      summary: 'QA sample of recently settled issues, for reviewing triage quality',
      querystring: {
        type: 'object',
        properties: {
          dateRange: { type: 'string', description: '24h, 7d, 30d. Default 7d.' },
          sampleSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          includeNoise: { type: 'string', enum: ['true', 'false'] },
        },
      },
    },
  }, async (req: FastifyRequest) => {
    const q = req.query as Record<string, string>;
    const sampleSize = Math.min(parseInt(q.sampleSize ?? '20', 10) || 20, 100);
    const result = await triageRepo.spotCheck(
      req.orgId!, rangeStart(q.dateRange), sampleSize, q.includeNoise === 'true',
    );
    return { data: result, error: null };
  });

  /* ── Reports ────────────────────────────────────────────────────────── */

  server.get('/api/v1/triage/reports', {
    schema: {
      tags: ['Triage'],
      summary: 'Triage performance: volume trend, MTTR, breach rate by type, assignee and priority',
      querystring: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'ISO date, inclusive. Default 30 days ago.' },
          to: { type: 'string', description: 'ISO date, exclusive. Default now.' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const q = req.query as Record<string, string>;
    const from = q.from ? new Date(q.from) : new Date(Date.now() - 30 * 86_400_000);
    const to = q.to ? new Date(q.to) : new Date();

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      reply.code(400);
      return { data: null, error: 'from and to must be valid ISO dates' };
    }
    if (from >= to) {
      reply.code(422);
      return { data: null, error: 'from must be earlier than to' };
    }

    const report = await triageRepo.report(req.orgId!, from, to);
    return {
      data: {
        from: from.toISOString(),
        to: to.toISOString(),
        ...report,
        byType: report.byType.map((t) => ({
          ...t, name: getIssueType(t.issueType)?.name ?? t.issueType,
        })),
      },
      error: null,
    };
  });

  /* ── Issue context rollup ───────────────────────────────────────────── */

  server.get<{ Params: { id: string } }>('/api/v1/triage/issues/:id/context', {
    schema: {
      tags: ['Triage'],
      summary: 'Context for the triage detail pane: source entity, contributing signals, siblings',
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
  }, async (req, reply) => {
    const ctx = await triageRepo.context(req.params.id, req.orgId!);
    if (!ctx) {
      // 404 rather than 403 for a cross-tenant id, so existence stays opaque.
      reply.code(404);
      return { data: null, error: 'Issue not found' };
    }

    const type = ctx.issue.issueType ? getIssueType(ctx.issue.issueType) : undefined;
    return {
      data: {
        ...ctx,
        issueTypeDef: type
          ? {
            key: type.key,
            name: type.name,
            latched: type.latched,
            baseConfidence: type.baseConfidence,
            slaMinutes: type.slaMinutes ?? null,
          }
          : null,
      },
      error: null,
    };
  });

  /* ── Issue type catalogue (drives filter dropdowns) ─────────────────── */

  server.get('/api/v1/triage/issue-types', {
    schema: { tags: ['Triage'], summary: 'The Issue Type registry, for filter dropdowns' },
  }, async () => ({
    data: allIssueTypes().map((t) => ({
      key: t.key,
      name: t.name,
      category: t.category,
      defaultPriority: t.defaultPriority,
      latched: t.latched,
      baseConfidence: t.baseConfidence,
      slaMinutes: t.slaMinutes ?? null,
    })),
    error: null,
  }));

  /* ── Batch actions ──────────────────────────────────────────────────── */

  /**
   * Fan a partial update across many issues via the command bus, one dispatch
   * each so every issue emits its own events and the projection stays correct.
   * Reports per-id outcomes rather than failing the whole batch: one bad id
   * should not silently discard the other 49 updates.
   */
  async function fanOut(
    ids: string[],
    orgId: string,
    actorId: string,
    data: Record<string, unknown>,
  ) {
    const allowed = await triageRepo.scopeIds(ids, orgId);

    const results = await Promise.all(ids.map(async (id) => {
      if (!allowed.has(id)) return { id, ok: false, error: 'Not found' };
      const res = await commandBus.dispatch({
        type: UPDATE_ISSUE,
        orgId,
        actorId,
        payload: { id, data },
        metadata: { correlationId: randomUUID(), source: 'user' },
      });
      return { id, ok: res.success, error: res.success ? null : res.error };
    }));

    return {
      requested: ids.length,
      updated: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok),
    };
  }

  const idsProp = {
    ids: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 200 },
  };

  server.post('/api/v1/triage/batch/transition', {
    schema: {
      tags: ['Triage'],
      summary: 'Move many issues to a new status',
      body: {
        type: 'object',
        required: ['ids', 'status'],
        properties: {
          ...idsProp,
          status: { type: 'string', enum: ['open', 'in_progress', 'resolved', 'closed'] },
          resolution: { type: 'string', maxLength: 2000 },
        },
      },
    },
  }, async (req: FastifyRequest) => {
    const body = req.body as { ids: string[]; status: string; resolution?: string };
    const result = await fanOut(body.ids, req.orgId!, (req as any).user?.id ?? 'system', {
      status: body.status,
      ...(body.resolution ? { resolution: body.resolution } : {}),
    });
    return { data: result, error: null };
  });

  server.post('/api/v1/triage/batch/assign', {
    schema: {
      tags: ['Triage'],
      summary: 'Assign many issues to one person (omit assigneeId to unassign)',
      body: {
        type: 'object',
        required: ['ids'],
        properties: {
          ...idsProp,
          assigneeId: { type: 'string' },
          assigneeName: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest) => {
    const body = req.body as { ids: string[]; assigneeId?: string; assigneeName?: string };
    const result = await fanOut(body.ids, req.orgId!, (req as any).user?.id ?? 'system', {
      assigneeId: body.assigneeId ?? null,
      assigneeName: body.assigneeName ?? null,
    });
    return { data: result, error: null };
  });

  server.post('/api/v1/triage/batch/dismiss-noise', {
    schema: {
      tags: ['Triage'],
      summary: 'Mark many issues as noise and close them',
      body: {
        type: 'object',
        required: ['ids'],
        properties: { ...idsProp, reason: { type: 'string', maxLength: 2000 } },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = req.orgId!;
    const body = req.body as { ids: string[]; reason?: string };

    // Latched issues are safety/compliance events that already happened. The
    // engine never auto-suppresses them, and they cannot be manually dismissed
    // as noise either — they must be resolved with a reason.
    const latched = await triageRepo.findLatched(body.ids, orgId);
    if (latched.length) {
      reply.code(409);
      return {
        data: null,
        error: `Cannot dismiss latched safety issues as noise: ${latched.map((l) => l.title).join('; ')}. Resolve them with a reason instead.`,
      };
    }

    const reason = body.reason?.trim()
      || `Manually dismissed as noise (below the ${NOISE_THRESHOLD}/100 confidence bar).`;
    const result = await fanOut(body.ids, orgId, (req as any).user?.id ?? 'system', {
      isNoise: true,
      noiseReason: reason,
      status: 'closed',
      resolution: reason,
    });
    return { data: result, error: null };
  });
};
