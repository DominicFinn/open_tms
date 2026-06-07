import { TradingPartnerRepository } from '../../repositories/TradingPartnerRepository';

function buildPrisma() {
  return {
    tradingPartner: {
      findUnique: jest.fn(),
    },
    ediTransactionLog: {
      create: jest.fn().mockResolvedValue({ id: 'log-1' }),
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn(),
      aggregate: jest.fn().mockResolvedValue({ _sum: { entitiesCreated: 0 } }),
    },
  } as any;
}

describe('TradingPartnerRepository — EDI logs', () => {
  describe('createLog', () => {
    it('passes orgId straight through when caller supplies it', async () => {
      const prisma = buildPrisma();
      const repo = new TradingPartnerRepository(prisma);

      await repo.createLog({
        orgId: 'org-1',
        partnerId: 'p-1',
        transactionType: '850',
        direction: 'inbound',
        status: 'success',
      });

      expect(prisma.ediTransactionLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ orgId: 'org-1', partnerId: 'p-1' }),
      });
    });

    it('writes a row even when caller passes no orgId (legacy path)', async () => {
      const prisma = buildPrisma();
      const repo = new TradingPartnerRepository(prisma);

      await repo.createLog({
        partnerId: 'p-1',
        transactionType: '850',
        direction: 'inbound',
        status: 'success',
      });

      // No auto-derivation today (Customer/Carrier/Partner have no orgId
      // column), so the row lands with orgId undefined and the read
      // endpoints tolerate it.
      expect(prisma.ediTransactionLog.create).toHaveBeenCalled();
      const call = prisma.ediTransactionLog.create.mock.calls[0][0];
      expect(call.data.orgId).toBeUndefined();
    });
  });

  describe('findLogs', () => {
    it('filters by orgId when supplied', async () => {
      const prisma = buildPrisma();
      const repo = new TradingPartnerRepository(prisma);

      await repo.findLogs({ orgId: 'org-1', status: 'error' });

      expect(prisma.ediTransactionLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { orgId: 'org-1', status: 'error' },
        })
      );
    });

    it('omits orgId from the where clause when not supplied (legacy callers)', async () => {
      const prisma = buildPrisma();
      const repo = new TradingPartnerRepository(prisma);

      await repo.findLogs({ partnerId: 'p-1' });

      const where = prisma.ediTransactionLog.findMany.mock.calls[0][0].where;
      expect(where.orgId).toBeUndefined();
      expect(where.partnerId).toBe('p-1');
    });
  });

  describe('findLogsWithPagination', () => {
    it('threads orgId into both the findMany and count queries', async () => {
      const prisma = buildPrisma();
      const repo = new TradingPartnerRepository(prisma);

      await repo.findLogsWithPagination({ orgId: 'org-1', direction: 'inbound' });

      const findCall = prisma.ediTransactionLog.findMany.mock.calls[0][0];
      const countCall = prisma.ediTransactionLog.count.mock.calls[0][0];
      expect(findCall.where.orgId).toBe('org-1');
      expect(countCall.where.orgId).toBe('org-1');
    });

    it('translates `search` into a case-insensitive OR across fileName / shipmentReference / invoiceNumber', async () => {
      const prisma = buildPrisma();
      const repo = new TradingPartnerRepository(prisma);

      await repo.findLogsWithPagination({ orgId: 'org-1', search: 'INV-42' });

      const where = prisma.ediTransactionLog.findMany.mock.calls[0][0].where;
      expect(where.OR).toEqual([
        { fileName: { contains: 'INV-42', mode: 'insensitive' } },
        { shipmentReference: { contains: 'INV-42', mode: 'insensitive' } },
        { invoiceNumber: { contains: 'INV-42', mode: 'insensitive' } },
      ]);
    });
  });

  describe('getLogStats', () => {
    it('scopes every count and aggregate by orgId', async () => {
      const prisma = buildPrisma();
      const repo = new TradingPartnerRepository(prisma);

      await repo.getLogStats({ orgId: 'org-1' });

      // First count is the total — every subsequent call should keep orgId
      // in its where clause too.
      for (const call of prisma.ediTransactionLog.count.mock.calls) {
        expect(call[0].where.orgId).toBe('org-1');
      }
      expect(prisma.ediTransactionLog.aggregate.mock.calls[0][0].where.orgId).toBe('org-1');
    });
  });
});
