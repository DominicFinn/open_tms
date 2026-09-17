import { Prisma, PrismaClient } from '@prisma/client';

export interface WebhookLogFilters {
  status?: string;
  apiKeyId?: string;
  shipmentId?: string;
  deviceName?: string;
  receivedFrom?: Date;
  receivedTo?: Date;
}

const apiKeySummary = { select: { id: true, name: true, keyPrefix: true } } as const;

export type WebhookLogWithKey = Prisma.WebhookLogGetPayload<{ include: { apiKey: typeof apiKeySummary } }>;

export interface WebhookLogTotals {
  total: number;
  success: number;
  errors: number;
  skipped: number;
  notFound: number;
  updates: number;
}

export interface WebhookLogActivityRow {
  receivedAt: Date;
  status: string;
  shipmentUpdated: boolean;
}

// Inbound webhook logs belong to the org whose API key or signature authenticated the request.
// Every read is scoped by orgId; a log id from another org reads as not found.
export interface IWebhookLogRepository {
  list(orgId: string, filters: WebhookLogFilters, page: number, limit: number): Promise<{ logs: WebhookLogWithKey[]; total: number }>;
  totals(orgId: string, filters: WebhookLogFilters): Promise<WebhookLogTotals>;
  activity(orgId: string, filters: WebhookLogFilters): Promise<WebhookLogActivityRow[]>;
  findById(id: string, orgId: string): Promise<WebhookLogWithKey | null>;
}

export class WebhookLogRepository implements IWebhookLogRepository {
  constructor(private prisma: PrismaClient) {}

  async list(orgId: string, filters: WebhookLogFilters, page: number, limit: number) {
    const where = this.where(orgId, filters);
    const [logs, total] = await Promise.all([
      this.prisma.webhookLog.findMany({
        where,
        include: { apiKey: apiKeySummary },
        orderBy: { receivedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.webhookLog.count({ where }),
    ]);
    return { logs, total };
  }

  async totals(orgId: string, filters: WebhookLogFilters): Promise<WebhookLogTotals> {
    const where = this.where(orgId, filters);
    const [total, success, errors, skipped, notFound, updates] = await Promise.all([
      this.prisma.webhookLog.count({ where }),
      this.prisma.webhookLog.count({ where: { ...where, status: 'success' } }),
      this.prisma.webhookLog.count({ where: { ...where, status: 'error' } }),
      this.prisma.webhookLog.count({ where: { ...where, status: 'skipped' } }),
      this.prisma.webhookLog.count({ where: { ...where, status: 'not_found' } }),
      this.prisma.webhookLog.count({ where: { ...where, shipmentUpdated: true } }),
    ]);
    return { total, success, errors, skipped, notFound, updates };
  }

  async activity(orgId: string, filters: WebhookLogFilters): Promise<WebhookLogActivityRow[]> {
    return this.prisma.webhookLog.findMany({
      where: this.where(orgId, filters),
      select: { receivedAt: true, status: true, shipmentUpdated: true },
      orderBy: { receivedAt: 'asc' },
    });
  }

  async findById(id: string, orgId: string) {
    return this.prisma.webhookLog.findFirst({
      where: { id, orgId },
      include: { apiKey: apiKeySummary },
    });
  }

  private where(orgId: string, filters: WebhookLogFilters): Prisma.WebhookLogWhereInput {
    const where: Prisma.WebhookLogWhereInput = { orgId };
    if (filters.status) where.status = filters.status;
    if (filters.apiKeyId) where.apiKeyId = filters.apiKeyId;
    if (filters.shipmentId) where.shipmentId = filters.shipmentId;
    if (filters.deviceName) where.deviceName = { contains: filters.deviceName, mode: 'insensitive' };
    if (filters.receivedFrom || filters.receivedTo) {
      where.receivedAt = { gte: filters.receivedFrom, lte: filters.receivedTo };
    }
    return where;
  }
}
