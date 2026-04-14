import { PrismaClient } from '@prisma/client';

export interface CreditCheckResult {
  customerId: string;
  customerName: string;
  creditLimitCents: number | null;
  outstandingBalanceCents: number;
  availableCreditCents: number | null;
  passed: boolean;
  reason?: string;
}

export interface ICreditCheckService {
  checkCredit(customerId: string, additionalAmountCents?: number): Promise<CreditCheckResult>;
}

export class CreditCheckService implements ICreditCheckService {
  constructor(private prisma: PrismaClient) {}

  async checkCredit(customerId: string, additionalAmountCents = 0): Promise<CreditCheckResult> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, name: true, creditLimitCents: true },
    });

    if (!customer) throw new Error('Customer not found');

    // Sum all unpaid invoices (sent, approved, overdue - not voided or paid)
    const unpaidInvoices = await this.prisma.invoice.aggregate({
      where: {
        customerId,
        status: { in: ['draft', 'approved', 'sent', 'overdue', 'partial'] },
      },
      _sum: { totalCents: true },
    });

    const outstandingBalanceCents = unpaidInvoices._sum.totalCents ?? 0;

    // No credit limit = unlimited
    if (customer.creditLimitCents == null) {
      return {
        customerId: customer.id,
        customerName: customer.name,
        creditLimitCents: null,
        outstandingBalanceCents,
        availableCreditCents: null,
        passed: true,
      };
    }

    const availableCreditCents = customer.creditLimitCents - outstandingBalanceCents;
    const wouldExceed = (outstandingBalanceCents + additionalAmountCents) > customer.creditLimitCents;

    return {
      customerId: customer.id,
      customerName: customer.name,
      creditLimitCents: customer.creditLimitCents,
      outstandingBalanceCents,
      availableCreditCents,
      passed: !wouldExceed,
      reason: wouldExceed
        ? `Outstanding balance ($${(outstandingBalanceCents / 100).toFixed(2)}) plus new amount ($${(additionalAmountCents / 100).toFixed(2)}) exceeds credit limit ($${(customer.creditLimitCents / 100).toFixed(2)})`
        : undefined,
    };
  }
}
