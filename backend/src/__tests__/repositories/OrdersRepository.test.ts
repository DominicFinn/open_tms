import { OrdersRepository } from '../../repositories/OrdersRepository';

function buildPrisma() {
  return {
    order: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    orderLineItem: {
      create: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
    },
    trackableUnit: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  } as any;
}

describe('OrdersRepository', () => {
  describe('findByCustomerId', () => {
    it('always filters out archived orders', async () => {
      const prisma = buildPrisma();
      const repo = new OrdersRepository(prisma);

      await repo.findByCustomerId('cust-1');

      const where = prisma.order.findMany.mock.calls[0][0].where;
      expect(where).toEqual({ customerId: 'cust-1', archived: false });
    });

    it('layers on status when supplied', async () => {
      const prisma = buildPrisma();
      const repo = new OrdersRepository(prisma);

      await repo.findByCustomerId('cust-1', { status: 'confirmed' });

      const where = prisma.order.findMany.mock.calls[0][0].where;
      expect(where.status).toBe('confirmed');
    });

    it('paginates with sensible defaults (50, 0) and accepts overrides', async () => {
      const prisma = buildPrisma();
      const repo = new OrdersRepository(prisma);

      await repo.findByCustomerId('cust-1');
      let args = prisma.order.findMany.mock.calls[0][0];
      expect(args.take).toBe(50);
      expect(args.skip).toBe(0);

      await repo.findByCustomerId('cust-1', { limit: 25, offset: 100 });
      args = prisma.order.findMany.mock.calls[1][0];
      expect(args.take).toBe(25);
      expect(args.skip).toBe(100);
    });

    it('only includes orphan line items (trackableUnitId is null)', async () => {
      const prisma = buildPrisma();
      const repo = new OrdersRepository(prisma);

      await repo.findByCustomerId('cust-1');

      const include = prisma.order.findMany.mock.calls[0][0].include;
      expect(include.lineItems.where).toEqual({ trackableUnitId: null });
    });
  });

  describe('findById', () => {
    it('hides archived orders', async () => {
      const prisma = buildPrisma();
      const repo = new OrdersRepository(prisma);

      await repo.findById('o-1');

      const where = prisma.order.findFirst.mock.calls[0][0].where;
      expect(where).toEqual({ id: 'o-1', archived: false });
    });
  });

  describe('archive', () => {
    it('flips archived=true, stamps archivedAt, and moves status to archived', async () => {
      const prisma = buildPrisma();
      const repo = new OrdersRepository(prisma);

      await repo.archive('o-1');

      const args = prisma.order.update.mock.calls[0][0];
      expect(args.where).toEqual({ id: 'o-1' });
      expect(args.data.archived).toBe(true);
      expect(args.data.status).toBe('archived');
      expect(args.data.archivedAt).toBeInstanceOf(Date);
    });
  });

  describe('validateLocation', () => {
    it('stamps the origin id, marks it validated, and clears originData', async () => {
      const prisma = buildPrisma();
      const repo = new OrdersRepository(prisma);

      await repo.validateLocation('o-1', 'origin', 'loc-7');

      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 'o-1' },
        data: { originId: 'loc-7', originValidated: true, originData: null },
      });
    });

    it('stamps destination instead and only touches destination fields', async () => {
      const prisma = buildPrisma();
      const repo = new OrdersRepository(prisma);

      await repo.validateLocation('o-1', 'destination', 'loc-9');

      const data = prisma.order.update.mock.calls[0][0].data;
      expect(data).toEqual({
        destinationId: 'loc-9',
        destinationValidated: true,
        destinationData: null,
      });
      expect(data.originId).toBeUndefined();
      expect(data.originValidated).toBeUndefined();
    });
  });

  describe('addTrackableUnit', () => {
    it('uses sequence 1 when the order has no units yet', async () => {
      const prisma = buildPrisma();
      prisma.trackableUnit.findMany.mockResolvedValue([]);
      const repo = new OrdersRepository(prisma);

      await repo.addTrackableUnit('o-1', { unitType: 'pallet', identifier: 'PAL-1', lineItems: [] });

      const data = prisma.trackableUnit.create.mock.calls[0][0].data;
      expect(data.sequenceNumber).toBe(1);
    });

    it('increments past the highest existing sequence', async () => {
      const prisma = buildPrisma();
      prisma.trackableUnit.findMany.mockResolvedValue([{ sequenceNumber: 7 }]);
      const repo = new OrdersRepository(prisma);

      await repo.addTrackableUnit('o-1', { unitType: 'carton', identifier: 'CTN-1', lineItems: [] });

      const data = prisma.trackableUnit.create.mock.calls[0][0].data;
      expect(data.sequenceNumber).toBe(8);
    });

    it('queries for the highest existing sequence number, descending', async () => {
      const prisma = buildPrisma();
      const repo = new OrdersRepository(prisma);

      await repo.addTrackableUnit('o-1', { unitType: 'pallet', identifier: 'PAL-1', lineItems: [] });

      const findArgs = prisma.trackableUnit.findMany.mock.calls[0][0];
      expect(findArgs.where).toEqual({ orderId: 'o-1' });
      expect(findArgs.orderBy).toEqual({ sequenceNumber: 'desc' });
      expect(findArgs.take).toBe(1);
    });
  });

  describe('moveLineItemToUnit', () => {
    it('reparents the line item to the target trackable unit', async () => {
      const prisma = buildPrisma();
      const repo = new OrdersRepository(prisma);

      await repo.moveLineItemToUnit('li-1', 'tu-9');

      expect(prisma.orderLineItem.update).toHaveBeenCalledWith({
        where: { id: 'li-1' },
        data: { trackableUnitId: 'tu-9' },
      });
    });
  });
});
