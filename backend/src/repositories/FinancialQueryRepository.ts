import { PrismaClient, FinancialQuery, CreditNote } from '@prisma/client';

// ─── DTOs ───────────────────────────────────────────────────────────────────

export interface CreateFinancialQueryDTO {
  orgId: string;
  queryNumber: string;
  queryType: string;
  invoiceId?: string;
  carrierInvoiceId?: string;
  shipmentId?: string;
  reason: string;
  description: string;
  disputedAmountCents?: number;
  cargoDiscrepancyId?: string;
  coldChainExcursionId?: string;
  assigneeId?: string;
  createdBy?: string;
}

export interface CreateCreditNoteDTO {
  orgId: string;
  creditNoteNumber: string;
  noteType: string;
  invoiceId?: string;
  customerId?: string;
  carrierId?: string;
  amountCents: number;
  currency?: string;
  reason: string;
  description: string;
  queryId?: string;
  createdBy?: string;
}

export interface FinancialQueryFilters {
  orgId?: string;
  queryType?: string;
  status?: string;
  invoiceId?: string;
  carrierInvoiceId?: string;
}

// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface IFinancialQueryRepository {
  create(data: CreateFinancialQueryDTO): Promise<FinancialQuery>;
  findById(id: string): Promise<FinancialQuery | null>;
  findAll(filters: FinancialQueryFilters): Promise<FinancialQuery[]>;
  update(id: string, data: Partial<FinancialQuery>): Promise<FinancialQuery>;
  getNextQueryNumber(orgId: string): Promise<string>;
}

export interface ICreditNoteRepository {
  create(data: CreateCreditNoteDTO): Promise<CreditNote>;
  findById(id: string): Promise<CreditNote | null>;
  findAll(orgId: string): Promise<CreditNote[]>;
  update(id: string, data: Partial<CreditNote>): Promise<CreditNote>;
  getNextCreditNoteNumber(orgId: string): Promise<string>;
}

// ─── Implementation ─────────────────────────────────────────────────────────

export class FinancialQueryRepository implements IFinancialQueryRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateFinancialQueryDTO): Promise<FinancialQuery> {
    return this.prisma.financialQuery.create({ data });
  }

  async findById(id: string): Promise<FinancialQuery | null> {
    return this.prisma.financialQuery.findUnique({ where: { id } });
  }

  async findAll(filters: FinancialQueryFilters): Promise<FinancialQuery[]> {
    return this.prisma.financialQuery.findMany({
      where: {
        ...(filters.orgId && { orgId: filters.orgId }),
        ...(filters.queryType && { queryType: filters.queryType }),
        ...(filters.status && { status: filters.status }),
        ...(filters.invoiceId && { invoiceId: filters.invoiceId }),
        ...(filters.carrierInvoiceId && { carrierInvoiceId: filters.carrierInvoiceId }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(id: string, data: Partial<FinancialQuery>): Promise<FinancialQuery> {
    return this.prisma.financialQuery.update({ where: { id }, data });
  }

  async getNextQueryNumber(orgId: string): Promise<string> {
    const latest = await this.prisma.financialQuery.findFirst({
      where: { orgId },
      orderBy: { queryNumber: 'desc' },
      select: { queryNumber: true },
    });
    if (!latest) return 'QRY-0001';
    const seq = parseInt(latest.queryNumber.slice(4), 10);
    return `QRY-${String(seq + 1).padStart(4, '0')}`;
  }
}

export class CreditNoteRepository implements ICreditNoteRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateCreditNoteDTO): Promise<CreditNote> {
    return this.prisma.creditNote.create({ data });
  }

  async findById(id: string): Promise<CreditNote | null> {
    return this.prisma.creditNote.findUnique({ where: { id } });
  }

  async findAll(orgId: string): Promise<CreditNote[]> {
    return this.prisma.creditNote.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(id: string, data: Partial<CreditNote>): Promise<CreditNote> {
    return this.prisma.creditNote.update({ where: { id }, data });
  }

  async getNextCreditNoteNumber(orgId: string): Promise<string> {
    const latest = await this.prisma.creditNote.findFirst({
      where: { orgId },
      orderBy: { creditNoteNumber: 'desc' },
      select: { creditNoteNumber: true },
    });
    if (!latest) return 'CN-0001';
    const seq = parseInt(latest.creditNoteNumber.slice(3), 10);
    return `CN-${String(seq + 1).padStart(4, '0')}`;
  }
}
