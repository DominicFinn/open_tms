import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface VoidInvoicePayload {
  invoiceId: string;
  reason?: string;
}

export const VOID_INVOICE = 'invoice.void';

export class VoidInvoiceCommandHandler extends BaseCommandHandler<VoidInvoicePayload, { id: string }> {
  readonly commandType = VOID_INVOICE;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(command: Command<VoidInvoicePayload>, tx: TransactionClient, emit: EmitFn) {
    const invoice = await tx.invoice.findUnique({
      where: { id: command.payload.invoiceId },
      include: { lineItems: true },
    });

    if (!invoice) throw new Error('Invoice not found');
    if (invoice.status === 'void') {
      throw new Error('Invoice is already void');
    }
    if (invoice.paidCents > 0) {
      throw new Error('Cannot void an invoice that has payments recorded. Issue a credit note instead.');
    }

    await tx.invoice.update({
      where: { id: invoice.id },
      data: { status: 'void' },
    });

    // Revert charges back to approved status
    const chargeIds = invoice.lineItems
      .map((li: any) => li.chargeId)
      .filter(Boolean) as string[];

    if (chargeIds.length > 0) {
      await tx.charge.updateMany({
        where: { id: { in: chargeIds } },
        data: { status: 'approved' },
      });
    }

    // Revert shipment billing status to ready_to_invoice
    const shipmentIds = [...new Set(invoice.lineItems.map((li: any) => li.shipmentId).filter(Boolean) as string[])];
    if (shipmentIds.length > 0) {
      await tx.shipmentFinancialSummary.updateMany({
        where: { shipmentId: { in: shipmentIds } },
        data: { billingStatus: 'ready_to_invoice' },
      });
    }

    emit(this.createEvent(command, {
      type: EVENT_TYPES.INVOICE_VOIDED,
      entityType: 'invoice',
      entityId: invoice.id,
      payload: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        reason: command.payload.reason,
        voidedBy: command.actorId,
      },
    }));

    return { id: invoice.id };
  }
}
