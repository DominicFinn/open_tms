import { Prisma, PrismaClient } from '@prisma/client';

const edi810ShipmentSelect = {
  id: true,
  reference: true,
  carrierId: true,
  carrier: { select: { name: true, scacCode: true } },
} satisfies Prisma.ShipmentSelect;

export type Edi810Invoice = Prisma.InvoiceGetPayload<{ include: { customer: true; lineItems: true } }>;
export type Edi810Shipment = Prisma.ShipmentGetPayload<{ select: typeof edi810ShipmentSelect }>;

/**
 * Lookups the inbound financial EDI transactions (210, 820) and the outbound 810 make by the
 * references a trading partner sends. Every one is scoped to the tenant, because references like
 * a SCAC, a shipment reference or an invoice number are only unique within an org.
 */
export interface IEdiReferenceRepository {
  findCarrierByScac(orgId: string, scacCode: string): Promise<{ id: string; name: string } | null>;
  findShipmentIdByReference(orgId: string, reference: string): Promise<string | null>;
  findInvoiceByNumber(
    orgId: string,
    invoiceNumber: string,
  ): Promise<{ id: string; status: string; balanceCents: number; totalCents: number; invoiceNumber: string } | null>;
  findInvoiceForEdi810(orgId: string, invoiceId: string): Promise<Edi810Invoice | null>;
  findShipmentsForEdi810(orgId: string, shipmentIds: string[]): Promise<Edi810Shipment[]>;
}

export class EdiReferenceRepository implements IEdiReferenceRepository {
  constructor(private prisma: PrismaClient) {}

  async findCarrierByScac(orgId: string, scacCode: string) {
    return this.prisma.carrier.findFirst({
      where: { orgId, scacCode, archived: false },
      select: { id: true, name: true },
    });
  }

  async findShipmentIdByReference(orgId: string, reference: string): Promise<string | null> {
    const shipment = await this.prisma.shipment.findFirst({
      where: { orgId, reference },
      select: { id: true },
    });
    return shipment?.id ?? null;
  }

  async findInvoiceByNumber(orgId: string, invoiceNumber: string) {
    return this.prisma.invoice.findFirst({
      where: { orgId, invoiceNumber },
      select: { id: true, status: true, balanceCents: true, totalCents: true, invoiceNumber: true },
    });
  }

  async findInvoiceForEdi810(orgId: string, invoiceId: string): Promise<Edi810Invoice | null> {
    return this.prisma.invoice.findFirst({
      where: { id: invoiceId, orgId },
      include: { customer: true, lineItems: true },
    });
  }

  async findShipmentsForEdi810(orgId: string, shipmentIds: string[]): Promise<Edi810Shipment[]> {
    if (shipmentIds.length === 0) return [];
    return this.prisma.shipment.findMany({
      where: { orgId, id: { in: shipmentIds } },
      select: edi810ShipmentSelect,
    });
  }
}
