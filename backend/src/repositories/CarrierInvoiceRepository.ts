import { PrismaClient, CarrierInvoice, CarrierInvoiceLineItem } from '@prisma/client';

// ─── DTOs ───────────────────────────────────────────────────────────────────

export interface CreateCarrierInvoiceDTO {
  orgId: string;
  invoiceNumber: string;
  carrierId: string;
  totalCents: number;
  currency?: string;
  paymentTermsDays?: number;
  receivedDate?: Date;
  dueDate: Date;
  edi210Content?: string;
  ediTransactionLogId?: string;
  notes?: string;
}

export interface CreateCarrierInvoiceLineItemDTO {
  carrierInvoiceId: string;
  shipmentId?: string;
  chargeId?: string;
  chargeType: string;
  description: string;
  amountCents: number;
  currency?: string;
  expectedAmountCents?: number;
  freightClass?: string;
  billedWeight?: number;
  actualWeight?: number;
}

export interface CarrierInvoiceFilters {
  orgId?: string;
  carrierId?: string;
  status?: string;
  matchStatus?: string;
}

export type CarrierInvoiceWithLineItems = CarrierInvoice & {
  lineItems: CarrierInvoiceLineItem[];
  carrier: { id: string; name: string; scacCode: string | null };
};

// ─── Interface ──────────────────────────────────────────────────────────────

export interface ICarrierInvoiceRepository {
  create(data: CreateCarrierInvoiceDTO): Promise<CarrierInvoice>;
  findById(id: string): Promise<CarrierInvoiceWithLineItems | null>;
  findAll(filters: CarrierInvoiceFilters): Promise<CarrierInvoiceWithLineItems[]>;
  update(id: string, data: Partial<CarrierInvoice>): Promise<CarrierInvoice>;
  addLineItem(data: CreateCarrierInvoiceLineItemDTO): Promise<CarrierInvoiceLineItem>;
  addLineItems(data: CreateCarrierInvoiceLineItemDTO[]): Promise<number>;
}

// ─── Implementation ─────────────────────────────────────────────────────────

export class CarrierInvoiceRepository implements ICarrierInvoiceRepository {
  constructor(private prisma: PrismaClient) {}

  private readonly includeRelations = {
    lineItems: true,
    carrier: { select: { id: true, name: true, scacCode: true } },
  } as const;

  async create(data: CreateCarrierInvoiceDTO): Promise<CarrierInvoice> {
    return this.prisma.carrierInvoice.create({ data: {
      orgId: data.orgId,
      invoiceNumber: data.invoiceNumber,
      carrierId: data.carrierId,
      totalCents: data.totalCents,
      currency: data.currency ?? 'USD',
      paymentTermsDays: data.paymentTermsDays ?? 30,
      receivedDate: data.receivedDate ?? new Date(),
      dueDate: data.dueDate,
      edi210Content: data.edi210Content,
      ediTransactionLogId: data.ediTransactionLogId,
      notes: data.notes,
    }});
  }

  async findById(id: string): Promise<CarrierInvoiceWithLineItems | null> {
    return this.prisma.carrierInvoice.findUnique({
      where: { id },
      include: this.includeRelations,
    }) as Promise<CarrierInvoiceWithLineItems | null>;
  }

  async findAll(filters: CarrierInvoiceFilters): Promise<CarrierInvoiceWithLineItems[]> {
    return this.prisma.carrierInvoice.findMany({
      where: {
        ...(filters.orgId && { orgId: filters.orgId }),
        ...(filters.carrierId && { carrierId: filters.carrierId }),
        ...(filters.status && { status: filters.status }),
        ...(filters.matchStatus && { matchStatus: filters.matchStatus }),
      },
      include: this.includeRelations,
      orderBy: { receivedDate: 'desc' },
    }) as Promise<CarrierInvoiceWithLineItems[]>;
  }

  async update(id: string, data: Partial<CarrierInvoice>): Promise<CarrierInvoice> {
    return this.prisma.carrierInvoice.update({ where: { id }, data });
  }

  async addLineItem(data: CreateCarrierInvoiceLineItemDTO): Promise<CarrierInvoiceLineItem> {
    return this.prisma.carrierInvoiceLineItem.create({ data: {
      carrierInvoiceId: data.carrierInvoiceId,
      shipmentId: data.shipmentId,
      chargeId: data.chargeId,
      chargeType: data.chargeType,
      description: data.description,
      amountCents: data.amountCents,
      currency: data.currency ?? 'USD',
      expectedAmountCents: data.expectedAmountCents,
      freightClass: data.freightClass,
      billedWeight: data.billedWeight,
      actualWeight: data.actualWeight,
    }});
  }

  async addLineItems(data: CreateCarrierInvoiceLineItemDTO[]): Promise<number> {
    const result = await this.prisma.carrierInvoiceLineItem.createMany({
      data: data.map(d => ({
        carrierInvoiceId: d.carrierInvoiceId,
        shipmentId: d.shipmentId,
        chargeId: d.chargeId,
        chargeType: d.chargeType,
        description: d.description,
        amountCents: d.amountCents,
        currency: d.currency ?? 'USD',
        expectedAmountCents: d.expectedAmountCents,
        freightClass: d.freightClass,
        billedWeight: d.billedWeight,
        actualWeight: d.actualWeight,
      })),
    });
    return result.count;
  }
}
