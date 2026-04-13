import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface RecordPaymentPayload {
  invoiceId: string;
  amountCents: number;
  paymentMethod?: string;
  referenceNumber?: string;
  receivedDate?: string;
  notes?: string;
}

export const RECORD_PAYMENT = 'invoice.record_payment';

export class RecordPaymentCommandHandler extends BaseCommandHandler<RecordPaymentPayload, { id: string; invoiceStatus: string }> {
  readonly commandType = RECORD_PAYMENT;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(command: Command<RecordPaymentPayload>, tx: TransactionClient, emit: EmitFn) {
    const { payload } = command;

    const invoice = await tx.invoice.findUnique({
      where: { id: payload.invoiceId },
    });

    if (!invoice) throw new Error('Invoice not found');
    if (['void', 'paid'].includes(invoice.status)) {
      throw new Error(`Cannot record payment on invoice in status "${invoice.status}"`);
    }

    if (payload.amountCents <= 0) {
      throw new Error('Payment amount must be positive');
    }

    if (payload.amountCents > invoice.balanceCents) {
      throw new Error(`Payment amount (${payload.amountCents}) exceeds invoice balance (${invoice.balanceCents})`);
    }

    // Create payment record
    const payment = await tx.payment.create({
      data: {
        orgId: command.orgId,
        invoiceId: invoice.id,
        amountCents: payload.amountCents,
        currency: invoice.currency,
        paymentMethod: payload.paymentMethod,
        referenceNumber: payload.referenceNumber,
        receivedDate: payload.receivedDate ? new Date(payload.receivedDate) : new Date(),
        recordedBy: command.actorId,
        notes: payload.notes,
      },
    });

    // Update invoice balance
    const newPaidCents = invoice.paidCents + payload.amountCents;
    const newBalanceCents = invoice.totalCents - newPaidCents;
    const fullyPaid = newBalanceCents <= 0;
    const newStatus = fullyPaid ? 'paid' : 'partial_paid';

    await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        paidCents: newPaidCents,
        balanceCents: Math.max(0, newBalanceCents),
        status: newStatus,
        ...(fullyPaid && { paidAt: new Date() }),
      },
    });

    // Emit payment received event
    emit(this.createEvent(command, {
      type: EVENT_TYPES.INVOICE_PAYMENT_RECEIVED,
      entityType: 'invoice',
      entityId: invoice.id,
      payload: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        paymentId: payment.id,
        amountCents: payload.amountCents,
        newBalanceCents: Math.max(0, newBalanceCents),
        currency: invoice.currency,
      },
    }));

    // If fully paid, emit paid event
    if (fullyPaid) {
      emit(this.createEvent(command, {
        type: EVENT_TYPES.INVOICE_PAID,
        entityType: 'invoice',
        entityId: invoice.id,
        payload: {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          totalCents: invoice.totalCents,
          currency: invoice.currency,
        },
      }));

      // Update shipment financial summaries to paid
      const lineItems = await tx.invoiceLineItem.findMany({
        where: { invoiceId: invoice.id },
        select: { shipmentId: true },
      });
      const shipmentIds = [...new Set(lineItems.map((l: any) => l.shipmentId).filter(Boolean) as string[])];
      if (shipmentIds.length > 0) {
        await tx.shipmentFinancialSummary.updateMany({
          where: { shipmentId: { in: shipmentIds } },
          data: { billingStatus: 'paid' },
        });
      }
    }

    return { id: payment.id, invoiceStatus: newStatus };
  }
}
