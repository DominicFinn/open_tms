import { PrismaClient, Invoice, InvoiceLineItem, Payment } from '@prisma/client';

// ─── DTOs ───────────────────────────────────────────────────────────────────

export interface CreateInvoiceDTO {
  orgId: string;
  invoiceNumber: string;
  customerId: string;
  subtotalCents: number;
  taxCents?: number;
  totalCents: number;
  balanceCents: number;
  currency?: string;
  paymentTermsDays?: number;
  issueDate?: Date;
  dueDate: Date;
  notes?: string;
  internalNotes?: string;
  createdBy?: string;
}

export interface CreateInvoiceLineItemDTO {
  invoiceId: string;
  shipmentId?: string;
  orderId?: string;
  chargeId?: string;
  chargeType: string;
  description: string;
  quantity?: number;
  unitPriceCents: number;
  totalCents: number;
  currency?: string;
  freightClass?: string;
  weight?: number;
}

export interface CreatePaymentDTO {
  orgId: string;
  invoiceId: string;
  amountCents: number;
  currency?: string;
  paymentMethod?: string;
  referenceNumber?: string;
  receivedDate?: Date;
  recordedBy?: string;
  notes?: string;
}

export interface InvoiceFilters {
  orgId?: string;
  customerId?: string;
  status?: string;
  dueBefore?: Date;
  dueAfter?: Date;
}

export type InvoiceWithLineItems = Invoice & {
  lineItems: InvoiceLineItem[];
  payments: Payment[];
  customer: { id: string; name: string; contactEmail: string | null; billingEmail: string | null };
};

// ─── Interface ──────────────────────────────────────────────────────────────

export interface IInvoiceRepository {
  create(data: CreateInvoiceDTO): Promise<Invoice>;
  findById(id: string): Promise<InvoiceWithLineItems | null>;
  findAll(filters: InvoiceFilters): Promise<InvoiceWithLineItems[]>;
  update(id: string, data: Partial<Invoice>): Promise<Invoice>;
  addLineItem(data: CreateInvoiceLineItemDTO): Promise<InvoiceLineItem>;
  addLineItems(data: CreateInvoiceLineItemDTO[]): Promise<number>;
  getNextInvoiceNumber(orgId: string): Promise<string>;
  findOverdue(): Promise<Invoice[]>;
}

export interface IPaymentRepository {
  create(data: CreatePaymentDTO): Promise<Payment>;
  findByInvoiceId(invoiceId: string): Promise<Payment[]>;
}

// ─── Implementation ─────────────────────────────────────────────────────────

export class InvoiceRepository implements IInvoiceRepository {
  constructor(private prisma: PrismaClient) {}

  private readonly includeRelations = {
    lineItems: true,
    payments: true,
    customer: {
      select: { id: true, name: true, contactEmail: true, billingEmail: true },
    },
  } as const;

  async create(data: CreateInvoiceDTO): Promise<Invoice> {
    return this.prisma.invoice.create({ data: {
      orgId: data.orgId,
      invoiceNumber: data.invoiceNumber,
      customerId: data.customerId,
      subtotalCents: data.subtotalCents,
      taxCents: data.taxCents ?? 0,
      totalCents: data.totalCents,
      balanceCents: data.balanceCents,
      currency: data.currency ?? 'USD',
      paymentTermsDays: data.paymentTermsDays ?? 30,
      issueDate: data.issueDate ?? new Date(),
      dueDate: data.dueDate,
      notes: data.notes,
      internalNotes: data.internalNotes,
      createdBy: data.createdBy,
    }});
  }

  async findById(id: string): Promise<InvoiceWithLineItems | null> {
    return this.prisma.invoice.findUnique({
      where: { id },
      include: this.includeRelations,
    }) as Promise<InvoiceWithLineItems | null>;
  }

  async findAll(filters: InvoiceFilters): Promise<InvoiceWithLineItems[]> {
    return this.prisma.invoice.findMany({
      where: {
        ...(filters.orgId && { orgId: filters.orgId }),
        ...(filters.customerId && { customerId: filters.customerId }),
        ...(filters.status && { status: filters.status }),
        ...(filters.dueBefore && { dueDate: { lte: filters.dueBefore } }),
        ...(filters.dueAfter && { dueDate: { gte: filters.dueAfter } }),
      },
      include: this.includeRelations,
      orderBy: { createdAt: 'desc' },
    }) as Promise<InvoiceWithLineItems[]>;
  }

  async update(id: string, data: Partial<Invoice>): Promise<Invoice> {
    return this.prisma.invoice.update({ where: { id }, data });
  }

  async addLineItem(data: CreateInvoiceLineItemDTO): Promise<InvoiceLineItem> {
    return this.prisma.invoiceLineItem.create({ data: {
      invoiceId: data.invoiceId,
      shipmentId: data.shipmentId,
      orderId: data.orderId,
      chargeId: data.chargeId,
      chargeType: data.chargeType,
      description: data.description,
      quantity: data.quantity ?? 1,
      unitPriceCents: data.unitPriceCents,
      totalCents: data.totalCents,
      currency: data.currency ?? 'USD',
      freightClass: data.freightClass,
      weight: data.weight,
    }});
  }

  async addLineItems(data: CreateInvoiceLineItemDTO[]): Promise<number> {
    const result = await this.prisma.invoiceLineItem.createMany({
      data: data.map(d => ({
        invoiceId: d.invoiceId,
        shipmentId: d.shipmentId,
        orderId: d.orderId,
        chargeId: d.chargeId,
        chargeType: d.chargeType,
        description: d.description,
        quantity: d.quantity ?? 1,
        unitPriceCents: d.unitPriceCents,
        totalCents: d.totalCents,
        currency: d.currency ?? 'USD',
        freightClass: d.freightClass,
        weight: d.weight,
      })),
    });
    return result.count;
  }

  async getNextInvoiceNumber(orgId: string): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `INV-${dateStr}-`;

    const latest = await this.prisma.invoice.findFirst({
      where: { orgId, invoiceNumber: { startsWith: prefix } },
      orderBy: { invoiceNumber: 'desc' },
      select: { invoiceNumber: true },
    });

    if (!latest) return `${prefix}0001`;

    const seq = parseInt(latest.invoiceNumber.slice(prefix.length), 10);
    return `${prefix}${String(seq + 1).padStart(4, '0')}`;
  }

  async findOverdue(): Promise<Invoice[]> {
    return this.prisma.invoice.findMany({
      where: {
        status: { in: ['sent', 'partial_paid'] },
        dueDate: { lt: new Date() },
      },
    });
  }
}

export class PaymentRepository implements IPaymentRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreatePaymentDTO): Promise<Payment> {
    return this.prisma.payment.create({ data: {
      orgId: data.orgId,
      invoiceId: data.invoiceId,
      amountCents: data.amountCents,
      currency: data.currency ?? 'USD',
      paymentMethod: data.paymentMethod,
      referenceNumber: data.referenceNumber,
      receivedDate: data.receivedDate ?? new Date(),
      recordedBy: data.recordedBy,
      notes: data.notes,
    }});
  }

  async findByInvoiceId(invoiceId: string): Promise<Payment[]> {
    return this.prisma.payment.findMany({
      where: { invoiceId },
      orderBy: { receivedDate: 'desc' },
    });
  }
}
