/**
 * TriageRepository — all data access behind the Triage Centre surfaces.
 *
 * Reads come off IssueReadModel (these are list/aggregate surfaces and the read
 * model already carries the triage columns). Writes are NOT here: batch actions
 * go through the command bus so each issue still emits its own domain events.
 */

import { PrismaClient, Prisma, Issue, IssueSignal } from '@prisma/client';

// ─── DTOs ───────────────────────────────────────────────────────────────────

/**
 * Filter shape shared by the board, the search page and saved boards. A saved
 * KanbanView stores exactly this object in its `filters` column, so a board and
 * an ad-hoc query resolve through one code path.
 */
export interface TriageFilters {
  orgId: string;
  status?: string[];
  priority?: string[];
  category?: string[];
  issueType?: string[];
  sourceEntityType?: string;
  sourceEntityId?: string;
  assigneeId?: string;
  signalScoreMin?: number;
  /** Suppressed issues are excluded unless this is true. */
  showNoise?: boolean;
  slaBreach?: boolean;
  /** Cutoff for createdAt, already resolved to a date. */
  since?: Date;
  query?: string;
}

export type TriageSortField =
  | 'createdAt' | 'updatedAt' | 'priority' | 'signalScore' | 'slaDeadline' | 'lastActivityAt';

export interface TriagePage {
  sortBy: TriageSortField;
  sortOrder: 'asc' | 'desc';
  limit: number;
  offset: number;
}

/**
 * The projection of an issue the triage UI actually renders. Deliberately
 * enumerated rather than returning the read-model row, so adding a column to
 * IssueReadModel is not an accidental API change.
 */
export interface TriageIssueDTO {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  category: string;
  issueType: string | null;
  latched: boolean;
  sourceEntityType: string | null;
  sourceEntityId: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  labels: unknown;
  commentCount: number;
  signalScore: number;
  signalCount: number;
  isNoise: boolean;
  noiseReason: string | null;
  slaDeadline: string | null;
  slaBreach: boolean;
  timeToFirstResponseMins: number | null;
  timeToResolutionMins: number | null;
  lastActivityAt: string | null;
  snoozedUntil: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TriageSignalSummary {
  total: number;
  signalCount: number;
  noiseCount: number;
  noiseRatio: number;
  avgSignalScore: number;
  avgTimeToResolutionMins: number | null;
  avgTimeToFirstResponseMins: number | null;
  slaBreaches: number;
  slaAtRisk: number;
  byCategory: { category: string; count: number }[];
  byStatus: Record<string, number>;
  byType: { issueType: string; count: number }[];
  recurring: { sourceEntityId: string | null; issueType: string | null; count: number }[];
}

export interface TriageReport {
  total: number;
  slaBreaches: number;
  breachRate: number;
  avgTimeToResolutionMins: number | null;
  avgTimeToFirstResponseMins: number | null;
  daily: { day: string; count: number }[];
  byType: {
    issueType: string; count: number;
    avgTimeToResolutionMins: number | null; avgSignalScore: number;
  }[];
  byAssignee: { assigneeName: string; count: number; avgTimeToResolutionMins: number | null }[];
  byPriority: { priority: string; count: number }[];
}

export interface TriageSpotCheck {
  total: number;
  sampled: number;
  breachRate: number;
  avgTimeToResolutionMins: number | null;
  items: TriageIssueDTO[];
}

export interface TriageContext {
  issue: Issue;
  signals: IssueSignal[];
  siblingIssues: TriageIssueDTO[];
  sourceEntity: unknown;
}

// ─── Interface ──────────────────────────────────────────────────────────────

export interface ITriageRepository {
  findIssues(f: TriageFilters, p: TriagePage): Promise<{ items: TriageIssueDTO[]; total: number }>;
  signalSummary(orgId: string, since: Date): Promise<TriageSignalSummary>;
  actionable(orgId: string, limit: number, assigneeId?: string):
    Promise<(TriageIssueDTO & { minutesToDeadline: number | null })[]>;
  spotCheck(orgId: string, since: Date, sampleSize: number, includeNoise: boolean): Promise<TriageSpotCheck>;
  report(orgId: string, from: Date, to: Date): Promise<TriageReport>;
  context(id: string, orgId: string): Promise<TriageContext | null>;
  /** Ids from `ids` that exist within `orgId`. Used to scope batch actions. */
  scopeIds(ids: string[], orgId: string): Promise<Set<string>>;
  findLatched(ids: string[], orgId: string): Promise<{ id: string; title: string }[]>;
}

const OPEN_STATUSES = ['open', 'in_progress'];

// ─── Implementation ─────────────────────────────────────────────────────────

export class TriageRepository implements ITriageRepository {
  constructor(private prisma: PrismaClient) {}

  private where(f: TriageFilters): Prisma.IssueReadModelWhereInput {
    const w: Prisma.IssueReadModelWhereInput = { orgId: f.orgId };
    if (f.status?.length) w.status = { in: f.status };
    if (f.priority?.length) w.priority = { in: f.priority };
    if (f.category?.length) w.category = { in: f.category };
    if (f.issueType?.length) w.issueType = { in: f.issueType };
    if (f.sourceEntityType) w.sourceEntityType = f.sourceEntityType;
    if (f.sourceEntityId) w.sourceEntityId = f.sourceEntityId;
    if (f.assigneeId) w.assigneeId = f.assigneeId;
    if (f.signalScoreMin != null) w.signalScore = { gte: f.signalScoreMin };
    if (!f.showNoise) w.isNoise = false;
    if (f.slaBreach != null) w.slaBreach = f.slaBreach;
    if (f.since) w.createdAt = { gte: f.since };
    if (f.query) {
      w.OR = [
        { title: { contains: f.query, mode: 'insensitive' } },
        { description: { contains: f.query, mode: 'insensitive' } },
      ];
    }
    return w;
  }

  /** Map a read-model row onto the enumerated DTO the API exposes. */
  private toDTO(r: {
    id: string; title: string; description: string | null; status: string; priority: string;
    category: string; issueType: string | null; latched: boolean;
    sourceEntityType: string | null; sourceEntityId: string | null;
    assigneeId: string | null; assigneeName: string | null; labels: unknown; commentCount: number;
    signalScore: number; signalCount: number; isNoise: boolean; noiseReason: string | null;
    slaDeadline: Date | null; slaBreach: boolean;
    timeToFirstResponseMins: number | null; timeToResolutionMins: number | null;
    lastActivityAt: Date | null; snoozedUntil: Date | null;
    resolvedAt: Date | null; closedAt: Date | null; createdAt: Date; updatedAt: Date;
  }): TriageIssueDTO {
    return {
      id: r.id,
      title: r.title,
      description: r.description,
      status: r.status,
      priority: r.priority,
      category: r.category,
      issueType: r.issueType,
      latched: r.latched,
      sourceEntityType: r.sourceEntityType,
      sourceEntityId: r.sourceEntityId,
      assigneeId: r.assigneeId,
      assigneeName: r.assigneeName,
      labels: r.labels ?? [],
      commentCount: r.commentCount,
      signalScore: r.signalScore,
      signalCount: r.signalCount,
      isNoise: r.isNoise,
      noiseReason: r.noiseReason,
      slaDeadline: r.slaDeadline?.toISOString() ?? null,
      slaBreach: r.slaBreach,
      timeToFirstResponseMins: r.timeToFirstResponseMins,
      timeToResolutionMins: r.timeToResolutionMins,
      lastActivityAt: r.lastActivityAt?.toISOString() ?? null,
      snoozedUntil: r.snoozedUntil?.toISOString() ?? null,
      resolvedAt: r.resolvedAt?.toISOString() ?? null,
      closedAt: r.closedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }

  async findIssues(f: TriageFilters, p: TriagePage) {
    const where = this.where(f);
    const [rows, total] = await Promise.all([
      this.prisma.issueReadModel.findMany({
        where,
        orderBy: { [p.sortBy]: p.sortOrder },
        take: p.limit,
        skip: p.offset,
      }),
      this.prisma.issueReadModel.count({ where }),
    ]);
    return { items: rows.map((r) => this.toDTO(r)), total };
  }

  async signalSummary(orgId: string, since: Date): Promise<TriageSignalSummary> {
    const scope = { orgId, createdAt: { gte: since } };

    const [byCategory, byStatus, byType, agg, noiseCount, breaches, atRisk, recurring] =
      await Promise.all([
        this.prisma.issueReadModel.groupBy({ by: ['category'], where: scope, _count: { _all: true } }),
        this.prisma.issueReadModel.groupBy({ by: ['status'], where: scope, _count: { _all: true } }),
        this.prisma.issueReadModel.groupBy({ by: ['issueType'], where: scope, _count: { _all: true } }),
        this.prisma.issueReadModel.aggregate({
          where: scope,
          _avg: { signalScore: true, timeToResolutionMins: true, timeToFirstResponseMins: true },
          _count: { _all: true },
        }),
        this.prisma.issueReadModel.count({ where: { ...scope, isNoise: true } }),
        this.prisma.issueReadModel.count({ where: { ...scope, slaBreach: true } }),
        // Open and already past deadline, but not yet stamped as breached —
        // the flag is only written when an issue settles.
        this.prisma.issueReadModel.count({
          where: { orgId, status: { in: OPEN_STATUSES }, slaBreach: false, slaDeadline: { lt: new Date() } },
        }),
        // Repeat offenders: the same entity raising the same type again and
        // again is the signal that something systemic is wrong.
        this.prisma.issueReadModel.groupBy({
          by: ['sourceEntityId', 'issueType'],
          where: { ...scope, sourceEntityId: { not: null } },
          _count: { _all: true },
          having: { sourceEntityId: { _count: { gt: 1 } } },
          orderBy: { _count: { sourceEntityId: 'desc' } },
          take: 20,
        }),
      ]);

    const total = agg._count._all;
    const round = (n: number | null) => (n != null ? Math.round(n) : null);

    return {
      total,
      signalCount: total - noiseCount,
      noiseCount,
      noiseRatio: total ? Math.round((noiseCount / total) * 100) : 0,
      avgSignalScore: Math.round(agg._avg.signalScore ?? 0),
      avgTimeToResolutionMins: round(agg._avg.timeToResolutionMins),
      avgTimeToFirstResponseMins: round(agg._avg.timeToFirstResponseMins),
      slaBreaches: breaches,
      slaAtRisk: atRisk,
      byCategory: byCategory.map((r) => ({ category: r.category, count: r._count._all })),
      byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r._count._all])),
      byType: byType.filter((r) => r.issueType).map((r) => ({
        issueType: r.issueType as string, count: r._count._all,
      })),
      recurring: recurring.map((r) => ({
        sourceEntityId: r.sourceEntityId, issueType: r.issueType, count: r._count._all,
      })),
    };
  }

  async actionable(orgId: string, limit: number, assigneeId?: string) {
    const rows = await this.prisma.issueReadModel.findMany({
      where: {
        orgId,
        status: { in: OPEN_STATUSES },
        isNoise: false,
        // A snoozed issue is deliberately not actionable until it wakes.
        OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: new Date() } }],
        ...(assigneeId ? { assigneeId } : {}),
      },
      // Breaching first, then most urgent deadline, then strongest signal.
      orderBy: [
        { slaBreach: 'desc' },
        { slaDeadline: 'asc' },
        { signalScore: 'desc' },
        { createdAt: 'asc' },
      ],
      take: limit,
    });

    const now = Date.now();
    return rows.map((r) => ({
      ...this.toDTO(r),
      minutesToDeadline: r.slaDeadline ? Math.round((r.slaDeadline.getTime() - now) / 60_000) : null,
    }));
  }

  async spotCheck(orgId: string, since: Date, sampleSize: number, includeNoise: boolean) {
    const where: Prisma.IssueReadModelWhereInput = {
      orgId,
      status: { in: ['resolved', 'closed'] },
      updatedAt: { gte: since },
      ...(includeNoise ? {} : { isNoise: false }),
    };

    const total = await this.prisma.issueReadModel.count({ where });

    // Deterministic spread rather than a random sample: take every Nth row so
    // the sample covers the whole window instead of clustering at one end.
    const stride = total > sampleSize ? Math.floor(total / sampleSize) : 1;
    const pool = await this.prisma.issueReadModel.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: Math.min(total, sampleSize * stride),
    });
    const sample = stride > 1
      ? pool.filter((_, i) => i % stride === 0).slice(0, sampleSize)
      : pool;

    const breached = sample.filter((i) => i.slaBreach).length;
    const settled = sample.filter((i) => i.timeToResolutionMins != null);

    return {
      total,
      sampled: sample.length,
      breachRate: sample.length ? Math.round((breached / sample.length) * 100) : 0,
      avgTimeToResolutionMins: settled.length
        ? Math.round(settled.reduce((a, i) => a + (i.timeToResolutionMins ?? 0), 0) / settled.length)
        : null,
      items: sample.map((r) => this.toDTO(r)),
    };
  }

  async report(orgId: string, from: Date, to: Date): Promise<TriageReport> {
    const scope: Prisma.IssueReadModelWhereInput = { orgId, createdAt: { gte: from, lt: to } };

    const [byType, byAssignee, byPriority, totals, breaches, daily] = await Promise.all([
      this.prisma.issueReadModel.groupBy({
        by: ['issueType'], where: scope,
        _count: { _all: true }, _avg: { timeToResolutionMins: true, signalScore: true },
      }),
      this.prisma.issueReadModel.groupBy({
        by: ['assigneeName'], where: { ...scope, assigneeName: { not: null } },
        _count: { _all: true }, _avg: { timeToResolutionMins: true },
      }),
      this.prisma.issueReadModel.groupBy({ by: ['priority'], where: scope, _count: { _all: true } }),
      this.prisma.issueReadModel.aggregate({
        where: scope, _count: { _all: true },
        _avg: { timeToResolutionMins: true, timeToFirstResponseMins: true },
      }),
      this.prisma.issueReadModel.count({ where: { ...scope, slaBreach: true } }),
      // Grouped in SQL so a 90-day window does not pull every row over the wire.
      this.prisma.$queryRaw<{ day: Date; count: bigint }[]>`
        SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::bigint AS count
        FROM "IssueReadModel"
        WHERE "orgId" = ${orgId} AND "createdAt" >= ${from} AND "createdAt" < ${to}
        GROUP BY 1 ORDER BY 1 ASC
      `,
    ]);

    const total = totals._count._all;
    const round = (n: number | null) => (n != null ? Math.round(n) : null);

    return {
      total,
      slaBreaches: breaches,
      breachRate: total ? Math.round((breaches / total) * 100) : 0,
      avgTimeToResolutionMins: round(totals._avg.timeToResolutionMins),
      avgTimeToFirstResponseMins: round(totals._avg.timeToFirstResponseMins),
      daily: daily.map((d) => ({ day: d.day.toISOString().slice(0, 10), count: Number(d.count) })),
      byType: byType.filter((r) => r.issueType).map((r) => ({
        issueType: r.issueType as string,
        count: r._count._all,
        avgTimeToResolutionMins: round(r._avg.timeToResolutionMins),
        avgSignalScore: Math.round(r._avg.signalScore ?? 0),
      })),
      byAssignee: byAssignee.map((r) => ({
        assigneeName: r.assigneeName as string,
        count: r._count._all,
        avgTimeToResolutionMins: round(r._avg.timeToResolutionMins),
      })),
      byPriority: byPriority.map((r) => ({ priority: r.priority, count: r._count._all })),
    };
  }

  async context(id: string, orgId: string): Promise<TriageContext | null> {
    // orgId in the where clause, not just the id — a guessed id from another
    // tenant must miss, so the route can 404 and keep existence opaque.
    const issue = await this.prisma.issue.findFirst({ where: { id, orgId } });
    if (!issue) return null;

    const [signals, siblings] = await Promise.all([
      this.prisma.issueSignal.findMany({
        where: { issueId: issue.id }, orderBy: { occurredAt: 'desc' }, take: 100,
      }),
      issue.sourceEntityId
        ? this.prisma.issueReadModel.findMany({
          where: {
            orgId,
            sourceEntityId: issue.sourceEntityId,
            id: { not: issue.id },
            status: { in: OPEN_STATUSES },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        })
        : Promise.resolve([]),
    ]);

    let sourceEntity: unknown = null;
    if (issue.sourceEntityId) {
      if (issue.sourceEntityType === 'shipment') {
        sourceEntity = await this.prisma.shipmentReadModel.findFirst({
          where: { id: issue.sourceEntityId, orgId },
        });
      } else if (issue.sourceEntityType === 'order') {
        sourceEntity = await this.prisma.orderReadModel.findFirst({
          where: { id: issue.sourceEntityId, orgId },
        });
      } else if (issue.sourceEntityType === 'carrier') {
        sourceEntity = await this.prisma.carrier.findFirst({
          where: { id: issue.sourceEntityId, orgId },
          select: { id: true, name: true, scacCode: true, archived: true },
        });
      }
    }

    return { issue, signals, siblingIssues: siblings.map((r) => this.toDTO(r)), sourceEntity };
  }

  async scopeIds(ids: string[], orgId: string): Promise<Set<string>> {
    const rows = await this.prisma.issue.findMany({
      where: { id: { in: ids }, orgId }, select: { id: true },
    });
    return new Set(rows.map((r) => r.id));
  }

  async findLatched(ids: string[], orgId: string) {
    return this.prisma.issue.findMany({
      where: { id: { in: ids }, orgId, latched: true },
      select: { id: true, title: true },
    });
  }
}
