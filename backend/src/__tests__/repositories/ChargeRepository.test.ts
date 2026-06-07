import { ChargeRepository } from '../../repositories/ChargeRepository';

function buildPrisma() {
  return {
    charge: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      delete: jest.fn(),
      aggregate: jest.fn().mockResolvedValue({ _sum: { amountCents: 0 } }),
    },
  } as any;
}

describe('ChargeRepository', () => {
  describe('create', () => {
    it('applies default currency, source, and status', async () => {
      const prisma = buildPrisma();
      const repo = new ChargeRepository(prisma);

      await repo.create({
        orgId: 'org-1',
        shipmentId: 's1',
        chargeType: 'linehaul',
        chargeCategory: 'revenue',
        description: 'Linehaul',
        amountCents: 50000,
      });

      expect(prisma.charge.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orgId: 'org-1',
          shipmentId: 's1',
          currency: 'USD',
          source: 'manual',
          status: 'pending',
        }),
      });
    });

    it('respects explicit overrides', async () => {
      const prisma = buildPrisma();
      const repo = new ChargeRepository(prisma);

      await repo.create({
        orgId: 'org-1',
        chargeType: 'fuel_surcharge',
        chargeCategory: 'cost',
        description: 'Fuel surcharge',
        amountCents: 10000,
        currency: 'EUR',
        source: 'tender_bid',
        status: 'approved',
      });

      const call = prisma.charge.create.mock.calls[0][0].data;
      expect(call.currency).toBe('EUR');
      expect(call.source).toBe('tender_bid');
      expect(call.status).toBe('approved');
    });
  });

  describe('findAll', () => {
    it('builds a where clause with only the supplied filters', async () => {
      const prisma = buildPrisma();
      const repo = new ChargeRepository(prisma);

      await repo.findAll({ orgId: 'org-1', status: 'approved', chargeCategory: 'revenue' });

      expect(prisma.charge.findMany).toHaveBeenCalledWith({
        where: { orgId: 'org-1', status: 'approved', chargeCategory: 'revenue' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('translates `shipmentIds` into a Prisma `in` filter', async () => {
      const prisma = buildPrisma();
      const repo = new ChargeRepository(prisma);

      await repo.findAll({ shipmentIds: ['s1', 's2', 's3'], status: 'approved' });

      expect(prisma.charge.findMany).toHaveBeenCalledWith({
        where: { shipmentId: { in: ['s1', 's2', 's3'] }, status: 'approved' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('omits the shipment filter entirely when shipmentIds is empty', async () => {
      const prisma = buildPrisma();
      const repo = new ChargeRepository(prisma);

      await repo.findAll({ shipmentIds: [], status: 'approved' });

      const where = prisma.charge.findMany.mock.calls[0][0].where;
      expect(where.shipmentId).toBeUndefined();
      expect(where.status).toBe('approved');
    });

    it('passes orderId through unchanged', async () => {
      const prisma = buildPrisma();
      const repo = new ChargeRepository(prisma);

      await repo.findAll({ orderId: 'o-1' });

      expect(prisma.charge.findMany.mock.calls[0][0].where).toEqual({ orderId: 'o-1' });
    });
  });

  describe('updateMany', () => {
    it('issues a single bulk update with the in: filter', async () => {
      const prisma = buildPrisma();
      prisma.charge.updateMany.mockResolvedValue({ count: 3 });
      const repo = new ChargeRepository(prisma);

      const result = await repo.updateMany(['c1', 'c2', 'c3'], { status: 'invoiced' });

      expect(prisma.charge.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['c1', 'c2', 'c3'] } },
        data: { status: 'invoiced' },
      });
      expect(result).toEqual({ count: 3 });
    });

    it('skips the DB call entirely for an empty id list', async () => {
      const prisma = buildPrisma();
      const repo = new ChargeRepository(prisma);

      const result = await repo.updateMany([], { status: 'invoiced' });

      expect(prisma.charge.updateMany).not.toHaveBeenCalled();
      expect(result).toEqual({ count: 0 });
    });
  });

  describe('sumByShipment', () => {
    it('returns 0 when there are no matching charges', async () => {
      const prisma = buildPrisma();
      prisma.charge.aggregate.mockResolvedValue({ _sum: { amountCents: null } });
      const repo = new ChargeRepository(prisma);

      const total = await repo.sumByShipment('s1', 'revenue');
      expect(total).toBe(0);
    });

    it('excludes written-off charges from the sum', async () => {
      const prisma = buildPrisma();
      prisma.charge.aggregate.mockResolvedValue({ _sum: { amountCents: 12500 } });
      const repo = new ChargeRepository(prisma);

      await repo.sumByShipment('s1', 'revenue');

      expect(prisma.charge.aggregate).toHaveBeenCalledWith({
        where: { shipmentId: 's1', chargeCategory: 'revenue', status: { not: 'written_off' } },
        _sum: { amountCents: true },
      });
    });
  });
});
