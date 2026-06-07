import { QuoteRepository } from '../../repositories/QuoteRepository';

function buildPrisma() {
  return {
    quote: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
    },
    quoteLineItem: {
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  } as any;
}

describe('QuoteRepository', () => {
  describe('create', () => {
    it('applies defaults for serviceLevel, currency, and validFrom', async () => {
      const prisma = buildPrisma();
      const repo = new QuoteRepository(prisma);

      await repo.create({
        orgId: 'org-1',
        quoteNumber: 'QTE-0001',
        customerId: 'cust-1',
        totalRevenueCents: 5000,
        totalCostCents: 4000,
        marginCents: 1000,
        marginPercent: 20,
        validUntil: new Date('2026-06-01'),
      });

      const data = prisma.quote.create.mock.calls[0][0].data;
      expect(data.serviceLevel).toBe('FTL');
      expect(data.currency).toBe('USD');
      expect(data.validFrom).toBeInstanceOf(Date);
    });
  });

  describe('findAll', () => {
    it('passes orgId, customerId, and status into where', async () => {
      const prisma = buildPrisma();
      const repo = new QuoteRepository(prisma);

      await repo.findAll({ orgId: 'org-1', customerId: 'cust-1', status: 'sent' });

      expect(prisma.quote.findMany.mock.calls[0][0].where).toEqual({
        orgId: 'org-1',
        customerId: 'cust-1',
        status: 'sent',
      });
    });
  });

  describe('addLineItems', () => {
    it('defaults quantity to 1 and currency to USD', async () => {
      const prisma = buildPrisma();
      prisma.quoteLineItem.createMany.mockResolvedValue({ count: 1 });
      const repo = new QuoteRepository(prisma);

      await repo.addLineItems([
        {
          quoteId: 'q-1',
          chargeType: 'linehaul',
          description: 'Linehaul',
          amountCents: 1000,
        },
      ]);

      const inserted = prisma.quoteLineItem.createMany.mock.calls[0][0].data[0];
      expect(inserted.quantity).toBe(1);
      expect(inserted.currency).toBe('USD');
    });

    it('respects an explicit quantity', async () => {
      const prisma = buildPrisma();
      const repo = new QuoteRepository(prisma);

      await repo.addLineItems([
        { quoteId: 'q-1', chargeType: 'pallet', description: 'Pallet', amountCents: 200, quantity: 5 },
      ]);

      expect(prisma.quoteLineItem.createMany.mock.calls[0][0].data[0].quantity).toBe(5);
    });
  });

  describe('getNextQuoteNumber', () => {
    it('returns QTE-0001 when no prior quote exists', async () => {
      const prisma = buildPrisma();
      const repo = new QuoteRepository(prisma);

      const result = await repo.getNextQuoteNumber('org-1');
      expect(result).toBe('QTE-0001');
    });

    it('increments and zero-pads the sequence', async () => {
      const prisma = buildPrisma();
      prisma.quote.findFirst.mockResolvedValue({ quoteNumber: 'QTE-0042' });
      const repo = new QuoteRepository(prisma);

      const result = await repo.getNextQuoteNumber('org-1');
      expect(result).toBe('QTE-0043');
    });

    it('handles five-digit sequences correctly', async () => {
      const prisma = buildPrisma();
      prisma.quote.findFirst.mockResolvedValue({ quoteNumber: 'QTE-9999' });
      const repo = new QuoteRepository(prisma);

      const result = await repo.getNextQuoteNumber('org-1');
      expect(result).toBe('QTE-10000');
    });

    it('scopes the lookup by orgId', async () => {
      const prisma = buildPrisma();
      const repo = new QuoteRepository(prisma);

      await repo.getNextQuoteNumber('org-77');

      expect(prisma.quote.findFirst.mock.calls[0][0].where).toEqual({ orgId: 'org-77' });
    });
  });
});
