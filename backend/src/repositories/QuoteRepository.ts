import { PrismaClient, Quote, QuoteLineItem } from '@prisma/client';

// ─── DTOs ───────────────────────────────────────────────────────────────────

export interface CreateQuoteDTO {
  orgId: string;
  quoteNumber: string;
  customerId: string;
  originId?: string;
  destinationId?: string;
  serviceLevel?: string;
  equipmentType?: string;
  totalRevenueCents: number;
  totalCostCents: number;
  marginCents: number;
  marginPercent: number;
  currency?: string;
  validFrom?: Date;
  validUntil: Date;
  notes?: string;
  createdBy?: string;
}

export interface CreateQuoteLineItemDTO {
  quoteId: string;
  chargeType: string;
  description: string;
  amountCents: number;
  currency?: string;
  accessorialCode?: string;
  freightClass?: string;
  weight?: number;
  ratePerCwt?: number;
  quantity?: number;
}

export interface QuoteFilters {
  orgId?: string;
  customerId?: string;
  status?: string;
}

export type QuoteWithLineItems = Quote & {
  lineItems: QuoteLineItem[];
  customer: { id: string; name: string; contactEmail: string | null };
  parentQuote?: { id: string; quoteNumber: string; version: number } | null;
};

// ─── Interface ──────────────────────────────────────────────────────────────

export interface IQuoteRepository {
  create(data: CreateQuoteDTO): Promise<Quote>;
  findById(id: string): Promise<QuoteWithLineItems | null>;
  findAll(filters: QuoteFilters): Promise<QuoteWithLineItems[]>;
  update(id: string, data: Partial<Quote>): Promise<Quote>;
  addLineItems(data: CreateQuoteLineItemDTO[]): Promise<number>;
  getNextQuoteNumber(orgId: string): Promise<string>;
}

// ─── Implementation ─────────────────────────────────────────────────────────

export class QuoteRepository implements IQuoteRepository {
  constructor(private prisma: PrismaClient) {}

  private readonly includeRelations = {
    lineItems: true,
    customer: { select: { id: true, name: true, contactEmail: true } },
    parentQuote: { select: { id: true, quoteNumber: true, version: true } },
  } as const;

  async create(data: CreateQuoteDTO): Promise<Quote> {
    return this.prisma.quote.create({ data: {
      orgId: data.orgId,
      quoteNumber: data.quoteNumber,
      customerId: data.customerId,
      originId: data.originId,
      destinationId: data.destinationId,
      serviceLevel: data.serviceLevel ?? 'FTL',
      equipmentType: data.equipmentType,
      totalRevenueCents: data.totalRevenueCents,
      totalCostCents: data.totalCostCents,
      marginCents: data.marginCents,
      marginPercent: data.marginPercent,
      currency: data.currency ?? 'USD',
      validFrom: data.validFrom ?? new Date(),
      validUntil: data.validUntil,
      notes: data.notes,
      createdBy: data.createdBy,
    }});
  }

  async findById(id: string): Promise<QuoteWithLineItems | null> {
    return this.prisma.quote.findUnique({
      where: { id },
      include: this.includeRelations,
    }) as Promise<QuoteWithLineItems | null>;
  }

  async findAll(filters: QuoteFilters): Promise<QuoteWithLineItems[]> {
    return this.prisma.quote.findMany({
      where: {
        ...(filters.orgId && { orgId: filters.orgId }),
        ...(filters.customerId && { customerId: filters.customerId }),
        ...(filters.status && { status: filters.status }),
      },
      include: this.includeRelations,
      orderBy: { createdAt: 'desc' },
    }) as Promise<QuoteWithLineItems[]>;
  }

  async update(id: string, data: Partial<Quote>): Promise<Quote> {
    return this.prisma.quote.update({ where: { id }, data });
  }

  async addLineItems(data: CreateQuoteLineItemDTO[]): Promise<number> {
    const result = await this.prisma.quoteLineItem.createMany({
      data: data.map(d => ({
        quoteId: d.quoteId,
        chargeType: d.chargeType,
        description: d.description,
        amountCents: d.amountCents,
        currency: d.currency ?? 'USD',
        accessorialCode: d.accessorialCode,
        freightClass: d.freightClass,
        weight: d.weight,
        ratePerCwt: d.ratePerCwt,
        quantity: d.quantity ?? 1,
      })),
    });
    return result.count;
  }

  async getNextQuoteNumber(orgId: string): Promise<string> {
    const latest = await this.prisma.quote.findFirst({
      where: { orgId },
      orderBy: { quoteNumber: 'desc' },
      select: { quoteNumber: true },
    });
    if (!latest) return 'QTE-0001';
    const seq = parseInt(latest.quoteNumber.slice(4), 10);
    return `QTE-${String(seq + 1).padStart(4, '0')}`;
  }
}
