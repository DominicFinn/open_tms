import {
  FinancialQueryRepository,
  CreditNoteRepository,
} from '../../repositories/FinancialQueryRepository';

function buildPrisma() {
  return {
    financialQuery: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
    },
    creditNote: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
    },
  } as any;
}

describe('FinancialQueryRepository', () => {
  describe('findAll', () => {
    it('translates filters into a where clause and orders by createdAt desc', async () => {
      const prisma = buildPrisma();
      const repo = new FinancialQueryRepository(prisma);

      await repo.findAll({
        orgId: 'org-1',
        queryType: 'cargo_discrepancy',
        status: 'open',
        invoiceId: 'inv-1',
      });

      expect(prisma.financialQuery.findMany).toHaveBeenCalledWith({
        where: {
          orgId: 'org-1',
          queryType: 'cargo_discrepancy',
          status: 'open',
          invoiceId: 'inv-1',
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('omits filters that are not supplied', async () => {
      const prisma = buildPrisma();
      const repo = new FinancialQueryRepository(prisma);

      await repo.findAll({});

      expect(prisma.financialQuery.findMany.mock.calls[0][0].where).toEqual({});
    });
  });

  describe('getNextQueryNumber', () => {
    it('starts at QRY-0001 when there are no prior queries', async () => {
      const prisma = buildPrisma();
      const repo = new FinancialQueryRepository(prisma);

      const result = await repo.getNextQueryNumber('org-1');
      expect(result).toBe('QRY-0001');
    });

    it('increments and zero-pads the existing sequence', async () => {
      const prisma = buildPrisma();
      prisma.financialQuery.findFirst.mockResolvedValue({ queryNumber: 'QRY-0042' });
      const repo = new FinancialQueryRepository(prisma);

      const result = await repo.getNextQueryNumber('org-1');
      expect(result).toBe('QRY-0043');
    });

    it('handles four-digit sequences correctly', async () => {
      const prisma = buildPrisma();
      prisma.financialQuery.findFirst.mockResolvedValue({ queryNumber: 'QRY-9999' });
      const repo = new FinancialQueryRepository(prisma);

      const result = await repo.getNextQueryNumber('org-1');
      expect(result).toBe('QRY-10000');
    });

    it('scopes the lookup to the requested org', async () => {
      const prisma = buildPrisma();
      const repo = new FinancialQueryRepository(prisma);

      await repo.getNextQueryNumber('org-77');

      expect(prisma.financialQuery.findFirst.mock.calls[0][0].where).toEqual({ orgId: 'org-77' });
    });
  });
});

describe('CreditNoteRepository', () => {
  describe('findAll', () => {
    it('filters by orgId and orders by createdAt desc', async () => {
      const prisma = buildPrisma();
      const repo = new CreditNoteRepository(prisma);

      await repo.findAll('org-1');

      expect(prisma.creditNote.findMany).toHaveBeenCalledWith({
        where: { orgId: 'org-1' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('getNextCreditNoteNumber', () => {
    it('starts at CN-0001 when no prior notes exist', async () => {
      const prisma = buildPrisma();
      const repo = new CreditNoteRepository(prisma);

      const result = await repo.getNextCreditNoteNumber('org-1');
      expect(result).toBe('CN-0001');
    });

    it('increments the sequence', async () => {
      const prisma = buildPrisma();
      prisma.creditNote.findFirst.mockResolvedValue({ creditNoteNumber: 'CN-0007' });
      const repo = new CreditNoteRepository(prisma);

      const result = await repo.getNextCreditNoteNumber('org-1');
      expect(result).toBe('CN-0008');
    });
  });
});
