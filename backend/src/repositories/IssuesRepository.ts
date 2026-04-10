import { PrismaClient, Issue, IssueComment, IssueActivity, Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface CreateIssueDTO {
  title: string;
  description?: string;
  orgId: string;
  severity?: string;
  category?: string;
  priority?: number;
  tags?: string[];
  shipmentId?: string;
  orderId?: string;
  carrierId?: string;
  customerId?: string;
  laneId?: string;
  region?: string;
  assigneeId?: string;
  assigneeName?: string;
  source?: string;
  sourceEventId?: string;
  slaDeadline?: Date;
  createdBy?: string;
  signalScore?: number;
  correlatedEvents?: number;
  isNoise?: boolean;
  noiseReason?: string;
}

export interface UpdateIssueDTO {
  title?: string;
  description?: string;
  status?: string;
  severity?: string;
  category?: string;
  priority?: number;
  tags?: string[];
  assigneeId?: string;
  assigneeName?: string;
  laneId?: string;
  region?: string;
  slaDeadline?: Date;
  slaBreach?: boolean;
  signalScore?: number;
  correlatedEvents?: number;
  isNoise?: boolean;
  noiseReason?: string;
  actorName?: string;
}

export interface CreateIssueCommentDTO {
  issueId: string;
  authorId?: string;
  authorName: string;
  body: string;
}

export interface ResolveIssueDTO {
  resolvedBy: string;
  resolutionNotes?: string;
  actorName: string;
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export interface IssueFilter {
  orgId?: string;
  status?: string;
  severity?: string;
  priority?: number;
  assigneeId?: string;
  shipmentId?: string;
  orderId?: string;
  carrierId?: string;
  customerId?: string;
  laneId?: string;
  region?: string;
  category?: string;
  isNoise?: boolean;
  signalScoreMin?: number;
  dateFrom?: Date | string;
  dateTo?: Date | string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface SpotCheckFilter {
  orgId?: string;
  dateFrom?: Date | string;
  dateTo?: Date | string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

// ---------------------------------------------------------------------------
// Aggregation types
// ---------------------------------------------------------------------------

export interface SignalDashboardData {
  byCategory: { category: string; count: number }[];
  bySeverity: { severity: string; count: number }[];
  byPriority: { priority: number; count: number }[];
  slaBreachCount: number;
  noiseCount: number;
  signalCount: number;
  avgTimeToResolution: number | null;
}

// ---------------------------------------------------------------------------
// Composite types
// ---------------------------------------------------------------------------

export type IssueWithComments = Issue & {
  comments: IssueComment[];
  activities: IssueActivity[];
};

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface IIssuesRepository {
  findAll(filter: IssueFilter): Promise<{ issues: Issue[]; total: number }>;
  findById(id: string): Promise<IssueWithComments | null>;
  create(data: CreateIssueDTO): Promise<Issue>;
  update(id: string, data: UpdateIssueDTO): Promise<Issue>;
  transition(id: string, status: string, actorName?: string): Promise<Issue>;
  addComment(data: CreateIssueCommentDTO): Promise<IssueComment>;
  nextIssueNumber(orgId: string): Promise<string>;
  resolve(id: string, data: ResolveIssueDTO): Promise<Issue>;
  findForSignal(orgId?: string): Promise<SignalDashboardData>;
  findForSpotCheck(filter: SpotCheckFilter): Promise<{ issues: Issue[]; total: number }>;
  findContext(id: string): Promise<any>;
  findTimeline(id: string): Promise<IssueActivity[]>;
  batchTransition(ids: string[], status: string, actorName: string): Promise<Issue[]>;
  batchAssign(ids: string[], assigneeId: string, assigneeName: string, actorName: string): Promise<Issue[]>;
  batchDismissNoise(ids: string[], reason: string, actorName: string): Promise<Issue[]>;
  findActionable(): Promise<Issue[]>;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class IssuesRepository implements IIssuesRepository {
  constructor(private prisma: PrismaClient) {}

  // -----------------------------------------------------------------------
  // findAll — enhanced filtering, search, sort, default noise exclusion
  // -----------------------------------------------------------------------
  async findAll(filter: IssueFilter): Promise<{ issues: Issue[]; total: number }> {
    const where: Prisma.IssueWhereInput = {};

    if (filter.orgId) where.orgId = filter.orgId;
    if (filter.status) where.status = filter.status;
    if (filter.severity) where.severity = filter.severity;
    if (filter.priority !== undefined) where.priority = filter.priority;
    if (filter.assigneeId) where.assigneeId = filter.assigneeId;
    if (filter.shipmentId) where.shipmentId = filter.shipmentId;
    if (filter.orderId) where.orderId = filter.orderId;
    if (filter.carrierId) where.carrierId = filter.carrierId;
    if (filter.customerId) where.customerId = filter.customerId;
    if (filter.laneId) where.laneId = filter.laneId;
    if (filter.region) where.region = filter.region;
    if (filter.category) where.category = filter.category;

    // Default: exclude noise unless explicitly requested
    if (filter.isNoise !== undefined) {
      where.isNoise = filter.isNoise;
    } else {
      where.isNoise = false;
    }

    if (filter.signalScoreMin !== undefined) {
      where.signalScore = { gte: filter.signalScoreMin };
    }

    // Date range on createdAt
    if (filter.dateFrom || filter.dateTo) {
      where.createdAt = {};
      if (filter.dateFrom) {
        (where.createdAt as Prisma.DateTimeFilter).gte = new Date(filter.dateFrom);
      }
      if (filter.dateTo) {
        (where.createdAt as Prisma.DateTimeFilter).lte = new Date(filter.dateTo);
      }
    }

    // Full-text search on title, description, issueNumber (case-insensitive)
    if (filter.search) {
      const term = filter.search;
      where.OR = [
        { title: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
        { issueNumber: { contains: term, mode: 'insensitive' } },
      ];
    }

    // Sorting
    const sortBy = filter.sortBy || 'createdAt';
    const sortOrder = filter.sortOrder || 'desc';
    const orderBy: Prisma.IssueOrderByWithRelationInput = { [sortBy]: sortOrder };

    const [issues, total] = await Promise.all([
      this.prisma.issue.findMany({
        where,
        orderBy,
        take: filter.limit || 100,
        skip: filter.offset || 0,
        include: { comments: { orderBy: { createdAt: 'desc' }, take: 1 } },
      }),
      this.prisma.issue.count({ where }),
    ]);

    return { issues, total };
  }

  // -----------------------------------------------------------------------
  // findById — include comments AND activities
  // -----------------------------------------------------------------------
  async findById(id: string): Promise<IssueWithComments | null> {
    return this.prisma.issue.findUnique({
      where: { id },
      include: {
        comments: { orderBy: { createdAt: 'asc' } },
        activities: { orderBy: { createdAt: 'asc' } },
      },
    });
  }

  // -----------------------------------------------------------------------
  // create
  // -----------------------------------------------------------------------
  async create(data: CreateIssueDTO): Promise<Issue> {
    const issueNumber = await this.nextIssueNumber(data.orgId);
    return this.prisma.issue.create({
      data: {
        issueNumber,
        title: data.title,
        description: data.description,
        orgId: data.orgId,
        severity: data.severity || 'medium',
        priority: data.priority ?? 3,
        category: data.category,
        tags: data.tags ?? Prisma.JsonNull,
        shipmentId: data.shipmentId,
        orderId: data.orderId,
        carrierId: data.carrierId,
        customerId: data.customerId,
        laneId: data.laneId,
        region: data.region,
        assigneeId: data.assigneeId,
        assigneeName: data.assigneeName,
        source: data.source || 'manual',
        sourceEventId: data.sourceEventId,
        slaDeadline: data.slaDeadline,
        createdBy: data.createdBy,
        signalScore: data.signalScore ?? 50,
        correlatedEvents: data.correlatedEvents ?? 1,
        isNoise: data.isNoise ?? false,
        noiseReason: data.noiseReason,
        lastActivityAt: new Date(),
        activityCount: 0,
      },
    });
  }

  // -----------------------------------------------------------------------
  // update — with activity tracking
  // -----------------------------------------------------------------------
  async update(id: string, data: UpdateIssueDTO): Promise<Issue> {
    const { actorName, ...updateFields } = data;
    const now = new Date();

    // Prepare tags for Prisma JSON handling
    const prismaData: any = { ...updateFields };
    if (updateFields.tags !== undefined) {
      prismaData.tags = updateFields.tags === null ? Prisma.JsonNull : updateFields.tags;
    }

    const issue = await this.prisma.issue.update({
      where: { id },
      data: {
        ...prismaData,
        lastActivityAt: now,
        activityCount: { increment: 1 },
      },
    });

    // Record activity
    if (actorName) {
      await this.prisma.issueActivity.create({
        data: {
          issueId: id,
          actorName,
          action: 'updated',
          details: { fields: Object.keys(updateFields) },
          createdAt: now,
        },
      });
    }

    return issue;
  }

  // -----------------------------------------------------------------------
  // transition — with activity tracking & timeToFirstResponse
  // -----------------------------------------------------------------------
  async transition(id: string, status: string, actorName?: string): Promise<Issue> {
    const now = new Date();

    // Fetch current issue to check for first response
    const current = await this.prisma.issue.findUnique({
      where: { id },
      select: { status: true, createdAt: true, timeToFirstResponse: true },
    });

    const updateData: Prisma.IssueUpdateInput = {
      status,
      lastActivityAt: now,
      activityCount: { increment: 1 },
    };

    if (status === 'escalated') updateData.escalatedAt = now;
    if (status === 'resolved') updateData.resolvedAt = now;
    if (status === 'closed') updateData.closedAt = now;

    // Calculate timeToFirstResponse on first transition away from 'new'
    if (current && current.status === 'new' && status !== 'new' && current.timeToFirstResponse === null) {
      const minutes = Math.round((now.getTime() - current.createdAt.getTime()) / 60000);
      updateData.timeToFirstResponse = minutes;
    }

    const issue = await this.prisma.issue.update({
      where: { id },
      data: updateData,
    });

    // Record activity
    if (actorName) {
      await this.prisma.issueActivity.create({
        data: {
          issueId: id,
          actorName,
          action: 'status_changed',
          details: { from: current?.status, to: status },
          createdAt: now,
        },
      });
    }

    return issue;
  }

  // -----------------------------------------------------------------------
  // addComment — with activity tracking
  // -----------------------------------------------------------------------
  async addComment(data: CreateIssueCommentDTO): Promise<IssueComment> {
    const now = new Date();

    const comment = await this.prisma.issueComment.create({ data });

    // Update activity counters on the parent issue
    await this.prisma.issue.update({
      where: { id: data.issueId },
      data: {
        lastActivityAt: now,
        activityCount: { increment: 1 },
      },
    });

    // Check for first response (first comment on a 'new' issue)
    const issue = await this.prisma.issue.findUnique({
      where: { id: data.issueId },
      select: { status: true, createdAt: true, timeToFirstResponse: true },
    });
    if (issue && issue.status === 'new' && issue.timeToFirstResponse === null) {
      const minutes = Math.round((now.getTime() - issue.createdAt.getTime()) / 60000);
      await this.prisma.issue.update({
        where: { id: data.issueId },
        data: { timeToFirstResponse: minutes },
      });
    }

    // Record activity
    await this.prisma.issueActivity.create({
      data: {
        issueId: data.issueId,
        actorId: data.authorId,
        actorName: data.authorName,
        action: 'commented',
        details: { bodyPreview: data.body.slice(0, 200) },
        createdAt: now,
      },
    });

    return comment;
  }

  // -----------------------------------------------------------------------
  // resolve
  // -----------------------------------------------------------------------
  async resolve(id: string, data: ResolveIssueDTO): Promise<Issue> {
    const now = new Date();

    const current = await this.prisma.issue.findUnique({
      where: { id },
      select: { createdAt: true },
    });

    const timeToResolution = current
      ? Math.round((now.getTime() - current.createdAt.getTime()) / 60000)
      : null;

    const issue = await this.prisma.issue.update({
      where: { id },
      data: {
        status: 'resolved',
        resolvedAt: now,
        resolvedBy: data.resolvedBy,
        resolutionNotes: data.resolutionNotes,
        timeToResolution,
        lastActivityAt: now,
        activityCount: { increment: 1 },
      },
    });

    await this.prisma.issueActivity.create({
      data: {
        issueId: id,
        actorName: data.actorName,
        action: 'resolved',
        details: {
          resolvedBy: data.resolvedBy,
          resolutionNotes: data.resolutionNotes,
          timeToResolution,
        },
        createdAt: now,
      },
    });

    return issue;
  }

  // -----------------------------------------------------------------------
  // findForSignal — aggregated dashboard data
  // -----------------------------------------------------------------------
  async findForSignal(orgId?: string): Promise<SignalDashboardData> {
    const baseWhere: Prisma.IssueWhereInput = {};
    if (orgId) baseWhere.orgId = orgId;

    const [
      byCategory,
      bySeverity,
      byPriority,
      slaBreachCount,
      noiseCount,
      signalCount,
      avgResolution,
    ] = await Promise.all([
      this.prisma.issue.groupBy({
        by: ['category'],
        where: baseWhere,
        _count: { id: true },
      }),
      this.prisma.issue.groupBy({
        by: ['severity'],
        where: baseWhere,
        _count: { id: true },
      }),
      this.prisma.issue.groupBy({
        by: ['priority'],
        where: baseWhere,
        _count: { id: true },
      }),
      this.prisma.issue.count({
        where: { ...baseWhere, slaBreach: true },
      }),
      this.prisma.issue.count({
        where: { ...baseWhere, isNoise: true },
      }),
      this.prisma.issue.count({
        where: { ...baseWhere, isNoise: false },
      }),
      this.prisma.issue.aggregate({
        where: { ...baseWhere, status: 'resolved', timeToResolution: { not: null } },
        _avg: { timeToResolution: true },
      }),
    ]);

    return {
      byCategory: byCategory.map((r) => ({
        category: r.category || 'uncategorized',
        count: r._count.id,
      })),
      bySeverity: bySeverity.map((r) => ({
        severity: r.severity,
        count: r._count.id,
      })),
      byPriority: byPriority.map((r) => ({
        priority: r.priority,
        count: r._count.id,
      })),
      slaBreachCount,
      noiseCount,
      signalCount,
      avgTimeToResolution: avgResolution._avg.timeToResolution ?? null,
    };
  }

  // -----------------------------------------------------------------------
  // findForSpotCheck — resolved issues with activity
  // -----------------------------------------------------------------------
  async findForSpotCheck(filter: SpotCheckFilter): Promise<{ issues: Issue[]; total: number }> {
    const where: Prisma.IssueWhereInput = {
      status: 'resolved',
      activityCount: { gt: 0 },
    };

    if (filter.orgId) where.orgId = filter.orgId;

    if (filter.dateFrom || filter.dateTo) {
      where.resolvedAt = {};
      if (filter.dateFrom) {
        (where.resolvedAt as Prisma.DateTimeNullableFilter).gte = new Date(filter.dateFrom);
      }
      if (filter.dateTo) {
        (where.resolvedAt as Prisma.DateTimeNullableFilter).lte = new Date(filter.dateTo);
      }
    }

    const sortBy = filter.sortBy || 'resolvedAt';
    const sortOrder = filter.sortOrder || 'desc';
    const orderBy: Prisma.IssueOrderByWithRelationInput = { [sortBy]: sortOrder };

    const [issues, total] = await Promise.all([
      this.prisma.issue.findMany({
        where,
        orderBy,
        take: filter.limit || 100,
        skip: filter.offset || 0,
      }),
      this.prisma.issue.count({ where }),
    ]);

    return { issues, total };
  }

  // -----------------------------------------------------------------------
  // findContext — full related data for a single issue
  // -----------------------------------------------------------------------
  async findContext(id: string): Promise<any> {
    const issue = await this.prisma.issue.findUnique({
      where: { id },
      include: {
        comments: { orderBy: { createdAt: 'asc' } },
        activities: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!issue) return null;

    // Build a rich context object by loading related entities
    const context: any = { issue };

    // Load shipment with events, stops, and sensor readings
    if (issue.shipmentId) {
      const [shipment, sensorReadings] = await Promise.all([
        this.prisma.shipment.findUnique({
          where: { id: issue.shipmentId },
          include: {
            events: { orderBy: { createdAt: 'desc' } },
            stops: { orderBy: { sequenceNumber: 'asc' }, include: { location: true } },
            carrier: true,
            customer: true,
          },
        }),
        this.prisma.sensorReading.findMany({
          where: { shipmentId: issue.shipmentId },
          orderBy: { eventTime: 'desc' },
          take: 100,
        }),
      ]);
      context.shipment = shipment;
      context.sensorReadings = sensorReadings;
    }

    // Load order with exception fields, trackable units
    if (issue.orderId) {
      context.order = await this.prisma.order.findUnique({
        where: { id: issue.orderId },
        include: {
          trackableUnits: true,
        },
      });
    }

    // Load carrier (if not already loaded via shipment)
    if (issue.carrierId && !context.shipment?.carrier) {
      context.carrier = await this.prisma.carrier.findUnique({
        where: { id: issue.carrierId },
      });
    } else if (context.shipment?.carrier) {
      context.carrier = context.shipment.carrier;
    }

    // Load customer (if not already loaded via shipment)
    if (issue.customerId && !context.shipment?.customer) {
      context.customer = await this.prisma.customer.findUnique({
        where: { id: issue.customerId },
      });
    } else if (context.shipment?.customer) {
      context.customer = context.shipment.customer;
    }

    return context;
  }

  // -----------------------------------------------------------------------
  // findTimeline — activity records for an issue
  // -----------------------------------------------------------------------
  async findTimeline(id: string): Promise<IssueActivity[]> {
    return this.prisma.issueActivity.findMany({
      where: { issueId: id },
      orderBy: { createdAt: 'asc' },
    });
  }

  // -----------------------------------------------------------------------
  // batchTransition — transition multiple issues at once
  // -----------------------------------------------------------------------
  async batchTransition(ids: string[], status: string, actorName: string): Promise<Issue[]> {
    const now = new Date();

    // Fetch current states for timeToFirstResponse calculation
    const currentIssues = await this.prisma.issue.findMany({
      where: { id: { in: ids } },
      select: { id: true, status: true, createdAt: true, timeToFirstResponse: true },
    });

    const results: Issue[] = [];

    for (const current of currentIssues) {
      const updateData: Prisma.IssueUpdateInput = {
        status,
        lastActivityAt: now,
        activityCount: { increment: 1 },
      };

      if (status === 'escalated') updateData.escalatedAt = now;
      if (status === 'resolved') updateData.resolvedAt = now;
      if (status === 'closed') updateData.closedAt = now;

      // First response tracking
      if (current.status === 'new' && status !== 'new' && current.timeToFirstResponse === null) {
        const minutes = Math.round((now.getTime() - current.createdAt.getTime()) / 60000);
        updateData.timeToFirstResponse = minutes;
      }

      const updated = await this.prisma.issue.update({
        where: { id: current.id },
        data: updateData,
      });
      results.push(updated);

      await this.prisma.issueActivity.create({
        data: {
          issueId: current.id,
          actorName,
          action: 'status_changed',
          details: { from: current.status, to: status, batch: true },
          createdAt: now,
        },
      });
    }

    return results;
  }

  // -----------------------------------------------------------------------
  // batchAssign — assign multiple issues at once
  // -----------------------------------------------------------------------
  async batchAssign(
    ids: string[],
    assigneeId: string,
    assigneeName: string,
    actorName: string,
  ): Promise<Issue[]> {
    const now = new Date();

    const issues = await this.prisma.issue.findMany({
      where: { id: { in: ids } },
      select: { id: true, assigneeId: true, assigneeName: true },
    });

    const results: Issue[] = [];

    for (const current of issues) {
      const updated = await this.prisma.issue.update({
        where: { id: current.id },
        data: {
          assigneeId,
          assigneeName,
          lastActivityAt: now,
          activityCount: { increment: 1 },
        },
      });
      results.push(updated);

      await this.prisma.issueActivity.create({
        data: {
          issueId: current.id,
          actorName,
          action: 'assigned',
          details: {
            from: { id: current.assigneeId, name: current.assigneeName },
            to: { id: assigneeId, name: assigneeName },
            batch: true,
          },
          createdAt: now,
        },
      });
    }

    return results;
  }

  // -----------------------------------------------------------------------
  // batchDismissNoise — mark multiple issues as noise
  // -----------------------------------------------------------------------
  async batchDismissNoise(ids: string[], reason: string, actorName: string): Promise<Issue[]> {
    const now = new Date();

    const results: Issue[] = [];

    for (const id of ids) {
      const updated = await this.prisma.issue.update({
        where: { id },
        data: {
          isNoise: true,
          noiseReason: reason,
          lastActivityAt: now,
          activityCount: { increment: 1 },
        },
      });
      results.push(updated);

      await this.prisma.issueActivity.create({
        data: {
          issueId: id,
          actorName,
          action: 'noise_dismissed',
          details: { reason, batch: true },
          createdAt: now,
        },
      });
    }

    return results;
  }

  // -----------------------------------------------------------------------
  // findActionable — unassigned, non-noise, high signal issues
  // -----------------------------------------------------------------------
  async findActionable(): Promise<Issue[]> {
    return this.prisma.issue.findMany({
      where: {
        assigneeId: null,
        isNoise: false,
        signalScore: { gte: 50 },
        status: { notIn: ['resolved', 'closed'] },
      },
      orderBy: [
        { priority: 'asc' },
        { signalScore: 'desc' },
      ],
    });
  }

  // -----------------------------------------------------------------------
  // nextIssueNumber
  // -----------------------------------------------------------------------
  async nextIssueNumber(orgId: string): Promise<string> {
    const lastIssue = await this.prisma.issue.findFirst({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      select: { issueNumber: true },
    });

    if (!lastIssue) return 'ISS-001';

    const match = lastIssue.issueNumber.match(/ISS-(\d+)/);
    const nextNum = match ? parseInt(match[1], 10) + 1 : 1;
    return `ISS-${String(nextNum).padStart(3, '0')}`;
  }
}
