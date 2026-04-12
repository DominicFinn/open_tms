import { PrismaClient, Invoice } from '@prisma/client';
import { IInvoiceRepository, InvoiceWithLineItems, CreateInvoiceLineItemDTO } from '../repositories/InvoiceRepository.js';
import { IChargeRepository } from '../repositories/ChargeRepository.js';

// ─── DTOs ───────────────────────────────────────────────────────────────────

export interface GenerateInvoiceInput {
  orgId: string;
  customerId: string;
  shipmentIds: string[];
  notes?: string;
  internalNotes?: string;
  createdBy?: string;
}

export interface GenerateInvoiceResult {
  invoice: InvoiceWithLineItems;
  chargesInvoiced: number;
}

// ─── Interface ──────────────────────────────────────────────────────────────

export interface IInvoicingService {
  generateFromShipments(input: GenerateInvoiceInput): Promise<GenerateInvoiceResult>;
  findReadyToInvoice(orgId: string, customerId?: string): Promise<ReadyToInvoiceShipment[]>;
}

export interface ReadyToInvoiceShipment {
  shipmentId: string;
  shipmentReference: string;
  customerId: string;
  customerName: string;
  totalRevenueCents: number;
  chargeCount: number;
  deliveredAt: Date | null;
}

// ─── Implementation ─────────────────────────────────────────────────────────

export class InvoicingService implements IInvoicingService {
  constructor(
    private invoiceRepo: IInvoiceRepository,
    private chargeRepo: IChargeRepository,
    private prisma: PrismaClient,
  ) {}

  async generateFromShipments(input: GenerateInvoiceInput): Promise<GenerateInvoiceResult> {
    if (input.shipmentIds.length === 0) {
      throw new Error('At least one shipment is required');
    }

    // Get customer info for payment terms
    const customer = await this.prisma.customer.findUnique({
      where: { id: input.customerId },
      select: {
        id: true,
        name: true,
        paymentTermsDays: true,
        currency: true,
      },
    });
    if (!customer) throw new Error('Customer not found');

    // Collect all approved revenue charges across the shipments
    const allCharges = [];
    for (const shipmentId of input.shipmentIds) {
      const charges = await this.chargeRepo.findAll({
        shipmentId,
        chargeCategory: 'revenue',
        status: 'approved',
      });
      allCharges.push(...charges);
    }

    if (allCharges.length === 0) {
      throw new Error('No approved revenue charges found for the selected shipments');
    }

    // Calculate totals
    const subtotalCents = allCharges.reduce((sum, c) => sum + c.amountCents, 0);
    const taxCents = 0; // Tax calculation deferred to future phase
    const totalCents = subtotalCents + taxCents;
    const currency = allCharges[0].currency;

    // Generate invoice number
    const invoiceNumber = await this.invoiceRepo.getNextInvoiceNumber(input.orgId);

    // Calculate due date
    const issueDate = new Date();
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + customer.paymentTermsDays);

    // Create the invoice
    const invoice = await this.invoiceRepo.create({
      orgId: input.orgId,
      invoiceNumber,
      customerId: input.customerId,
      subtotalCents,
      taxCents,
      totalCents,
      balanceCents: totalCents,
      currency,
      paymentTermsDays: customer.paymentTermsDays,
      issueDate,
      dueDate,
      notes: input.notes,
      internalNotes: input.internalNotes,
      createdBy: input.createdBy,
    });

    // Create line items from charges
    const lineItems: CreateInvoiceLineItemDTO[] = allCharges.map(charge => ({
      invoiceId: invoice.id,
      shipmentId: charge.shipmentId ?? undefined,
      orderId: charge.orderId ?? undefined,
      chargeId: charge.id,
      chargeType: charge.chargeType,
      description: charge.description,
      quantity: 1,
      unitPriceCents: charge.amountCents,
      totalCents: charge.amountCents,
      currency: charge.currency,
      freightClass: charge.freightClass ?? undefined,
    }));

    await this.invoiceRepo.addLineItems(lineItems);

    // Mark charges as invoiced
    for (const charge of allCharges) {
      await this.chargeRepo.update(charge.id, { status: 'invoiced' });
    }

    // Update shipment financial summaries
    const uniqueShipmentIds = [...new Set(allCharges.map(c => c.shipmentId).filter(Boolean) as string[])];
    for (const shipmentId of uniqueShipmentIds) {
      await this.prisma.shipmentFinancialSummary.updateMany({
        where: { shipmentId },
        data: { billingStatus: 'invoiced' },
      });
    }

    // Fetch the full invoice with relations
    const fullInvoice = await this.invoiceRepo.findById(invoice.id);
    if (!fullInvoice) throw new Error('Failed to fetch created invoice');

    return {
      invoice: fullInvoice,
      chargesInvoiced: allCharges.length,
    };
  }

  async findReadyToInvoice(orgId: string, customerId?: string): Promise<ReadyToInvoiceShipment[]> {
    // Find shipments that have billing status = ready_to_invoice
    const summaries = await this.prisma.shipmentFinancialSummary.findMany({
      where: {
        orgId,
        billingStatus: 'ready_to_invoice',
      },
      select: { shipmentId: true },
    });

    if (summaries.length === 0) return [];

    const shipmentIds = summaries.map(s => s.shipmentId);

    const shipments = await this.prisma.shipment.findMany({
      where: {
        id: { in: shipmentIds },
        ...(customerId && { customerId }),
      },
      select: {
        id: true,
        reference: true,
        customerId: true,
        deliveryDate: true,
        customer: { select: { name: true } },
      },
    });

    const results: ReadyToInvoiceShipment[] = [];

    for (const shipment of shipments) {
      const charges = await this.chargeRepo.findAll({
        shipmentId: shipment.id,
        chargeCategory: 'revenue',
        status: 'approved',
      });

      if (charges.length > 0) {
        results.push({
          shipmentId: shipment.id,
          shipmentReference: shipment.reference,
          customerId: shipment.customerId,
          customerName: shipment.customer.name,
          totalRevenueCents: charges.reduce((sum, c) => sum + c.amountCents, 0),
          chargeCount: charges.length,
          deliveredAt: shipment.deliveryDate,
        });
      }
    }

    return results;
  }
}
