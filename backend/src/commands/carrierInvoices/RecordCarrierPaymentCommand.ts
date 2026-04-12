import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface RecordCarrierPaymentPayload {
  carrierInvoiceId: string;
  amountCents: number;
  paymentReference?: string;
  scheduledPayDate?: string;
}

export const RECORD_CARRIER_PAYMENT = 'carrier_invoice.record_payment';

export class RecordCarrierPaymentCommandHandler extends BaseCommandHandler<RecordCarrierPaymentPayload, { id: string }> {
  readonly commandType = RECORD_CARRIER_PAYMENT;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(command: Command<RecordCarrierPaymentPayload>, tx: TransactionClient, emit: EmitFn) {
    const { payload } = command;

    const invoice = await tx.carrierInvoice.findUnique({
      where: { id: payload.carrierInvoiceId },
      include: { lineItems: true },
    });
    if (!invoice) throw new Error('Carrier invoice not found');

    if (!['approved', 'scheduled'].includes(invoice.status)) {
      throw new Error(`Cannot record payment on carrier invoice in status "${invoice.status}"`);
    }

    await tx.carrierInvoice.update({
      where: { id: invoice.id },
      data: {
        status: 'paid',
        paidCents: payload.amountCents,
        paidAt: new Date(),
        paymentReference: payload.paymentReference,
      },
    });

    // Update shipment carrier payment status
    const shipmentIds = [...new Set(invoice.lineItems.map(l => l.shipmentId).filter(Boolean) as string[])];
    if (shipmentIds.length > 0) {
      await tx.shipmentFinancialSummary.updateMany({
        where: { shipmentId: { in: shipmentIds } },
        data: { carrierPaymentStatus: 'paid' },
      });
    }

    emit(this.createEvent(command, {
      type: EVENT_TYPES.CARRIER_INVOICE_PAID,
      entityType: 'carrier_invoice',
      entityId: invoice.id,
      payload: {
        carrierInvoiceId: invoice.id,
        carrierId: invoice.carrierId,
        invoiceNumber: invoice.invoiceNumber,
        amountCents: payload.amountCents,
        paymentReference: payload.paymentReference,
      },
    }));

    return { id: invoice.id };
  }
}
