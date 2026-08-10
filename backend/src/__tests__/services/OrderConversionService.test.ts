import { OrderConversionService } from '../../services/OrderConversionService';

function makeOrder(overrides: any = {}) {
  return {
    id: 'order-1',
    orgId: 'test-org',
    orderNumber: 'ORD-001',
    status: 'verified',
    customerId: 'cust-1',
    originId: 'loc-origin',
    destinationId: 'loc-dest',
    requestedPickupDate: null,
    requestedDeliveryDate: null,
    temperatureControl: 'ambient',
    serviceLevel: 'LTL',
    customer: { id: 'cust-1', name: 'Acme' },
    trackableUnits: [],
    lineItems: [],
    ...overrides,
  };
}

function makeTx() {
  return {
    shipment: {
      create: jest.fn().mockResolvedValue({ id: 'ship-1', reference: 'SH-ORD-001', items: [] }),
      update: jest.fn().mockResolvedValue({}),
    },
    orderShipment: { create: jest.fn().mockResolvedValue({}) },
    shipmentStop: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'stop-1' }),
      aggregate: jest.fn().mockResolvedValue({ _max: { sequenceNumber: null } }),
    },
    order: { update: jest.fn().mockResolvedValue({}) },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
}

function makePrisma(order: any, tx = makeTx()) {
  const prisma = {
    order: {
      findUnique: jest.fn().mockResolvedValue(order),
      findMany: jest.fn().mockResolvedValue([order]),
    },
    shipment: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn((fn: Function) => fn(tx)),
  } as any;
  return { prisma, tx };
}

describe('OrderConversionService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('convertOrder', () => {
    it('creates a shipment carrying the order\'s orgId (regression: this was previously missing, causing every call to 500)', async () => {
      const order = makeOrder();
      const { prisma, tx } = makePrisma(order);
      const service = new OrderConversionService(prisma);

      const result = await service.convertOrder('order-1', 'user-1');

      expect(result).toEqual({ shipmentId: 'ship-1' });
      const data = tx.shipment.create.mock.calls[0][0].data;
      expect(data.orgId).toBe('test-org');
      expect(data.customerId).toBe('cust-1');
      expect(data.originId).toBe('loc-origin');
      expect(data.destinationId).toBe('loc-dest');
    });

    it('links the order to the shipment: creates a stop, flips status to assigned, writes an audit log', async () => {
      const order = makeOrder();
      const { prisma, tx } = makePrisma(order);
      const service = new OrderConversionService(prisma);

      await service.convertOrder('order-1', 'user-1');

      expect(tx.shipmentStop.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ locationId: 'loc-dest' }) })
      );
      expect(tx.orderShipment.create).toHaveBeenCalledWith({ data: { orderId: 'order-1', shipmentId: 'ship-1' } });
      expect(tx.order.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'assigned', deliveryStopId: 'stop-1' }) })
      );
      expect(tx.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ userId: 'user-1' }) })
      );
    });

    it('rejects an order that is already assigned', async () => {
      const order = makeOrder({ status: 'assigned' });
      const { prisma } = makePrisma(order);
      const service = new OrderConversionService(prisma);

      await expect(service.convertOrder('order-1')).rejects.toThrow('Order already assigned');
    });

    it('rejects an order missing origin or destination', async () => {
      const order = makeOrder({ originId: null });
      const { prisma } = makePrisma(order);
      const service = new OrderConversionService(prisma);

      await expect(service.convertOrder('order-1')).rejects.toThrow('missing origin or destination');
    });

    it('rejects when the order is not found', async () => {
      const { prisma } = makePrisma(null);
      const service = new OrderConversionService(prisma);

      await expect(service.convertOrder('order-1')).rejects.toThrow('Order not found');
    });
  });

  describe('batchConvert (combine mode)', () => {
    it('combines compatible orders into one shipment with a stop per unique destination', async () => {
      const orderA = makeOrder({ id: 'order-a', orderNumber: 'ORD-A', destinationId: 'loc-dest-1' });
      const orderB = makeOrder({ id: 'order-b', orderNumber: 'ORD-B', destinationId: 'loc-dest-2' });
      const tx = makeTx();
      const prisma = {
        order: { findMany: jest.fn().mockResolvedValue([orderA, orderB]) },
        $transaction: jest.fn((fn: Function) => fn(tx)),
      } as any;
      const service = new OrderConversionService(prisma);

      const result = await service.batchConvert(['order-a', 'order-b'], { mode: 'combine' }, 'user-1');

      expect(result.success).toBe(true);
      expect(result.shipmentIds).toEqual(['ship-1']);
      // One stop created per order in this mock (each has a distinct
      // destination and shipmentStop.findFirst always returns null here).
      expect(tx.shipmentStop.create).toHaveBeenCalledTimes(2);
      expect(tx.order.update).toHaveBeenCalledTimes(2);
    });

    it('rejects combining orders with different origins', async () => {
      const orderA = makeOrder({ id: 'order-a', originId: 'loc-origin-1' });
      const orderB = makeOrder({ id: 'order-b', originId: 'loc-origin-2' });
      const prisma = {
        order: { findMany: jest.fn().mockResolvedValue([orderA, orderB]) },
      } as any;
      const service = new OrderConversionService(prisma);

      const result = await service.batchConvert(['order-a', 'order-b'], { mode: 'combine' });

      expect(result.success).toBe(false);
      expect(result.errors[0]).toMatch(/different origins/);
    });
  });

  describe('addOrdersToShipment', () => {
    function makeShipment(overrides: any = {}) {
      return {
        id: 'ship-1',
        orgId: 'test-org',
        reference: 'SH-EXISTING',
        customerId: 'cust-1',
        originId: 'loc-origin',
        status: 'draft',
        items: [{ orderId: 'order-existing', orderNumber: 'ORD-EXISTING' }],
        ...overrides,
      };
    }

    it('appends to the existing items array rather than overwriting it', async () => {
      const order = makeOrder();
      const tx = makeTx();
      const shipment = makeShipment();
      const prisma = {
        shipment: { findFirst: jest.fn().mockResolvedValue(shipment) },
        order: { findMany: jest.fn().mockResolvedValue([order]) },
        $transaction: jest.fn((fn: Function) => fn(tx)),
      } as any;
      const service = new OrderConversionService(prisma);

      const result = await service.addOrdersToShipment('test-org', 'ship-1', ['order-1'], 'user-1');

      expect(result.success).toBe(true);
      const itemsWritten = tx.shipment.update.mock.calls[0][0].data.items;
      expect(itemsWritten).toHaveLength(2);
      expect(itemsWritten[0].orderId).toBe('order-existing');
      expect(itemsWritten[1].orderId).toBe('order-1');
    });

    it('rejects orders with a different origin than the shipment', async () => {
      const order = makeOrder({ originId: 'some-other-origin' });
      const shipment = makeShipment();
      const prisma = {
        shipment: { findFirst: jest.fn().mockResolvedValue(shipment) },
        order: { findMany: jest.fn().mockResolvedValue([order]) },
      } as any;
      const service = new OrderConversionService(prisma);

      const result = await service.addOrdersToShipment('test-org', 'ship-1', ['order-1']);

      expect(result.success).toBe(false);
      expect(result.errors[0]).toMatch(/different origin/);
    });

    it('rejects orders with a different customer than the shipment', async () => {
      const order = makeOrder({ customerId: 'some-other-customer' });
      const shipment = makeShipment();
      const prisma = {
        shipment: { findFirst: jest.fn().mockResolvedValue(shipment) },
        order: { findMany: jest.fn().mockResolvedValue([order]) },
      } as any;
      const service = new OrderConversionService(prisma);

      const result = await service.addOrdersToShipment('test-org', 'ship-1', ['order-1']);

      expect(result.success).toBe(false);
      expect(result.errors[0]).toMatch(/different customer/);
    });

    it('rejects adding orders to a shipment that has already left draft/ready', async () => {
      const shipment = makeShipment({ status: 'in_progress' });
      const prisma = {
        shipment: { findFirst: jest.fn().mockResolvedValue(shipment) },
      } as any;
      const service = new OrderConversionService(prisma);

      const result = await service.addOrdersToShipment('test-org', 'ship-1', ['order-1']);

      expect(result.success).toBe(false);
      expect(result.message).toMatch(/already left draft\/ready/);
    });

    it('reuses an existing stop for a destination rather than creating a duplicate', async () => {
      const order = makeOrder();
      const tx = makeTx();
      tx.shipmentStop.findFirst.mockResolvedValue({ id: 'existing-stop-1' });
      const shipment = makeShipment();
      const prisma = {
        shipment: { findFirst: jest.fn().mockResolvedValue(shipment) },
        order: { findMany: jest.fn().mockResolvedValue([order]) },
        $transaction: jest.fn((fn: Function) => fn(tx)),
      } as any;
      const service = new OrderConversionService(prisma);

      await service.addOrdersToShipment('test-org', 'ship-1', ['order-1']);

      expect(tx.shipmentStop.create).not.toHaveBeenCalled();
      expect(tx.order.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ deliveryStopId: 'existing-stop-1' }) })
      );
    });
  });

  describe('checkCompatibility', () => {
    it('flags different origins as an error and different customers as a warning only', async () => {
      const orderA = makeOrder({ id: 'order-a', customerId: 'cust-a', originId: 'loc-origin-1' });
      const orderB = makeOrder({ id: 'order-b', customerId: 'cust-b', originId: 'loc-origin-2' });
      const prisma = {
        order: {
          findMany: jest.fn().mockResolvedValue([
            { ...orderA, origin: null, destination: null },
            { ...orderB, origin: null, destination: null },
          ]),
        },
      } as any;
      const service = new OrderConversionService(prisma);

      const check = await service.checkCompatibility(['order-a', 'order-b']);

      expect(check.compatible).toBe(false);
      expect(check.errors[0]).toMatch(/different origins/);
      expect(check.warnings.some((w) => w.includes('different customers'))).toBe(true);
    });
  });
});
