import { PrismaClient, TradingPartner, TradingPartnerTransaction } from '@prisma/client';

export interface CreateTradingPartnerDTO {
  /** Multi-tenancy scope. Required post phase-2 tightening. */
  orgId: string;
  name: string;
  entityType: string;
  customerId?: string;
  carrierId?: string;
  // SFTP
  sftpHost?: string;
  sftpPort?: number;
  sftpUsername?: string;
  sftpPassword?: string;
  sftpPrivateKey?: string;
  // HTTP
  httpUrl?: string;
  httpAuthType?: string;
  httpAuthHeader?: string;
  httpAuthValue?: string;
  // EDI
  senderId?: string;
  receiverId?: string;
  ediVersion?: string;
  // Inbound
  inboundEnabled?: boolean;
  inboundDir?: string;
  inboundFilePattern?: string;
  pollingInterval?: number;
  pollingCron?: string;
  // Outbound
  outboundEnabled?: boolean;
  outboundDir?: string;
  outboundTransport?: string;
  outboundFileNaming?: string;
}

export interface UpdateTradingPartnerDTO extends Partial<CreateTradingPartnerDTO> {
  active?: boolean;
}

export interface CreateTransactionDTO {
  partnerId: string;
  transactionType: string;
  direction: string;
  enabled?: boolean;
  fieldMapping?: any;
  autoProcess?: boolean;
  ack997Required?: boolean;
  filePattern?: string;
}

export type TradingPartnerWithTransactions = TradingPartner & {
  transactions: TradingPartnerTransaction[];
  customer?: { id: string; name: string } | null;
  carrier?: { id: string; name: string } | null;
};

export interface ITradingPartnerRepository {
  create(data: CreateTradingPartnerDTO): Promise<TradingPartner>;
  findById(id: string): Promise<TradingPartnerWithTransactions | null>;
  findAll(filters?: { entityType?: string; active?: boolean; includeDeleted?: boolean }): Promise<TradingPartnerWithTransactions[]>;
  findByCarrierId(carrierId: string): Promise<TradingPartnerWithTransactions | null>;
  findByCustomerId(customerId: string): Promise<TradingPartnerWithTransactions | null>;
  findInboundPartners(): Promise<TradingPartnerWithTransactions[]>;
  findOutboundPartnersByTransaction(transactionType: string): Promise<TradingPartnerWithTransactions[]>;
  update(id: string, data: UpdateTradingPartnerDTO): Promise<TradingPartner>;
  softDelete(id: string, deletedBy: string | null): Promise<TradingPartner>;
  updateLastPolled(id: string): Promise<void>;
  // Transactions
  addTransaction(data: CreateTransactionDTO): Promise<TradingPartnerTransaction>;
  updateTransaction(id: string, data: Partial<TradingPartnerTransaction>): Promise<TradingPartnerTransaction>;
  removeTransaction(id: string): Promise<void>;
  // Logs
  createLog(data: any): Promise<any>;
  findLogById(id: string): Promise<any>;
  findLogs(filters: { orgId?: string; partnerId?: string; transactionType?: string; direction?: string; status?: string }): Promise<any[]>;
  findLogsWithPagination(filters: { orgId?: string; partnerId?: string; transactionType?: string; direction?: string; status?: string; source?: string; search?: string }, limit?: number, offset?: number): Promise<{ logs: any[]; total: number }>;
  getLogStats(filters?: { orgId?: string; partnerId?: string; transactionType?: string; direction?: string }): Promise<{ total: number; pending: number; processing: number; success: number; error: number; duplicate: number; totalEntitiesCreated: number }>;
  updateLog(id: string, data: any): Promise<any>;
}

const partnerInclude = {
  transactions: { orderBy: { transactionType: 'asc' as const } },
  customer: { select: { id: true, name: true } },
  carrier: { select: { id: true, name: true } },
};

export class TradingPartnerRepository implements ITradingPartnerRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateTradingPartnerDTO): Promise<TradingPartner> {
    return this.prisma.tradingPartner.create({ data });
  }

  async findById(id: string): Promise<TradingPartnerWithTransactions | null> {
    return this.prisma.tradingPartner.findUnique({
      where: { id },
      include: partnerInclude,
    }) as Promise<TradingPartnerWithTransactions | null>;
  }

  async findAll(filters?: { entityType?: string; active?: boolean; includeDeleted?: boolean }): Promise<TradingPartnerWithTransactions[]> {
    const where: any = {};
    if (filters?.entityType) where.entityType = filters.entityType;
    if (filters?.active !== undefined) where.active = filters.active;
    if (!filters?.includeDeleted) where.deletedAt = null;

    return this.prisma.tradingPartner.findMany({
      where,
      include: partnerInclude,
      orderBy: { name: 'asc' },
    }) as Promise<TradingPartnerWithTransactions[]>;
  }

  async findByCarrierId(carrierId: string): Promise<TradingPartnerWithTransactions | null> {
    return this.prisma.tradingPartner.findFirst({
      where: { carrierId, active: true, deletedAt: null },
      include: partnerInclude,
    }) as Promise<TradingPartnerWithTransactions | null>;
  }

  async findByCustomerId(customerId: string): Promise<TradingPartnerWithTransactions | null> {
    return this.prisma.tradingPartner.findFirst({
      where: { customerId, active: true, deletedAt: null },
      include: partnerInclude,
    }) as Promise<TradingPartnerWithTransactions | null>;
  }

  async findInboundPartners(): Promise<TradingPartnerWithTransactions[]> {
    return this.prisma.tradingPartner.findMany({
      where: { active: true, inboundEnabled: true, deletedAt: null },
      include: partnerInclude,
    }) as Promise<TradingPartnerWithTransactions[]>;
  }

  async findOutboundPartnersByTransaction(transactionType: string): Promise<TradingPartnerWithTransactions[]> {
    return this.prisma.tradingPartner.findMany({
      where: {
        active: true,
        deletedAt: null,
        outboundEnabled: true,
        transactions: {
          some: { transactionType, direction: 'outbound', enabled: true },
        },
      },
      include: partnerInclude,
    }) as Promise<TradingPartnerWithTransactions[]>;
  }

  async update(id: string, data: UpdateTradingPartnerDTO): Promise<TradingPartner> {
    return this.prisma.tradingPartner.update({ where: { id }, data });
  }

  async softDelete(id: string, deletedBy: string | null): Promise<TradingPartner> {
    return this.prisma.tradingPartner.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy,
        active: false,           // also flip active so polling/outbound stop immediately
        inboundEnabled: false,
        outboundEnabled: false,
      },
    });
  }

  async updateLastPolled(id: string): Promise<void> {
    await this.prisma.tradingPartner.update({
      where: { id },
      data: { lastPolledAt: new Date() },
    });
  }

  // ── Transactions ──

  async addTransaction(data: CreateTransactionDTO): Promise<TradingPartnerTransaction> {
    return this.prisma.tradingPartnerTransaction.create({ data });
  }

  async updateTransaction(id: string, data: Partial<TradingPartnerTransaction>): Promise<TradingPartnerTransaction> {
    return this.prisma.tradingPartnerTransaction.update({ where: { id }, data: data as any });
  }

  async removeTransaction(id: string): Promise<void> {
    await this.prisma.tradingPartnerTransaction.delete({ where: { id } });
  }

  // ── Logs ──

  async createLog(data: any): Promise<any> {
    // Note on orgId: the surrounding domain (Customer, Carrier, TradingPartner,
    // Shipment) does not carry orgId directly today, so we can't auto-derive
    // it. Route handlers should pass `req.user.organizationId` explicitly so
    // new rows are scoped; legacy rows backfilled to NULL are handled
    // tolerantly by the read endpoints.
    return this.prisma.ediTransactionLog.create({ data });
  }

  async findLogById(id: string): Promise<any> {
    return this.prisma.ediTransactionLog.findUnique({
      where: { id },
      include: { partner: { select: { id: true, name: true } } },
    });
  }

  async findLogs(filters: { orgId?: string; partnerId?: string; transactionType?: string; direction?: string; status?: string }): Promise<any[]> {
    const where: any = {};
    if (filters.orgId) where.orgId = filters.orgId;
    if (filters.partnerId) where.partnerId = filters.partnerId;
    if (filters.transactionType) where.transactionType = filters.transactionType;
    if (filters.direction) where.direction = filters.direction;
    if (filters.status) where.status = filters.status;

    return this.prisma.ediTransactionLog.findMany({
      where,
      include: { partner: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async findLogsWithPagination(
    filters: { orgId?: string; partnerId?: string; transactionType?: string; direction?: string; status?: string; source?: string; search?: string },
    limit = 50,
    offset = 0,
  ): Promise<{ logs: any[]; total: number }> {
    const where: any = {};
    if (filters.orgId) where.orgId = filters.orgId;
    if (filters.partnerId) where.partnerId = filters.partnerId;
    if (filters.transactionType) where.transactionType = filters.transactionType;
    if (filters.direction) where.direction = filters.direction;
    if (filters.status) where.status = filters.status;
    if (filters.source) where.source = filters.source;
    if (filters.search) {
      where.OR = [
        { fileName: { contains: filters.search, mode: 'insensitive' } },
        { shipmentReference: { contains: filters.search, mode: 'insensitive' } },
        { invoiceNumber: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [logs, total] = await Promise.all([
      this.prisma.ediTransactionLog.findMany({
        where,
        include: { partner: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.ediTransactionLog.count({ where }),
    ]);

    return { logs, total };
  }

  async getLogStats(filters?: { orgId?: string; partnerId?: string; transactionType?: string; direction?: string }): Promise<{
    total: number; pending: number; processing: number; success: number; error: number; duplicate: number; totalEntitiesCreated: number;
  }> {
    const where: any = {};
    if (filters?.orgId) where.orgId = filters.orgId;
    if (filters?.partnerId) where.partnerId = filters.partnerId;
    if (filters?.transactionType) where.transactionType = filters.transactionType;
    if (filters?.direction) where.direction = filters.direction;

    const [total, pending, processing, success, error, duplicate, entityAgg] = await Promise.all([
      this.prisma.ediTransactionLog.count({ where }),
      this.prisma.ediTransactionLog.count({ where: { ...where, status: 'pending' } }),
      this.prisma.ediTransactionLog.count({ where: { ...where, status: 'processing' } }),
      this.prisma.ediTransactionLog.count({ where: { ...where, status: 'success' } }),
      this.prisma.ediTransactionLog.count({ where: { ...where, status: 'error' } }),
      this.prisma.ediTransactionLog.count({ where: { ...where, status: 'duplicate' } }),
      this.prisma.ediTransactionLog.aggregate({ where, _sum: { entitiesCreated: true } }),
    ]);

    return { total, pending, processing, success, error, duplicate, totalEntitiesCreated: entityAgg._sum.entitiesCreated || 0 };
  }

  async updateLog(id: string, data: any): Promise<any> {
    return this.prisma.ediTransactionLog.update({ where: { id }, data });
  }
}
