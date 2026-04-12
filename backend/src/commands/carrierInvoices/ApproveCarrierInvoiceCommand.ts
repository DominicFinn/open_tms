import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface ApproveCarrierInvoicePayload {
  carrierInvoiceId: string;
  approvedCents?: number;
}

export const APPROVE_CARRIER_INVOICE = 'carrier_invoice.approve';

export class ApproveCarrierInvoiceCommandHandler extends BaseCommandHandler<ApproveCarrierInvoicePayload, { id: string }> {
  readonly commandType = APPROVE_CARRIER_INVOICE;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(command: Command<ApproveCarrierInvoicePayload>, tx: TransactionClient, emit: EmitFn) {
    const { payload } = command;

    const invoice = await tx.carrierInvoice.findUnique({
      where: { id: payload.carrierInvoiceId },
      include: { lineItems: true },
    });
    if (!invoice) throw new Error('Carrier invoice not found');

    if (!['received', 'matched', 'discrepancy'].includes(invoice.status)) {
      throw new Error(`Cannot approve carrier invoice in status "${invoice.status}"`);
    }

    const approvedCents = payload.approvedCents ?? invoice.totalCents;

    await tx.carrierInvoice.update({
      where: { id: invoice.id },
      data: {
        status: 'approved',
        approvedCents,
        approvedBy: command.actorId,
        approvedAt: new Date(),
      },
    });

    // Update shipment carrier payment status
    const shipmentIds = [...new Set(invoice.lineItems.map(l => l.shipmentId).filter(Boolean) as string[])];
    if (shipmentIds.length > 0) {
      await tx.shipmentFinancialSummary.updateMany({
        where: { shipmentId: { in: shipmentIds } },
        data: { carrierPaymentStatus: 'approved' },
      });
    }

    emit(this.createEvent(command, {
      type: EVENT_TYPES.CARRIER_INVOICE_APPROVED,
      entityType: 'carrier_invoice',
      entityId: invoice.id,
      payload: {
        carrierInvoiceId: invoice.id,
        carrierId: invoice.carrierId,
        invoiceNumber: invoice.invoiceNumber,
        approvedCents,
        approvedBy: command.actorId,
      },
    }));

    return { id: invoice.id };
  }
}
