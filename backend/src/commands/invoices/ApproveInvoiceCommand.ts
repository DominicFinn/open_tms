import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface ApproveInvoicePayload {
  invoiceId: string;
}

export const APPROVE_INVOICE = 'invoice.approve';

export class ApproveInvoiceCommandHandler extends BaseCommandHandler<ApproveInvoicePayload, { id: string }> {
  readonly commandType = APPROVE_INVOICE;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(command: Command<ApproveInvoicePayload>, tx: TransactionClient, emit: EmitFn) {
    const invoice = await tx.invoice.findUnique({
      where: { id: command.payload.invoiceId },
    });

    if (!invoice) throw new Error('Invoice not found');
    if (invoice.status !== 'draft') {
      throw new Error(`Cannot approve invoice in status "${invoice.status}"`);
    }

    const updated = await tx.invoice.update({
      where: { id: invoice.id },
      data: { status: 'approved' },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.INVOICE_APPROVED,
      entityType: 'invoice',
      entityId: invoice.id,
      payload: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        approvedBy: command.actorId,
      },
    }));

    return { id: updated.id };
  }
}
