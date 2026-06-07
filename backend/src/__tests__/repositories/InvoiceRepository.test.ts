import { InvoiceRepository, PaymentRepository } from '../../repositories/InvoiceRepository';

function buildPrisma() {
  return {
    invoice: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
    },
    invoiceLineItem: {
      create: jest.fn(),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    payment: {
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
  } as any;
}

describe('InvoiceRepository', () => {
  describe('create', () => {
    it('applies default currency, terms, and issueDate', async () => {
      const prisma = buildPrisma();
      const repo = new InvoiceRepository(prisma);

      await repo.create({
        orgId: 'org-1',
        invoiceNumber: 'INV-1',
        customerId: 'cust-1',
        subtotalCents: 1000,
        totalCents: 1000,
        balanceCents: 1000,
        dueDate: new Date('2026-06-01'),
      });

      const call = prisma.invoice.create.mock.calls[0][0].data;
      expect(call.currency).toBe('USD');
      expect(call.paymentTermsDays).toBe(30);
      expect(call.taxCents).toBe(0);
      expect(call.issueDate).toBeInstanceOf(Date);
    });
  });

  describe('findAll', () => {
    it('translates filters into the Prisma where clause', async () => {
      const prisma = buildPrisma();
      const repo = new InvoiceRepository(prisma);

      const dueBefore = new Date('2026-06-01');
      const dueAfter = new Date('2026-05-01');
      await repo.findAll({
        orgId: 'org-1',
        customerId: 'cust-1',
        status: 'sent',
        dueBefore,
        dueAfter,
      });

      const where = prisma.invoice.findMany.mock.calls[0][0].where;
      expect(where).toEqual({
        orgId: 'org-1',
        customerId: 'cust-1',
        status: 'sent',
        dueDate: { lte: dueBefore, gte: dueAfter },
      });
    });
  });

  describe('addLineItems', () => {
    it('returns the count from createMany', async () => {
      const prisma = buildPrisma();
      prisma.invoiceLineItem.createMany.mockResolvedValue({ count: 4 });
      const repo = new InvoiceRepository(prisma);

      const result = await repo.addLineItems([
        { invoiceId: 'inv-1', chargeType: 'linehaul', description: 'Linehaul', unitPriceCents: 100, totalCents: 100 },
        { invoiceId: 'inv-1', chargeType: 'fuel_surcharge', description: 'FSC', unitPriceCents: 50, totalCents: 50 },
      ]);

      expect(result).toBe(4);
      const inserted = prisma.invoiceLineItem.createMany.mock.calls[0][0].data;
      expect(inserted).toHaveLength(2);
      expect(inserted[0]).toEqual(
        expect.objectContaining({
          invoiceId: 'inv-1',
          chargeType: 'linehaul',
          quantity: 1,
          currency: 'USD',
        })
      );
    });
  });

  describe('getNextInvoiceNumber', () => {
    it('returns the first sequence number when no prior invoices exist for today', async () => {
      const prisma = buildPrisma();
      prisma.invoice.findFirst.mockResolvedValue(null);
      const repo = new InvoiceRepository(prisma);

      const result = await repo.getNextInvoiceNumber('org-1');
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      expect(result).toBe(`INV-${today}-0001`);
    });

    it('increments the existing sequence number and zero-pads to 4 digits', async () => {
      const prisma = buildPrisma();
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      prisma.invoice.findFirst.mockResolvedValue({ invoiceNumber: `INV-${today}-0042` });
      const repo = new InvoiceRepository(prisma);

      const result = await repo.getNextInvoiceNumber('org-1');
      expect(result).toBe(`INV-${today}-0043`);
    });

    it('scopes the lookup to the requested org', async () => {
      const prisma = buildPrisma();
      const repo = new InvoiceRepository(prisma);

      await repo.getNextInvoiceNumber('org-99');

      const args = prisma.invoice.findFirst.mock.calls[0][0];
      expect(args.where.orgId).toBe('org-99');
    });
  });

  describe('findOverdue', () => {
    it('selects sent and partial_paid invoices past their due date', async () => {
      const prisma = buildPrisma();
      const repo = new InvoiceRepository(prisma);

      await repo.findOverdue();

      const where = prisma.invoice.findMany.mock.calls[0][0].where;
      expect(where.status).toEqual({ in: ['sent', 'partial_paid'] });
      expect(where.dueDate.lt).toBeInstanceOf(Date);
    });
  });
});

describe('PaymentRepository', () => {
  it('applies default currency and receivedDate on create', async () => {
    const prisma = buildPrisma();
    const repo = new PaymentRepository(prisma);

    await repo.create({
      orgId: 'org-1',
      invoiceId: 'inv-1',
      amountCents: 5000,
    });

    const call = prisma.payment.create.mock.calls[0][0].data;
    expect(call.currency).toBe('USD');
    expect(call.receivedDate).toBeInstanceOf(Date);
  });
});
