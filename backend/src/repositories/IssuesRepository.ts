import { PrismaClient, Issue, IssueComment } from '@prisma/client';

export interface CreateIssueDTO {
  title: string;
  description?: string;
  orgId: string;
  severity?: string;
  category?: string;
  shipmentId?: string;
  orderId?: string;
  carrierId?: string;
  customerId?: string;
  assigneeId?: string;
  assigneeName?: string;
  source?: string;
  sourceEventId?: string;
  slaDeadline?: Date;
  createdBy?: string;
}

export interface UpdateIssueDTO {
  title?: string;
  description?: string;
  status?: string;
  severity?: string;
  category?: string;
  assigneeId?: string;
  assigneeName?: string;
  slaDeadline?: Date;
  slaBreach?: boolean;
}

export interface CreateIssueCommentDTO {
  issueId: string;
  authorId?: string;
  authorName: string;
  body: string;
}

export interface IssueFilter {
  orgId?: string;
  status?: string;
  severity?: string;
  assigneeId?: string;
  shipmentId?: string;
  orderId?: string;
  category?: string;
  limit?: number;
  offset?: number;
}

export type IssueWithComments = Issue & { comments: IssueComment[] };

export interface IIssuesRepository {
  findAll(filter: IssueFilter): Promise<{ issues: Issue[]; total: number }>;
  findById(id: string): Promise<IssueWithComments | null>;
  create(data: CreateIssueDTO): Promise<Issue>;
  update(id: string, data: UpdateIssueDTO): Promise<Issue>;
  transition(id: string, status: string): Promise<Issue>;
  addComment(data: CreateIssueCommentDTO): Promise<IssueComment>;
  nextIssueNumber(orgId: string): Promise<string>;
}

export class IssuesRepository implements IIssuesRepository {
  constructor(private prisma: PrismaClient) {}

  async findAll(filter: IssueFilter): Promise<{ issues: Issue[]; total: number }> {
    const where: any = {};
    if (filter.orgId) where.orgId = filter.orgId;
    if (filter.status) where.status = filter.status;
    if (filter.severity) where.severity = filter.severity;
    if (filter.assigneeId) where.assigneeId = filter.assigneeId;
    if (filter.shipmentId) where.shipmentId = filter.shipmentId;
    if (filter.orderId) where.orderId = filter.orderId;
    if (filter.category) where.category = filter.category;

    const [issues, total] = await Promise.all([
      this.prisma.issue.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filter.limit || 100,
        skip: filter.offset || 0,
        include: { comments: { orderBy: { createdAt: 'desc' }, take: 1 } },
      }),
      this.prisma.issue.count({ where }),
    ]);

    return { issues, total };
  }

  async findById(id: string): Promise<IssueWithComments | null> {
    return this.prisma.issue.findUnique({
      where: { id },
      include: { comments: { orderBy: { createdAt: 'asc' } } },
    });
  }

  async create(data: CreateIssueDTO): Promise<Issue> {
    const issueNumber = await this.nextIssueNumber(data.orgId);
    return this.prisma.issue.create({
      data: {
        issueNumber,
        title: data.title,
        description: data.description,
        orgId: data.orgId,
        severity: data.severity || 'medium',
        category: data.category,
        shipmentId: data.shipmentId,
        orderId: data.orderId,
        carrierId: data.carrierId,
        customerId: data.customerId,
        assigneeId: data.assigneeId,
        assigneeName: data.assigneeName,
        source: data.source || 'manual',
        sourceEventId: data.sourceEventId,
        slaDeadline: data.slaDeadline,
        createdBy: data.createdBy,
      },
    });
  }

  async update(id: string, data: UpdateIssueDTO): Promise<Issue> {
    return this.prisma.issue.update({
      where: { id },
      data,
    });
  }

  async transition(id: string, status: string): Promise<Issue> {
    const now = new Date();
    const updateData: any = { status };

    if (status === 'escalated') updateData.escalatedAt = now;
    if (status === 'resolved') updateData.resolvedAt = now;
    if (status === 'closed') updateData.closedAt = now;

    return this.prisma.issue.update({
      where: { id },
      data: updateData,
    });
  }

  async addComment(data: CreateIssueCommentDTO): Promise<IssueComment> {
    return this.prisma.issueComment.create({ data });
  }

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
