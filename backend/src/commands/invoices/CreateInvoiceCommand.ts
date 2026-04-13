import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface CreateInvoicePayload {
  customerId: string;
  shipmentIds: string[];
  notes?: string;
  internalNotes?: string;
}

export const CREATE_INVOICE = 'invoice.create';

export class CreateInvoiceCommandHandler extends BaseCommandHandler<CreateInvoicePayload, { id: string; invoiceNumber: string }> {
  readonly commandType = CREATE_INVOICE;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(command: Command<CreateInvoicePayload>, tx: TransactionClient, emit: EmitFn) {
    const { payload } = command;

    if (payload.shipmentIds.length === 0) {
      throw new Error('At least one shipment is required');
    }

    // Get customer
    const customer = await tx.customer.findUnique({
      where: { id: payload.customerId },
      select: { id: true, name: true, paymentTermsDays: true, currency: true },
    });
    if (!customer) throw new Error('Customer not found');

    // Collect approved revenue charges
    const charges = await tx.charge.findMany({
      where: {
        shipmentId: { in: payload.shipmentIds },
        chargeCategory: 'revenue',
        status: 'approved',
      },
    });

    if (charges.length === 0) {
      throw new Error('No approved revenue charges found for the selected shipments');
    }

    const subtotalCents = charges.reduce((sum: number, c: any) => sum + c.amountCents, 0);
    const totalCents = subtotalCents;
    const currency = charges[0].currency;

    // Generate invoice number
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `INV-${dateStr}-`;
    const latest = await tx.invoice.findFirst({
      where: { orgId: command.orgId, invoiceNumber: { startsWith: prefix } },
      orderBy: { invoiceNumber: 'desc' },
      select: { invoiceNumber: true },
    });
    const seq = latest ? parseInt(latest.invoiceNumber.slice(prefix.length), 10) + 1 : 1;
    const invoiceNumber = `${prefix}${String(seq).padStart(4, '0')}`;

    const issueDate = new Date();
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + customer.paymentTermsDays);

    // Create invoice
    const invoice = await tx.invoice.create({
      data: {
        orgId: command.orgId,
        invoiceNumber,
        customerId: payload.customerId,
        status: 'draft',
        subtotalCents,
        taxCents: 0,
        totalCents,
        paidCents: 0,
        balanceCents: totalCents,
        currency,
        paymentTermsDays: customer.paymentTermsDays,
        issueDate,
        dueDate,
        notes: payload.notes,
        internalNotes: payload.internalNotes,
        createdBy: command.actorId,
        lineItems: {
          create: charges.map((charge: any) => ({
            shipmentId: charge.shipmentId,
            orderId: charge.orderId,
            chargeId: charge.id,
            chargeType: charge.chargeType,
            description: charge.description,
            quantity: 1,
            unitPriceCents: charge.amountCents,
            totalCents: charge.amountCents,
            currency: charge.currency,
            freightClass: charge.freightClass,
          })),
        },
      },
    });

    // Mark charges as invoiced
    await tx.charge.updateMany({
      where: { id: { in: charges.map((c: any) => c.id) } },
      data: { status: 'invoiced' },
    });

    // Update shipment billing status
    const shipmentIds = [...new Set(charges.map((c: any) => c.shipmentId).filter(Boolean) as string[])];
    await tx.shipmentFinancialSummary.updateMany({
      where: { shipmentId: { in: shipmentIds } },
      data: { billingStatus: 'invoiced' },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.INVOICE_CREATED,
      entityType: 'invoice',
      entityId: invoice.id,
      payload: {
        invoiceId: invoice.id,
        invoiceNumber,
        customerId: payload.customerId,
        customerName: customer.name,
        totalCents,
        currency,
        shipmentCount: shipmentIds.length,
        lineItemCount: charges.length,
      },
    }));

    return { id: invoice.id, invoiceNumber };
  }
}
