import { TenderRepository } from '../../repositories/TenderRepository';

function buildPrisma() {
  return {
    tender: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
    },
    tenderOffer: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
    },
    tenderBid: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
    },
  } as any;
}

describe('TenderRepository', () => {
  describe('findAll', () => {
    it('passes scalar filters through unchanged', async () => {
      const prisma = buildPrisma();
      const repo = new TenderRepository(prisma);

      await repo.findAll({ status: 'open', strategy: 'broadcast', shipmentId: 's-1' });

      const where = prisma.tender.findMany.mock.calls[0][0].where;
      expect(where).toEqual({
        status: 'open',
        strategy: 'broadcast',
        shipmentId: 's-1',
      });
    });

    it('translates carrierId into a `some` filter on offers', async () => {
      const prisma = buildPrisma();
      const repo = new TenderRepository(prisma);

      await repo.findAll({ carrierId: 'car-1' });

      const where = prisma.tender.findMany.mock.calls[0][0].where;
      expect(where).toEqual({
        offers: { some: { carrierId: 'car-1' } },
      });
    });

    it('returns an empty where clause when no filters supplied', async () => {
      const prisma = buildPrisma();
      const repo = new TenderRepository(prisma);

      await repo.findAll();

      expect(prisma.tender.findMany.mock.calls[0][0].where).toEqual({});
    });
  });

  describe('findByShipmentId', () => {
    it('delegates to findAll with the shipmentId filter', async () => {
      const prisma = buildPrisma();
      const repo = new TenderRepository(prisma);

      await repo.findByShipmentId('ship-1', 'org-1');

      expect(prisma.tender.findMany.mock.calls[0][0].where).toEqual({
        shipment: { orgId: 'org-1' },
        shipmentId: 'ship-1',
      });
    });
  });

  describe('getNextReference', () => {
    it('returns TND-001 when no prior tenders exist', async () => {
      const prisma = buildPrisma();
      const repo = new TenderRepository(prisma);

      const result = await repo.getNextReference();
      expect(result).toBe('TND-001');
    });

    it('increments and zero-pads to 3 digits', async () => {
      const prisma = buildPrisma();
      prisma.tender.findFirst.mockResolvedValue({ reference: 'TND-007' });
      const repo = new TenderRepository(prisma);

      const result = await repo.getNextReference();
      expect(result).toBe('TND-008');
    });

    it('expands beyond 3 digits when sequence overflows', async () => {
      const prisma = buildPrisma();
      prisma.tender.findFirst.mockResolvedValue({ reference: 'TND-999' });
      const repo = new TenderRepository(prisma);

      const result = await repo.getNextReference();
      expect(result).toBe('TND-1000');
    });
  });

  describe('findActiveOffersForCarrier', () => {
    it('only returns offers in sent or viewed status on open tenders', async () => {
      const prisma = buildPrisma();
      const repo = new TenderRepository(prisma);

      await repo.findActiveOffersForCarrier('car-1');

      const where = prisma.tenderOffer.findMany.mock.calls[0][0].where;
      expect(where.carrierId).toBe('car-1');
      expect(where.status).toEqual({ in: ['sent', 'viewed'] });
      expect(where.tender).toEqual({ status: 'open' });
    });
  });

  describe('findExpiredOffers', () => {
    it('filters by expiresAt <= now and active offer status', async () => {
      const prisma = buildPrisma();
      const repo = new TenderRepository(prisma);

      await repo.findExpiredOffers();

      const where = prisma.tenderOffer.findMany.mock.calls[0][0].where;
      expect(where.status).toEqual({ in: ['sent', 'viewed'] });
      expect(where.expiresAt.lte).toBeInstanceOf(Date);
    });
  });

  describe('findBidsByTenderId', () => {
    it('orders bids by rate ascending so the cheapest is first', async () => {
      const prisma = buildPrisma();
      const repo = new TenderRepository(prisma);

      await repo.findBidsByTenderId('t-1', 'org-1');

      expect(prisma.tenderBid.findMany.mock.calls[0][0].orderBy).toEqual({ rate: 'asc' });
    });
  });

  describe('org scoping', () => {
    it('reaches a tender only through its shipment org', async () => {
      const prisma = buildPrisma();
      const repo = new TenderRepository(prisma);

      await repo.findById('t-1', 'org-1');

      expect(prisma.tender.findUnique.mock.calls[0][0].where).toEqual({ id: 't-1', shipment: { orgId: 'org-1' } });
    });

    it('returns null for a tender id from another org', async () => {
      const prisma = buildPrisma();
      prisma.tender.findUnique.mockResolvedValue(null);
      const repo = new TenderRepository(prisma);

      await expect(repo.findById('t-other-org', 'org-1')).resolves.toBeNull();
    });

    it('scopes offer and bid lookups and writes through tender and shipment', async () => {
      const prisma = buildPrisma();
      const repo = new TenderRepository(prisma);
      const scoped = { tender: { shipment: { orgId: 'org-1' } } };

      await repo.findOfferById('o-1', 'org-1');
      await repo.updateOffer('o-1', 'org-1', {});
      await repo.findBidById('b-1', 'org-1');
      await repo.updateBid('b-1', 'org-1', {});
      await repo.update('t-1', 'org-1', {});

      expect(prisma.tenderOffer.findUnique.mock.calls[0][0].where).toEqual({ id: 'o-1', ...scoped });
      expect(prisma.tenderOffer.update.mock.calls[0][0].where).toEqual({ id: 'o-1', ...scoped });
      expect(prisma.tenderBid.findUnique.mock.calls[0][0].where).toEqual({ id: 'b-1', ...scoped });
      expect(prisma.tenderBid.update.mock.calls[0][0].where).toEqual({ id: 'b-1', ...scoped });
      expect(prisma.tender.update.mock.calls[0][0].where).toEqual({ id: 't-1', shipment: { orgId: 'org-1' } });
    });

    it('adds the shipment org to findAll when given', async () => {
      const prisma = buildPrisma();
      const repo = new TenderRepository(prisma);

      await repo.findAll({ orgId: 'org-1', status: 'open' });

      expect(prisma.tender.findMany.mock.calls[0][0].where).toEqual({ shipment: { orgId: 'org-1' }, status: 'open' });
    });
  });
});
