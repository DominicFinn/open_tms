/**
 * BillingTriggerHandler — marks shipments as "ready to invoice" when delivered.
 *
 * Listens for shipment.delivered events, checks that the shipment has revenue
 * charges, and updates the ShipmentFinancialSummary billing status.
 *
 * If the customer has autoInvoice=true, creates a draft invoice automatically.
 */

import { PrismaClient } from '@prisma/client';
import { DomainEvent } from '../DomainEvent.js';
import { IEventHandler } from '../IEventHandler.js';
import { EVENT_TYPES } from '../eventTypes.js';

export class BillingTriggerHandler implements IEventHandler {
  readonly name = 'billing_trigger';
  readonly eventPatterns = [
    EVENT_TYPES.SHIPMENT_DELIVERED,
  ];
  readonly options = { concurrency: 2, retryLimit: 3, expireInSeconds: 60 };

  constructor(private prisma: PrismaClient) {}

  async handle(event: DomainEvent): Promise<void> {
    if (event.type !== EVENT_TYPES.SHIPMENT_DELIVERED) return;

    const shipmentId = event.entityId;

    try {
      // Check if this shipment has any revenue charges
      const revenueCharges = await this.prisma.charge.findMany({
        where: {
          shipmentId,
          chargeCategory: 'revenue',
          status: { in: ['pending', 'approved'] },
        },
      });

      if (revenueCharges.length === 0) {
        console.log(`[${this.name}] Shipment ${shipmentId} delivered but has no revenue charges — skipping billing trigger`);
        return;
      }

      // Check current billing status to avoid re-triggering
      const existing = await this.prisma.shipmentFinancialSummary.findUnique({
        where: { shipmentId },
      });

      if (existing && existing.billingStatus !== 'not_ready') {
        console.log(`[${this.name}] Shipment ${shipmentId} already has billing status "${existing.billingStatus}" — skipping`);
        return;
      }

      // Mark as ready to invoice
      await this.prisma.shipmentFinancialSummary.upsert({
        where: { shipmentId },
        create: {
          shipmentId,
          orgId: event.orgId,
          billingStatus: 'ready_to_invoice',
          podReceived: true,
          expectedRevenueCents: revenueCharges.reduce((sum, c) => sum + c.amountCents, 0),
          currency: revenueCharges[0].currency,
        },
        update: {
          billingStatus: 'ready_to_invoice',
          podReceived: true,
        },
      });

      console.log(`[${this.name}] Shipment ${shipmentId} marked as ready_to_invoice (${revenueCharges.length} revenue charges)`);

      // Check if the customer has auto-invoice enabled and per_shipment consolidation
      const shipment = await this.prisma.shipment.findUnique({
        where: { id: shipmentId },
        select: {
          id: true,
          reference: true,
          customerId: true,
          customer: {
            select: {
              autoInvoice: true,
              paymentTermsDays: true,
              invoiceConsolidation: true,
            },
          },
        },
      });

      // Only auto-invoice per_shipment customers immediately.
      // Weekly/monthly customers are batched by the invoice consolidation cron worker.
      if (shipment?.customer.autoInvoice && shipment.customer.invoiceConsolidation === 'per_shipment') {
        // Auto-create a draft invoice
        const approvedCharges = revenueCharges.filter(c => c.status === 'approved');
        if (approvedCharges.length === 0) {
          console.log(`[${this.name}] Customer has auto-invoice but no approved charges yet — skipping auto-invoice`);
          return;
        }

        const subtotalCents = approvedCharges.reduce((sum, c) => sum + c.amountCents, 0);
        const currency = approvedCharges[0].currency;

        // Generate invoice number
        const today = new Date();
        const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
        const prefix = `INV-${dateStr}-`;
        const latest = await this.prisma.invoice.findFirst({
          where: { orgId: event.orgId, invoiceNumber: { startsWith: prefix } },
          orderBy: { invoiceNumber: 'desc' },
          select: { invoiceNumber: true },
        });
        const seq = latest ? parseInt(latest.invoiceNumber.slice(prefix.length), 10) + 1 : 1;
        const invoiceNumber = `${prefix}${String(seq).padStart(4, '0')}`;

        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + shipment.customer.paymentTermsDays);

        await this.prisma.invoice.create({
          data: {
            orgId: event.orgId,
            invoiceNumber,
            customerId: shipment.customerId,
            status: 'draft',
            subtotalCents,
            taxCents: 0,
            totalCents: subtotalCents,
            paidCents: 0,
            balanceCents: subtotalCents,
            currency,
            paymentTermsDays: shipment.customer.paymentTermsDays,
            issueDate: today,
            dueDate,
            createdBy: 'system',
            internalNotes: `Auto-generated on delivery of shipment ${shipment.reference}`,
            lineItems: {
              create: approvedCharges.map(charge => ({
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
        await this.prisma.charge.updateMany({
          where: { id: { in: approvedCharges.map(c => c.id) } },
          data: { status: 'invoiced' },
        });

        await this.prisma.shipmentFinancialSummary.update({
          where: { shipmentId },
          data: { billingStatus: 'invoiced' },
        });

        console.log(`[${this.name}] Auto-generated draft invoice ${invoiceNumber} for shipment ${shipment.reference}`);
      }
    } catch (err) {
      console.error(`[${this.name}] Error:`, err);
      throw err;
    }
  }
}
