import { CarrierInvoiceRepository } from '../../repositories/CarrierInvoiceRepository';

function buildPrisma() {
  return {
    carrierInvoice: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
    },
    carrierInvoiceLineItem: {
      create: jest.fn(),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  } as any;
}

describe('CarrierInvoiceRepository', () => {
  describe('create', () => {
    it('applies defaults for currency, terms, and receivedDate', async () => {
      const prisma = buildPrisma();
      const repo = new CarrierInvoiceRepository(prisma);

      await repo.create({
        orgId: 'org-1',
        invoiceNumber: 'C-1',
        carrierId: 'car-1',
        totalCents: 50000,
        dueDate: new Date('2026-06-01'),
      });

      const data = prisma.carrierInvoice.create.mock.calls[0][0].data;
      expect(data.currency).toBe('USD');
      expect(data.paymentTermsDays).toBe(30);
      expect(data.receivedDate).toBeInstanceOf(Date);
    });

    it('persists explicit overrides without mutating them', async () => {
      const prisma = buildPrisma();
      const repo = new CarrierInvoiceRepository(prisma);

      const received = new Date('2026-04-01');
      await repo.create({
        orgId: 'org-1',
        invoiceNumber: 'C-2',
        carrierId: 'car-1',
        totalCents: 1000,
        currency: 'EUR',
        paymentTermsDays: 60,
        receivedDate: received,
        dueDate: new Date('2026-06-01'),
        edi210Content: '<edi>',
        ediTransactionLogId: 'log-1',
      });

      const data = prisma.carrierInvoice.create.mock.calls[0][0].data;
      expect(data.currency).toBe('EUR');
      expect(data.paymentTermsDays).toBe(60);
      expect(data.receivedDate).toBe(received);
      expect(data.edi210Content).toBe('<edi>');
      expect(data.ediTransactionLogId).toBe('log-1');
    });
  });

  describe('findAll', () => {
    it('translates each filter into the where clause', async () => {
      const prisma = buildPrisma();
      const repo = new CarrierInvoiceRepository(prisma);

      await repo.findAll({
        orgId: 'org-1',
        carrierId: 'car-1',
        status: 'matched',
        matchStatus: 'partial_match',
      });

      expect(prisma.carrierInvoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            orgId: 'org-1',
            carrierId: 'car-1',
            status: 'matched',
            matchStatus: 'partial_match',
          },
          orderBy: { receivedDate: 'desc' },
        })
      );
    });

    it('produces an empty where clause when no filters given', async () => {
      const prisma = buildPrisma();
      const repo = new CarrierInvoiceRepository(prisma);

      await repo.findAll({});

      expect(prisma.carrierInvoice.findMany.mock.calls[0][0].where).toEqual({});
    });
  });

  describe('addLineItems', () => {
    it('returns the count and applies USD as the default currency', async () => {
      const prisma = buildPrisma();
      prisma.carrierInvoiceLineItem.createMany.mockResolvedValue({ count: 2 });
      const repo = new CarrierInvoiceRepository(prisma);

      const count = await repo.addLineItems([
        {
          carrierInvoiceId: 'ci-1',
          chargeType: 'linehaul',
          description: 'Linehaul',
          amountCents: 1000,
        },
        {
          carrierInvoiceId: 'ci-1',
          chargeType: 'fuel_surcharge',
          description: 'FSC',
          amountCents: 200,
          currency: 'EUR',
        },
      ]);

      expect(count).toBe(2);
      const inserted = prisma.carrierInvoiceLineItem.createMany.mock.calls[0][0].data;
      expect(inserted[0].currency).toBe('USD');
      expect(inserted[1].currency).toBe('EUR');
    });
  });
});
