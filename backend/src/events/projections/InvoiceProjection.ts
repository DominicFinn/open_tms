/**
 * InvoiceProjection — maintains the InvoiceReadModel for fast list queries.
 */

import { PrismaClient } from '@prisma/client';
import { DomainEvent } from '../DomainEvent.js';
import { IEventHandler } from '../IEventHandler.js';
import { EVENT_TYPES } from '../eventTypes.js';

export class InvoiceProjection implements IEventHandler {
  readonly name = 'projection.invoice';
  readonly eventPatterns = [
    EVENT_TYPES.INVOICE_CREATED,
    EVENT_TYPES.INVOICE_APPROVED,
    EVENT_TYPES.INVOICE_SENT,
    EVENT_TYPES.INVOICE_PAYMENT_RECEIVED,
    EVENT_TYPES.INVOICE_PAID,
    EVENT_TYPES.INVOICE_OVERDUE,
    EVENT_TYPES.INVOICE_VOIDED,
  ];
  readonly options = { concurrency: 3, retryLimit: 3, expireInSeconds: 30, pollingIntervalSeconds: 0.5 };

  constructor(private prisma: PrismaClient) {}

  async handle(event: DomainEvent): Promise<void> {
    switch (event.type) {
      case EVENT_TYPES.INVOICE_CREATED:
        return this.handleCreated(event);
      case EVENT_TYPES.INVOICE_APPROVED:
      case EVENT_TYPES.INVOICE_SENT:
      case EVENT_TYPES.INVOICE_PAYMENT_RECEIVED:
      case EVENT_TYPES.INVOICE_PAID:
      case EVENT_TYPES.INVOICE_OVERDUE:
      case EVENT_TYPES.INVOICE_VOIDED:
        return this.handleUpdated(event);
    }
  }

  private async handleCreated(event: DomainEvent): Promise<void> {
    const payload = event.payload as {
      invoiceId: string;
      invoiceNumber: string;
      customerId: string;
      customerName: string;
      totalCents: number;
      currency: string;
      shipmentCount: number;
      lineItemCount: number;
    };

    const invoice = await this.prisma.invoice.findUnique({
      where: { id: payload.invoiceId },
    });
    if (!invoice) return;

    await this.prisma.invoiceReadModel.upsert({
      where: { id: payload.invoiceId },
      create: {
        id: payload.invoiceId,
        orgId: event.orgId,
        invoiceNumber: payload.invoiceNumber,
        customerId: payload.customerId,
        customerName: payload.customerName,
        status: invoice.status,
        totalCents: payload.totalCents,
        paidCents: 0,
        balanceCents: payload.totalCents,
        currency: payload.currency,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        daysPastDue: 0,
        shipmentCount: payload.shipmentCount,
        lineItemCount: payload.lineItemCount,
        createdAt: invoice.createdAt,
        updatedAt: invoice.updatedAt,
      },
      update: {
        status: invoice.status,
        totalCents: payload.totalCents,
        balanceCents: payload.totalCents,
        updatedAt: new Date(),
      },
    });
  }

  private async handleUpdated(event: DomainEvent): Promise<void> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: event.entityId },
    });
    if (!invoice) return;

    const now = new Date();
    const daysPastDue = invoice.dueDate < now && !['paid', 'void'].includes(invoice.status)
      ? Math.floor((now.getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    await this.prisma.invoiceReadModel.update({
      where: { id: event.entityId },
      data: {
        status: invoice.status,
        paidCents: invoice.paidCents,
        balanceCents: invoice.balanceCents,
        daysPastDue,
        updatedAt: new Date(),
      },
    }).catch(() => {
      // Read model might not exist if event arrived before CREATED projection ran
    });
  }
}
