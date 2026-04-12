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
