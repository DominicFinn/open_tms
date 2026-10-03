import { TradingPartnerRepository } from '../../repositories/TradingPartnerRepository';

function buildPrisma() {
  return {
    tradingPartner: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
    },
    tradingPartnerTransaction: {
      update: jest.fn(),
      delete: jest.fn(),
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

describe('TradingPartnerRepository — org scoping', () => {
  it('keys partner reads and writes on the caller org', async () => {
    const prisma = buildPrisma();
    const repo = new TradingPartnerRepository(prisma);

    await repo.findById('p-1', 'org-1');
    await repo.update('p-1', 'org-1', { name: 'X' });
    await repo.softDelete('p-1', 'org-1', null);
    await repo.updateLastPolled('p-1', 'org-1');

    expect(prisma.tradingPartner.findUnique.mock.calls[0][0].where).toEqual({ id: 'p-1', orgId: 'org-1' });
    for (const call of prisma.tradingPartner.update.mock.calls) {
      expect(call[0].where).toEqual({ id: 'p-1', orgId: 'org-1' });
    }
  });

  it('returns null for a partner id that belongs to another org', async () => {
    const prisma = buildPrisma();
    prisma.tradingPartner.findUnique.mockResolvedValue(null);
    const repo = new TradingPartnerRepository(prisma);

    await expect(repo.findById('p-other-org', 'org-1')).resolves.toBeNull();
  });

  it('always filters the partner list by org', async () => {
    const prisma = buildPrisma();
    const repo = new TradingPartnerRepository(prisma);

    await repo.findAll({ orgId: 'org-1' });

    expect(prisma.tradingPartner.findMany.mock.calls[0][0].where).toEqual({ orgId: 'org-1', deletedAt: null });
  });

  it('scopes transaction config writes through the partner org', async () => {
    const prisma = buildPrisma();
    const repo = new TradingPartnerRepository(prisma);

    await repo.updateTransaction('t-1', 'org-1', { enabled: false });
    await repo.removeTransaction('t-1', 'org-1');

    expect(prisma.tradingPartnerTransaction.update.mock.calls[0][0].where).toEqual({ id: 't-1', partner: { orgId: 'org-1' } });
    expect(prisma.tradingPartnerTransaction.delete.mock.calls[0][0].where).toEqual({ id: 't-1', partner: { orgId: 'org-1' } });
  });

  it('keys log reads and writes on the caller org', async () => {
    const prisma = buildPrisma();
    const repo = new TradingPartnerRepository(prisma);

    await repo.findLogById('log-1', 'org-1');
    await repo.updateLog('log-1', 'org-1', { status: 'success' });

    expect(prisma.ediTransactionLog.findUnique.mock.calls[0][0].where).toEqual({ id: 'log-1', orgId: 'org-1' });
    expect(prisma.ediTransactionLog.update).toHaveBeenCalledWith({ where: { id: 'log-1', orgId: 'org-1' }, data: { status: 'success' } });
  });
});
