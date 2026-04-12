import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface SendInvoicePayload {
  invoiceId: string;
}

export const SEND_INVOICE = 'invoice.send';

export class SendInvoiceCommandHandler extends BaseCommandHandler<SendInvoicePayload, { id: string }> {
  readonly commandType = SEND_INVOICE;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(command: Command<SendInvoicePayload>, tx: TransactionClient, emit: EmitFn) {
    const invoice = await tx.invoice.findUnique({
      where: { id: command.payload.invoiceId },
      include: {
        customer: { select: { name: true, contactEmail: true, billingEmail: true } },
      },
    });

    if (!invoice) throw new Error('Invoice not found');
    if (!['approved', 'draft'].includes(invoice.status)) {
      throw new Error(`Cannot send invoice in status "${invoice.status}"`);
    }

    const updated = await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        status: 'sent',
        sentAt: new Date(),
      },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.INVOICE_SENT,
      entityType: 'invoice',
      entityId: invoice.id,
      payload: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        customerId: invoice.customerId,
        customerName: invoice.customer.name,
        recipientEmail: invoice.customer.billingEmail ?? invoice.customer.contactEmail,
        totalCents: invoice.totalCents,
        currency: invoice.currency,
        dueDate: invoice.dueDate.toISOString(),
      },
    }));

    return { id: updated.id };
  }
}
