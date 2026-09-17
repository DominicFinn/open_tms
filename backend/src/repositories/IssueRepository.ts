import { PrismaClient, Prisma, Issue, IssueReadModel, IssueLabel, KanbanView } from '@prisma/client';

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

export interface IssueActivityEntry {
  type: 'event' | 'comment';
  id: string;
  timestamp: string;
  [key: string]: unknown;
}

export interface KanbanViewInput {
  name?: string;
  description?: string | null;
  filters?: Prisma.InputJsonValue;
  groupBy?: string;
  sortBy?: string;
  isDefault?: boolean;
}

// ─── Interface ──────────────────────────────────────────────────────────────

export interface IIssueRepository {
  findById(id: string, orgId: string): Promise<Issue | null>;
  findByIdWithRelations(id: string, orgId: string): Promise<any>; // Issue with labels, capaReports, SLA
  findByOrg(filters: IssueFilters): Promise<{ items: IssueReadModel[]; total: number }>;
  findByEntityId(sourceEntityType: string, sourceEntityId: string, orgId: string): Promise<IssueReadModel[]>;
  getStats(orgId: string): Promise<IssueStats>;
  getLabels(issueId: string, orgId: string): Promise<Array<{ id: string; name: string; color: string }>>;
  updateLabelsCache(issueId: string, orgId: string): Promise<void>;
  getActivity(issueId: string, orgId: string): Promise<IssueActivityEntry[]>;
  findLabelsByOrg(orgId: string): Promise<IssueLabel[]>;
  findKanbanViews(orgId: string): Promise<KanbanView[]>;
  createKanbanView(orgId: string, createdBy: string | null, input: KanbanViewInput): Promise<KanbanView>;
  updateKanbanView(id: string, orgId: string, input: KanbanViewInput): Promise<KanbanView | null>;
  deleteKanbanView(id: string, orgId: string): Promise<boolean>;
}

// ─── Implementation ─────────────────────────────────────────────────────────

export class IssueRepository implements IIssueRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string, orgId: string): Promise<Issue | null> {
    return this.prisma.issue.findFirst({ where: { id, orgId } });
  }

  async findByIdWithRelations(id: string, orgId: string): Promise<any> {
    const issue = await this.prisma.issue.findFirst({
      where: { id, orgId },
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

    const [commentCount, slaEvaluations] = await Promise.all([
      this.prisma.comment.count({ where: { orgId, entityType: 'issue', entityId: id } }),
      this.prisma.slaEvaluation.findMany({
        where: { orgId, entityType: 'issue', entityId: id },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
    ]);

    return {
      ...issue,
      labels: issue.labelAssignments.map((a) => ({
        id: a.label.id,
        name: a.label.name,
        color: a.label.color,
      })),
      commentCount,
      slaEvaluations,
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

  async getLabels(issueId: string, orgId: string): Promise<Array<{ id: string; name: string; color: string }>> {
    const assignments = await this.prisma.issueLabelAssignment.findMany({
      where: { issueId, issue: { orgId } },
      include: { label: true },
    });
    return assignments.map((a) => ({
      id: a.label.id,
      name: a.label.name,
      color: a.label.color,
    }));
  }

  async updateLabelsCache(issueId: string, orgId: string): Promise<void> {
    const labels = await this.getLabels(issueId, orgId);
    const labelNames = labels.map((l) => l.name);
    await this.prisma.issueReadModel.updateMany({
      where: { id: issueId, orgId },
      data: { labels: labelNames },
    });
  }

  /** Domain events and comments for one issue, merged oldest first. Empty when the issue is not in the org. */
  async getActivity(issueId: string, orgId: string): Promise<IssueActivityEntry[]> {
    const where = { orgId, entityType: 'issue', entityId: issueId };
    const [events, comments] = await Promise.all([
      this.prisma.domainEventLog.findMany({ where, orderBy: { createdAt: 'asc' }, take: 200 }),
      this.prisma.comment.findMany({ where, orderBy: { createdAt: 'asc' }, take: 500 }),
    ]);

    const entries: IssueActivityEntry[] = [
      ...events.map((e) => ({
        type: 'event' as const,
        id: e.id,
        eventType: e.type,
        payload: e.payload,
        actorId: (e.metadata as any)?.actorId || e.actorId || null,
        timestamp: e.timestamp || e.createdAt.toISOString(),
      })),
      ...comments.map((c) => ({
        type: 'comment' as const,
        id: c.id,
        authorId: c.authorId,
        authorName: c.authorName,
        authorType: c.authorType,
        body: c.body,
        visibleToCustomer: c.visibleToCustomer,
        timestamp: c.createdAt.toISOString(),
      })),
    ];
    return entries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  async findLabelsByOrg(orgId: string): Promise<IssueLabel[]> {
    return this.prisma.issueLabel.findMany({ where: { orgId }, orderBy: { name: 'asc' }, take: 500 });
  }

  async findKanbanViews(orgId: string): Promise<KanbanView[]> {
    return this.prisma.kanbanView.findMany({
      where: { orgId },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      take: 500,
    });
  }

  // One default view per org: setting a new default clears the old one in the same transaction.
  async createKanbanView(orgId: string, createdBy: string | null, input: KanbanViewInput): Promise<KanbanView> {
    return this.prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.kanbanView.updateMany({ where: { orgId, isDefault: true }, data: { isDefault: false } });
      }
      return tx.kanbanView.create({
        data: {
          orgId,
          name: input.name ?? '',
          description: input.description,
          filters: input.filters ?? {},
          groupBy: input.groupBy || 'status',
          sortBy: input.sortBy || 'createdAt',
          isDefault: input.isDefault || false,
          createdBy,
        },
      });
    });
  }

  async updateKanbanView(id: string, orgId: string, input: KanbanViewInput): Promise<KanbanView | null> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.kanbanView.findFirst({ where: { id, orgId } });
      if (!existing) return null;
      if (input.isDefault) {
        await tx.kanbanView.updateMany({ where: { orgId, isDefault: true }, data: { isDefault: false } });
      }
      return tx.kanbanView.update({ where: { id, orgId }, data: pickKanbanFields(input) });
    });
  }

  async deleteKanbanView(id: string, orgId: string): Promise<boolean> {
    const { count } = await this.prisma.kanbanView.deleteMany({ where: { id, orgId } });
    return count > 0;
  }
}

// Only these columns are client-editable; anything else in the body (orgId, createdBy) is dropped.
function pickKanbanFields(input: KanbanViewInput): Prisma.KanbanViewUpdateInput {
  const data: Prisma.KanbanViewUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (input.filters !== undefined) data.filters = input.filters;
  if (input.groupBy !== undefined) data.groupBy = input.groupBy;
  if (input.sortBy !== undefined) data.sortBy = input.sortBy;
  if (input.isDefault !== undefined) data.isDefault = input.isDefault;
  return data;
}
