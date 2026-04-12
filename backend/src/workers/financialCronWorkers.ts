/**
 * Financial Cron Workers — pg-boss scheduled jobs for financial housekeeping.
 *
 * Two cron jobs:
 * 1. Quote expiration — expires quotes past their validUntil date (every 30 min)
 * 2. Invoice overdue — detects overdue invoices and emits events (every hour)
 */

import { PrismaClient } from '@prisma/client';

// ─── Quote Expiration ───────────────────────────────────────────────────────

export function createQuoteExpirationWorker(prisma: PrismaClient) {
  return async () => {
    console.log('[QuoteExpirationWorker] Scanning for expired quotes');

    try {
      const now = new Date();

      // Find quotes that are still in draft or sent status but past validUntil
      const expired = await prisma.quote.findMany({
        where: {
          status: { in: ['draft', 'sent'] },
          validUntil: { lt: now },
        },
        select: { id: true, quoteNumber: true },
      });

      if (expired.length === 0) {
        console.log('[QuoteExpirationWorker] No expired quotes found');
        return;
      }

      // Batch update to expired
      await prisma.quote.updateMany({
        where: {
          id: { in: expired.map(q => q.id) },
          status: { in: ['draft', 'sent'] },
        },
        data: { status: 'expired' },
      });

      console.log(
        `[QuoteExpirationWorker] Expired ${expired.length} quotes: ` +
        expired.map(q => q.quoteNumber).join(', ')
      );
    } catch (err) {
      console.error('[QuoteExpirationWorker] Error:', (err as Error).message);
      throw err;
    }
  };
}

export async function registerQuoteExpirationSchedule(
  boss: any,
  cronExpression?: string,
): Promise<void> {
  const cron = cronExpression || process.env.QUOTE_EXPIRATION_CRON || '*/30 * * * *';
  const queueName = 'quote-expiration';

  try {
    await boss.createQueue(queueName, {
      retryLimit: 1,
      retryDelay: 60,
      expireInSeconds: 300,
      deleteAfterSeconds: 86400,
    }).catch(() => {});

    await boss.schedule(queueName, cron, {}, { tz: 'UTC' });

    console.log(`[QuoteExpiration] Cron schedule registered: "${cron}" on queue "${queueName}"`);
  } catch (err) {
    console.error('[QuoteExpiration] Failed to register cron schedule:', (err as Error).message);
  }
}

export const QUOTE_EXPIRATION_QUEUE = 'quote-expiration';

// ─── Invoice Overdue Detection ──────────────────────────────────────────────

export function createInvoiceOverdueWorker(prisma: PrismaClient) {
  return async () => {
    console.log('[InvoiceOverdueWorker] Scanning for overdue invoices');

    try {
      const now = new Date();

      // Find invoices that are sent or partial_paid but past due date
      const overdue = await prisma.invoice.findMany({
        where: {
          status: { in: ['sent', 'partial_paid'] },
          dueDate: { lt: now },
        },
        select: {
          id: true,
          invoiceNumber: true,
          customerId: true,
          totalCents: true,
          balanceCents: true,
          dueDate: true,
          reminderCount: true,
          lastReminderSentAt: true,
          customer: { select: { name: true } },
        },
      });

      if (overdue.length === 0) {
        console.log('[InvoiceOverdueWorker] No overdue invoices found');
        return;
      }

      let statusUpdated = 0;
      let remindersSent = 0;

      for (const invoice of overdue) {
        // Update status to overdue if not already
        // (We check via query but the status column might still be 'sent')
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: { status: 'overdue' },
        });
        statusUpdated++;

        // Update InvoiceReadModel daysPastDue
        const daysPastDue = Math.floor((now.getTime() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24));
        await prisma.invoiceReadModel.update({
          where: { id: invoice.id },
          data: { status: 'overdue', daysPastDue },
        }).catch(() => {
          // Read model might not exist
        });

        // Send reminder if not sent in the last 7 days
        const lastReminder = invoice.lastReminderSentAt
          ? new Date(invoice.lastReminderSentAt).getTime()
          : 0;
        const sevenDaysAgo = now.getTime() - (7 * 24 * 60 * 60 * 1000);

        if (lastReminder < sevenDaysAgo) {
          await prisma.invoice.update({
            where: { id: invoice.id },
            data: {
              lastReminderSentAt: now,
              reminderCount: { increment: 1 },
            },
          });
          remindersSent++;

          console.log(
            `[InvoiceOverdueWorker] Invoice ${invoice.invoiceNumber} (${invoice.customer.name}) ` +
            `is ${daysPastDue} days overdue — balance ${invoice.balanceCents}c — reminder #${invoice.reminderCount + 1} queued`
          );
        }
      }

      console.log(
        `[InvoiceOverdueWorker] Complete — ${statusUpdated} marked overdue, ${remindersSent} reminders queued`
      );
    } catch (err) {
      console.error('[InvoiceOverdueWorker] Error:', (err as Error).message);
      throw err;
    }
  };
}

export async function registerInvoiceOverdueSchedule(
  boss: any,
  cronExpression?: string,
): Promise<void> {
  const cron = cronExpression || process.env.INVOICE_OVERDUE_CRON || '0 * * * *'; // Every hour
  const queueName = 'invoice-overdue';

  try {
    await boss.createQueue(queueName, {
      retryLimit: 1,
      retryDelay: 60,
      expireInSeconds: 600,
      deleteAfterSeconds: 86400,
    }).catch(() => {});

    await boss.schedule(queueName, cron, {}, { tz: 'UTC' });

    console.log(`[InvoiceOverdue] Cron schedule registered: "${cron}" on queue "${queueName}"`);
  } catch (err) {
    console.error('[InvoiceOverdue] Failed to register cron schedule:', (err as Error).message);
  }
}

export const INVOICE_OVERDUE_QUEUE = 'invoice-overdue';

// ─── Invoice Consolidation (Weekly / Monthly Batching) ──────────────────────

/**
 * Runs daily. For customers with weekly or monthly consolidation:
 * - Weekly: on Mondays, batches all ready-to-invoice shipments from the previous week
 * - Monthly: on the 1st of each month, batches all ready-to-invoice shipments from the previous month
 *
 * Creates a single draft invoice per customer containing all their unbilled charges.
 */
export function createInvoiceConsolidationWorker(prisma: PrismaClient) {
  return async () => {
    console.log('[InvoiceConsolidationWorker] Starting consolidation sweep');

    try {
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon
      const dayOfMonth = now.getDate();

      // Find customers needing consolidation today
      const consolidationTypes: string[] = [];
      if (dayOfWeek === 1) consolidationTypes.push('weekly');  // Monday
      if (dayOfMonth === 1) consolidationTypes.push('monthly'); // 1st of month

      if (consolidationTypes.length === 0) {
        console.log('[InvoiceConsolidationWorker] Not a consolidation day (Mon for weekly, 1st for monthly) — skipping');
        return;
      }

      const customers = await prisma.customer.findMany({
        where: {
          archived: false,
          invoiceConsolidation: { in: consolidationTypes },
        },
        select: {
          id: true,
          name: true,
          paymentTermsDays: true,
          invoiceConsolidation: true,
          currency: true,
        },
      });

      if (customers.length === 0) {
        console.log(`[InvoiceConsolidationWorker] No customers with ${consolidationTypes.join('/')} consolidation`);
        return;
      }

      let invoicesCreated = 0;

      for (const customer of customers) {
        // Only process if today is the right day for this customer's consolidation type
        if (customer.invoiceConsolidation === 'weekly' && dayOfWeek !== 1) continue;
        if (customer.invoiceConsolidation === 'monthly' && dayOfMonth !== 1) continue;

        // Find all ready-to-invoice shipments for this customer
        const summaries = await prisma.shipmentFinancialSummary.findMany({
          where: { billingStatus: 'ready_to_invoice' },
          select: { shipmentId: true },
        });

        if (summaries.length === 0) continue;

        const shipmentIds = summaries.map(s => s.shipmentId);

        // Filter to only this customer's shipments
        const customerShipments = await prisma.shipment.findMany({
          where: {
            id: { in: shipmentIds },
            customerId: customer.id,
          },
          select: { id: true, reference: true },
        });

        if (customerShipments.length === 0) continue;

        const custShipmentIds = customerShipments.map(s => s.id);

        // Collect all approved revenue charges
        const charges = await prisma.charge.findMany({
          where: {
            shipmentId: { in: custShipmentIds },
            chargeCategory: 'revenue',
            status: 'approved',
          },
        });

        if (charges.length === 0) continue;

        const subtotalCents = charges.reduce((s, c) => s + c.amountCents, 0);
        const currency = charges[0].currency;

        // Generate invoice number
        const today = new Date();
        const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
        const prefix = `INV-${dateStr}-`;
        const latest = await prisma.invoice.findFirst({
          where: { invoiceNumber: { startsWith: prefix } },
          orderBy: { invoiceNumber: 'desc' },
          select: { invoiceNumber: true },
        });
        const seq = latest ? parseInt(latest.invoiceNumber.slice(prefix.length), 10) + 1 : 1;
        const invoiceNumber = `${prefix}${String(seq).padStart(4, '0')}`;

        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + customer.paymentTermsDays);

        const periodLabel = customer.invoiceConsolidation === 'weekly' ? 'weekly' : 'monthly';
        const shipmentRefs = customerShipments.map(s => s.reference).join(', ');

        // Create consolidated invoice
        await prisma.invoice.create({
          data: {
            orgId: charges[0].orgId,
            invoiceNumber,
            customerId: customer.id,
            status: 'draft',
            subtotalCents,
            taxCents: 0,
            totalCents: subtotalCents,
            paidCents: 0,
            balanceCents: subtotalCents,
            currency,
            paymentTermsDays: customer.paymentTermsDays,
            issueDate: today,
            dueDate,
            createdBy: 'system',
            internalNotes: `${periodLabel} consolidated invoice — ${customerShipments.length} shipments: ${shipmentRefs}`,
            lineItems: {
              create: charges.map(charge => ({
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
        await prisma.charge.updateMany({
          where: { id: { in: charges.map(c => c.id) } },
          data: { status: 'invoiced' },
        });

        // Update shipment billing status
        await prisma.shipmentFinancialSummary.updateMany({
          where: { shipmentId: { in: custShipmentIds } },
          data: { billingStatus: 'invoiced' },
        });

        invoicesCreated++;
        console.log(
          `[InvoiceConsolidationWorker] Created ${periodLabel} invoice ${invoiceNumber} for ${customer.name}: ` +
          `${customerShipments.length} shipments, ${charges.length} charges, ${subtotalCents}c`
        );
      }

      console.log(`[InvoiceConsolidationWorker] Complete — ${invoicesCreated} consolidated invoices created`);
    } catch (err) {
      console.error('[InvoiceConsolidationWorker] Error:', (err as Error).message);
      throw err;
    }
  };
}

export async function registerInvoiceConsolidationSchedule(
  boss: any,
  cronExpression?: string,
): Promise<void> {
  // Runs daily at 6am UTC — weekly invoices generate on Mondays, monthly on 1st
  const cron = cronExpression || process.env.INVOICE_CONSOLIDATION_CRON || '0 6 * * *';
  const queueName = 'invoice-consolidation';

  try {
    await boss.createQueue(queueName, {
      retryLimit: 1,
      retryDelay: 300,
      expireInSeconds: 600,
      deleteAfterSeconds: 86400,
    }).catch(() => {});

    await boss.schedule(queueName, cron, {}, { tz: 'UTC' });

    console.log(`[InvoiceConsolidation] Cron schedule registered: "${cron}" on queue "${queueName}"`);
  } catch (err) {
    console.error('[InvoiceConsolidation] Failed to register cron schedule:', (err as Error).message);
  }
}

export const INVOICE_CONSOLIDATION_QUEUE = 'invoice-consolidation';

// ─── Carrier Payment Batch Execution ───────────────────────────────────────

/**
 * Runs daily. Executes payment for all carrier invoices that are in
 * 'scheduled' status with a scheduledPayDate on or before today.
 * Marks invoices as paid and updates shipment financial summaries.
 */
export function createCarrierPaymentBatchWorker(prisma: PrismaClient) {
  return async () => {
    console.log('[CarrierPaymentBatchWorker] Scanning for scheduled carrier payments due today');

    try {
      const today = new Date();
      today.setHours(23, 59, 59, 999); // End of day

      const scheduled = await prisma.carrierInvoice.findMany({
        where: {
          status: 'scheduled',
          scheduledPayDate: { lte: today },
        },
        include: {
          carrier: { select: { id: true, name: true } },
          lineItems: { select: { shipmentId: true } },
        },
      });

      if (scheduled.length === 0) {
        console.log('[CarrierPaymentBatchWorker] No scheduled payments due today');
        return;
      }

      let paidCount = 0;
      let totalPaidCents = 0;

      for (const inv of scheduled) {
        const amount = inv.approvedCents ?? inv.totalCents;

        await prisma.carrierInvoice.update({
          where: { id: inv.id },
          data: {
            status: 'paid',
            paidCents: amount,
            paidAt: new Date(),
            paymentReference: inv.paymentReference || `AUTO-BATCH-${today.toISOString().slice(0, 10)}`,
          },
        });

        // Update shipment carrier payment status
        const shipmentIds = [...new Set(inv.lineItems.map((l: { shipmentId: string | null }) => l.shipmentId).filter(Boolean) as string[])];
        if (shipmentIds.length > 0) {
          await prisma.shipmentFinancialSummary.updateMany({
            where: { shipmentId: { in: shipmentIds } },
            data: { carrierPaymentStatus: 'paid' },
          });
        }

        paidCount++;
        totalPaidCents += amount;

        console.log(
          `[CarrierPaymentBatchWorker] Paid ${inv.invoiceNumber} (${inv.carrier.name}): ${amount}c`
        );
      }

      console.log(
        `[CarrierPaymentBatchWorker] Complete - ${paidCount} invoices paid, total ${totalPaidCents}c`
      );
    } catch (err) {
      console.error('[CarrierPaymentBatchWorker] Error:', (err as Error).message);
      throw err;
    }
  };
}

export async function registerCarrierPaymentBatchSchedule(
  boss: any,
  cronExpression?: string,
): Promise<void> {
  // Runs daily at 7am UTC
  const cron = cronExpression || process.env.CARRIER_PAYMENT_BATCH_CRON || '0 7 * * *';
  const queueName = 'carrier-payment-batch';

  try {
    await boss.createQueue(queueName, {
      retryLimit: 1,
      retryDelay: 300,
      expireInSeconds: 600,
      deleteAfterSeconds: 86400,
    }).catch(() => {});

    await boss.schedule(queueName, cron, {}, { tz: 'UTC' });

    console.log(`[CarrierPaymentBatch] Cron schedule registered: "${cron}" on queue "${queueName}"`);
  } catch (err) {
    console.error('[CarrierPaymentBatch] Failed to register cron schedule:', (err as Error).message);
  }
}

export const CARRIER_PAYMENT_BATCH_QUEUE = 'carrier-payment-batch';
