import { PrismaClient, Issue, IssueReadModel } from '@prisma/client';

// ─── DTOs ───────────────────────────────────────────────────────────────────

export interface IssueFilters {
  orgId: string;
  status?: string;           // comma-separated: "open,in_progress"
  priority?: string;         // comma-separated
  category?: string;         // comma-separated
  sourceEntityType?: string; // "shipment", "order", "carrier"
  sourceEntityId?: string;
  assigneeId?: string;
  needsCapa?: boolean;
  snoozed?: boolean;         // true = only snoozed, false = only non-snoozed
  labelIds?: string[];
  search?: string;           // title text search
  limit?: number;
  offset?: number;
}

export interface IssueStats {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
  critical: number;
  needsCapa: number;
  snoozed: number;
}

// ─── Interface ──────────────────────────────────────────────────────────────

export interface IIssueRepository {
  findById(id: string): Promise<Issue | null>;
  findByIdWithRelations(id: string): Promise<any>; // Issue with labels, capaReports
  findByOrg(filters: IssueFilters): Promise<{ items: IssueReadModel[]; total: number }>;
  findByEntityId(sourceEntityType: string, sourceEntityId: string, orgId: string): Promise<IssueReadModel[]>;
  getStats(orgId: string): Promise<IssueStats>;
  getLabels(issueId: string): Promise<Array<{ id: string; name: string; color: string }>>;
  updateLabelsCache(issueId: string): Promise<void>;
}

// ─── Implementation ─────────────────────────────────────────────────────────

export class IssueRepository implements IIssueRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string): Promise<Issue | null> {
    return this.prisma.issue.findUnique({ where: { id } });
  }

  async findByIdWithRelations(id: string): Promise<any> {
    const issue = await this.prisma.issue.findUnique({
      where: { id },
      include: {
        labelAssignments: {
          include: { label: true },
        },
        capaReports: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!issue) return null;

    // Count comments separately
    const commentCount = await this.prisma.comment.count({
      where: { entityType: 'issue', entityId: id },
    });

    return {
      ...issue,
      labels: issue.labelAssignments.map((a) => ({
        id: a.label.id,
        name: a.label.name,
        color: a.label.color,
      })),
      commentCount,
    };
  }

  async findByOrg(filters: IssueFilters): Promise<{ items: IssueReadModel[]; total: number }> {
    const where: any = { orgId: filters.orgId };

    // Split comma-separated filters into arrays and use `in`
    if (filters.status) {
      const statuses = filters.status.split(',').map((s) => s.trim()).filter(Boolean);
      if (statuses.length > 0) where.status = { in: statuses };
    }

    if (filters.priority) {
      const priorities = filters.priority.split(',').map((s) => s.trim()).filter(Boolean);
      if (priorities.length > 0) where.priority = { in: priorities };
    }

    if (filters.category) {
      const categories = filters.category.split(',').map((s) => s.trim()).filter(Boolean);
      if (categories.length > 0) where.category = { in: categories };
    }

    if (filters.sourceEntityType) {
      where.sourceEntityType = filters.sourceEntityType;
    }

    if (filters.sourceEntityId) {
      where.sourceEntityId = filters.sourceEntityId;
    }

    if (filters.assigneeId) {
      where.assigneeId = filters.assigneeId;
    }

    if (filters.needsCapa !== undefined) {
      where.needsCapa = filters.needsCapa;
    }

    // Snoozed filter
    if (filters.snoozed === true) {
      // Only snoozed: snoozedUntil is not null AND in the future
      where.snoozedUntil = { not: null, gt: new Date() };
    } else if (filters.snoozed === false) {
      // Only non-snoozed: snoozedUntil is null OR in the past
      where.OR = [
        { snoozedUntil: null },
        { snoozedUntil: { lte: new Date() } },
      ];
    }

    // Text search on title (case-insensitive)
    if (filters.search) {
      where.title = { contains: filters.search, mode: 'insensitive' };
    }

    // Label filtering: find issueIds that have all specified labels, then filter
    if (filters.labelIds && filters.labelIds.length > 0) {
      const assignments = await this.prisma.issueLabelAssignment.findMany({
        where: { labelId: { in: filters.labelIds } },
        select: { issueId: true },
      });
      const matchingIssueIds = [...new Set(assignments.map((a) => a.issueId))];
      where.id = { in: matchingIssueIds };
    }

    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;

    const [items, total] = await Promise.all([
      this.prisma.issueReadModel.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.issueReadModel.count({ where }),
    ]);

    return { items, total };
  }

  async findByEntityId(
    sourceEntityType: string,
    sourceEntityId: string,
    orgId: string
  ): Promise<IssueReadModel[]> {
    return this.prisma.issueReadModel.findMany({
      where: { orgId, sourceEntityType, sourceEntityId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getStats(orgId: string): Promise<IssueStats> {
    const [total, open, inProgress, resolved, closed, critical, needsCapa, snoozed] =
      await Promise.all([
        this.prisma.issueReadModel.count({ where: { orgId } }),
        this.prisma.issueReadModel.count({ where: { orgId, status: 'open' } }),
        this.prisma.issueReadModel.count({ where: { orgId, status: 'in_progress' } }),
        this.prisma.issueReadModel.count({ where: { orgId, status: 'resolved' } }),
        this.prisma.issueReadModel.count({ where: { orgId, status: 'closed' } }),
        this.prisma.issueReadModel.count({ where: { orgId, priority: 'critical' } }),
        this.prisma.issueReadModel.count({ where: { orgId, needsCapa: true } }),
        this.prisma.issueReadModel.count({
          where: { orgId, snoozedUntil: { not: null, gt: new Date() } },
        }),
      ]);

    return { total, open, inProgress, resolved, closed, critical, needsCapa, snoozed };
  }

  async getLabels(issueId: string): Promise<Array<{ id: string; name: string; color: string }>> {
    const assignments = await this.prisma.issueLabelAssignment.findMany({
      where: { issueId },
      include: { label: true },
    });
    return assignments.map((a) => ({
      id: a.label.id,
      name: a.label.name,
      color: a.label.color,
    }));
  }

  async updateLabelsCache(issueId: string): Promise<void> {
    const labels = await this.getLabels(issueId);
    const labelNames = labels.map((l) => l.name);
    await this.prisma.issueReadModel.update({
      where: { id: issueId },
      data: { labels: labelNames },
    });
  }
}
