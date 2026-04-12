/**
 * CarrierPaymentBatchService — Groups approved carrier invoices into payment
 * batches by carrier, due date, or payment terms. Supports scheduling future
 * payment dates and bulk execution.
 */

import { PrismaClient } from '@prisma/client';

export interface PaymentBatchItem {
  carrierInvoiceId: string;
  invoiceNumber: string;
  carrierId: string;
  carrierName: string;
  scacCode: string | null;
  approvedCents: number;
  totalCents: number;
  currency: string;
  dueDate: Date;
  receivedDate: Date;
}

export interface PaymentBatch {
  carrierId: string;
  carrierName: string;
  scacCode: string | null;
  invoiceCount: number;
  totalCents: number;
  currency: string;
  earliestDueDate: Date;
  latestDueDate: Date;
  invoices: PaymentBatchItem[];
}

export interface ScheduleResult {
  scheduledCount: number;
  scheduledPayDate: Date;
  carriers: Array<{ carrierId: string; carrierName: string; invoiceCount: number; totalCents: number }>;
}

export interface ExecuteBatchResult {
  paidCount: number;
  totalPaidCents: number;
  carriers: Array<{ carrierId: string; carrierName: string; invoiceCount: number; paidCents: number }>;
}

export class CarrierPaymentBatchService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get all approved carrier invoices ready for payment, grouped by carrier.
   */
  async getPendingBatches(filters?: {
    carrierId?: string;
    dueBefore?: Date;
  }): Promise<PaymentBatch[]> {
    const invoices = await this.prisma.carrierInvoice.findMany({
      where: {
        status: 'approved',
        ...(filters?.carrierId && { carrierId: filters.carrierId }),
        ...(filters?.dueBefore && { dueDate: { lte: filters.dueBefore } }),
      },
      include: {
        carrier: { select: { id: true, name: true, scacCode: true } },
      },
      orderBy: [{ carrierId: 'asc' }, { dueDate: 'asc' }],
    });

    // Group by carrier
    const byCarrier = new Map<string, PaymentBatch>();

    for (const inv of invoices) {
      const existing = byCarrier.get(inv.carrierId);
      const item: PaymentBatchItem = {
        carrierInvoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        carrierId: inv.carrierId,
        carrierName: inv.carrier.name,
        scacCode: inv.carrier.scacCode,
        approvedCents: inv.approvedCents ?? inv.totalCents,
        totalCents: inv.totalCents,
        currency: inv.currency,
        dueDate: inv.dueDate,
        receivedDate: inv.receivedDate,
      };

      if (existing) {
        existing.invoiceCount++;
        existing.totalCents += item.approvedCents;
        if (inv.dueDate < existing.earliestDueDate) existing.earliestDueDate = inv.dueDate;
        if (inv.dueDate > existing.latestDueDate) existing.latestDueDate = inv.dueDate;
        existing.invoices.push(item);
      } else {
        byCarrier.set(inv.carrierId, {
          carrierId: inv.carrierId,
          carrierName: inv.carrier.name,
          scacCode: inv.carrier.scacCode,
          invoiceCount: 1,
          totalCents: item.approvedCents,
          currency: inv.currency,
          earliestDueDate: inv.dueDate,
          latestDueDate: inv.dueDate,
          invoices: [item],
        });
      }
    }

    return Array.from(byCarrier.values());
  }

  /**
   * Schedule a batch of approved invoices for payment on a specific date.
   * Sets status to 'scheduled' and records the scheduledPayDate.
   */
  async scheduleBatch(params: {
    carrierInvoiceIds?: string[];
    carrierId?: string;
    dueBefore?: Date;
    scheduledPayDate: Date;
  }): Promise<ScheduleResult> {
    const { scheduledPayDate } = params;

    // Build the where clause
    const where: any = { status: 'approved' };
    if (params.carrierInvoiceIds?.length) {
      where.id = { in: params.carrierInvoiceIds };
    } else {
      if (params.carrierId) where.carrierId = params.carrierId;
      if (params.dueBefore) where.dueDate = { lte: params.dueBefore };
    }

    // Find matching invoices
    const invoices = await this.prisma.carrierInvoice.findMany({
      where,
      include: { carrier: { select: { id: true, name: true } } },
    });

    if (invoices.length === 0) {
      return { scheduledCount: 0, scheduledPayDate, carriers: [] };
    }

    // Update all to scheduled
    await this.prisma.carrierInvoice.updateMany({
      where: { id: { in: invoices.map((i: { id: string }) => i.id) } },
      data: {
        status: 'scheduled',
        scheduledPayDate,
      },
    });

    // Group results by carrier for the response
    const byCarrier = new Map<string, { carrierId: string; carrierName: string; invoiceCount: number; totalCents: number }>();
    for (const inv of invoices) {
      const existing = byCarrier.get(inv.carrierId);
      const amount = inv.approvedCents ?? inv.totalCents;
      if (existing) {
        existing.invoiceCount++;
        existing.totalCents += amount;
      } else {
        byCarrier.set(inv.carrierId, {
          carrierId: inv.carrierId,
          carrierName: inv.carrier.name,
          invoiceCount: 1,
          totalCents: amount,
        });
      }
    }

    return {
      scheduledCount: invoices.length,
      scheduledPayDate,
      carriers: Array.from(byCarrier.values()),
    };
  }

  /**
   * Execute payment for all scheduled invoices due on or before the given date.
   * Marks them as paid and records the payment reference.
   */
  async executeScheduledPayments(params: {
    payDate?: Date;
    paymentReference?: string;
  }): Promise<ExecuteBatchResult> {
    const payDate = params.payDate ?? new Date();

    const invoices = await this.prisma.carrierInvoice.findMany({
      where: {
        status: 'scheduled',
        scheduledPayDate: { lte: payDate },
      },
      include: {
        carrier: { select: { id: true, name: true } },
        lineItems: { select: { shipmentId: true } },
      },
    });

    if (invoices.length === 0) {
      return { paidCount: 0, totalPaidCents: 0, carriers: [] };
    }

    let totalPaidCents = 0;
    const byCarrier = new Map<string, { carrierId: string; carrierName: string; invoiceCount: number; paidCents: number }>();

    for (const inv of invoices) {
      const amount = inv.approvedCents ?? inv.totalCents;

      await this.prisma.carrierInvoice.update({
        where: { id: inv.id },
        data: {
          status: 'paid',
          paidCents: amount,
          paidAt: new Date(),
          paymentReference: params.paymentReference || `BATCH-${payDate.toISOString().slice(0, 10)}`,
        },
      });

      // Update shipment financial summaries
      const shipmentIds = [...new Set(inv.lineItems.map((l: { shipmentId: string | null }) => l.shipmentId).filter(Boolean) as string[])];
      if (shipmentIds.length > 0) {
        await this.prisma.shipmentFinancialSummary.updateMany({
          where: { shipmentId: { in: shipmentIds } },
          data: { carrierPaymentStatus: 'paid' },
        });
      }

      totalPaidCents += amount;

      const existing = byCarrier.get(inv.carrierId);
      if (existing) {
        existing.invoiceCount++;
        existing.paidCents += amount;
      } else {
        byCarrier.set(inv.carrierId, {
          carrierId: inv.carrierId,
          carrierName: inv.carrier.name,
          invoiceCount: 1,
          paidCents: amount,
        });
      }
    }

    return {
      paidCount: invoices.length,
      totalPaidCents,
      carriers: Array.from(byCarrier.values()),
    };
  }

  /**
   * Get summary of scheduled payments (for dashboard/preview).
   */
  async getScheduledSummary(): Promise<{
    totalScheduled: number;
    totalCents: number;
    batches: Array<{
      scheduledPayDate: Date;
      invoiceCount: number;
      totalCents: number;
      carriers: Array<{ carrierId: string; carrierName: string; invoiceCount: number; totalCents: number }>;
    }>;
  }> {
    const scheduled = await this.prisma.carrierInvoice.findMany({
      where: { status: 'scheduled' },
      include: { carrier: { select: { id: true, name: true } } },
      orderBy: { scheduledPayDate: 'asc' },
    });

    // Group by scheduledPayDate
    const byDate = new Map<string, {
      scheduledPayDate: Date;
      invoiceCount: number;
      totalCents: number;
      carriers: Map<string, { carrierId: string; carrierName: string; invoiceCount: number; totalCents: number }>;
    }>();

    for (const inv of scheduled) {
      const dateKey = inv.scheduledPayDate?.toISOString().slice(0, 10) ?? 'unscheduled';
      const amount = inv.approvedCents ?? inv.totalCents;

      let batch = byDate.get(dateKey);
      if (!batch) {
        batch = {
          scheduledPayDate: inv.scheduledPayDate ?? new Date(),
          invoiceCount: 0,
          totalCents: 0,
          carriers: new Map(),
        };
        byDate.set(dateKey, batch);
      }

      batch.invoiceCount++;
      batch.totalCents += amount;

      const carrier = batch.carriers.get(inv.carrierId);
      if (carrier) {
        carrier.invoiceCount++;
        carrier.totalCents += amount;
      } else {
        batch.carriers.set(inv.carrierId, {
          carrierId: inv.carrierId,
          carrierName: inv.carrier.name,
          invoiceCount: 1,
          totalCents: amount,
        });
      }
    }

    return {
      totalScheduled: scheduled.length,
      totalCents: scheduled.reduce((s: number, i: { approvedCents: number | null; totalCents: number }) => s + (i.approvedCents ?? i.totalCents), 0),
      batches: Array.from(byDate.values()).map(b => ({
        ...b,
        carriers: Array.from(b.carriers.values()),
      })),
    };
  }
}
