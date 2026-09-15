import { OrderConversionService } from '../../services/OrderConversionService';
import { CONVERT_ORDER_TO_SHIPMENT } from '../../commands/orders/ConvertOrderToShipmentCommand';
import { COMBINE_ORDERS_INTO_SHIPMENT } from '../../commands/orders/CombineOrdersIntoShipmentCommand';
import { SPLIT_ORDER } from '../../commands/orders/SplitOrderCommand';
import { ADD_ORDERS_TO_SHIPMENT } from '../../commands/orders/AddOrdersToShipmentCommand';

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
      findFirst: jest.fn().mockResolvedValue(order),
    },
    shipment: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn((fn: Function) => fn(tx)),
  } as any;
  return { prisma, tx };
}

function makeCommandBus(result: any = { success: true, data: { shipmentId: 'ship-1' }, events: [] }) {
  return { dispatch: jest.fn().mockResolvedValue(result) } as any;
}

describe('OrderConversionService', () => {
  beforeEach(() => jest.clearAllMocks());

  // Detailed shipment-creation/linking behaviour (stop creation, status
  // flips, audit logging, SHIPMENT_CREATED/ORDER_ASSIGNED_TO_SHIPMENT
  // emission) now lives with the command handlers themselves:
  // ConvertOrderToShipmentCommand.test.ts, CombineOrdersIntoShipmentCommand.test.ts,
  // SplitOrderCommand.test.ts, AddOrdersToShipmentCommand.test.ts. These tests
  // cover only the service's thin wrapper: resolving orgId for the command
  // envelope and mapping the CommandResult back onto this service's public
  // return shapes (#264, #266).

  describe('convertOrder', () => {
    it('dispatches CONVERT_ORDER_TO_SHIPMENT with the order\'s orgId and actorId, and maps the result', async () => {
      const { prisma } = makePrisma(makeOrder());
      const commandBus = makeCommandBus({ success: true, data: { shipmentId: 'ship-1' }, events: [] });
      const service = new OrderConversionService(prisma, commandBus);

      const result = await service.convertOrder('order-1', 'user-1');

      expect(result).toEqual({ shipmentId: 'ship-1' });
      expect(commandBus.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: CONVERT_ORDER_TO_SHIPMENT,
          orgId: 'test-org',
          actorId: 'user-1',
          payload: { orderId: 'order-1' },
        })
      );
    });

    it('rejects when the order is not found, without dispatching', async () => {
      const { prisma } = makePrisma(null);
      const commandBus = makeCommandBus();
      const service = new OrderConversionService(prisma, commandBus);

      await expect(service.convertOrder('order-1')).rejects.toThrow('Order not found');
      expect(commandBus.dispatch).not.toHaveBeenCalled();
    });

    it('propagates a command failure as a thrown error', async () => {
      const { prisma } = makePrisma(makeOrder());
      const commandBus = makeCommandBus({ success: false, error: 'Order already assigned', events: [] });
      const service = new OrderConversionService(prisma, commandBus);

      await expect(service.convertOrder('order-1')).rejects.toThrow('Order already assigned');
    });
  });

  describe('batchConvert (combine mode)', () => {
    it('checks compatibility before dispatching, and maps a successful combine', async () => {
      const orderA = makeOrder({ id: 'order-a', orderNumber: 'ORD-A', destinationId: 'loc-dest-1' });
      const orderB = makeOrder({ id: 'order-b', orderNumber: 'ORD-B', destinationId: 'loc-dest-2' });
      const prisma = {
        order: {
          findMany: jest.fn().mockResolvedValue([orderA, orderB]),
          findFirst: jest.fn().mockResolvedValue(orderA),
        },
      } as any;
      const commandBus = makeCommandBus({ success: true, data: { shipmentId: 'ship-1' }, events: [] });
      const service = new OrderConversionService(prisma, commandBus);

      const result = await service.batchConvert(['order-a', 'order-b'], { mode: 'combine' }, 'user-1');

      expect(result.success).toBe(true);
      expect(result.shipmentIds).toEqual(['ship-1']);
      expect(commandBus.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: COMBINE_ORDERS_INTO_SHIPMENT,
          orgId: 'test-org',
          actorId: 'user-1',
          payload: { orderIds: ['order-a', 'order-b'] },
        })
      );
    });

    it('rejects combining orders with different origins, without dispatching', async () => {
      const orderA = makeOrder({ id: 'order-a', originId: 'loc-origin-1' });
      const orderB = makeOrder({ id: 'order-b', originId: 'loc-origin-2' });
      const prisma = {
        order: { findMany: jest.fn().mockResolvedValue([orderA, orderB]) },
      } as any;
      const commandBus = makeCommandBus();
      const service = new OrderConversionService(prisma, commandBus);

      const result = await service.batchConvert(['order-a', 'order-b'], { mode: 'combine' });

      expect(result.success).toBe(false);
      expect(result.errors[0]).toMatch(/different origins/);
      expect(commandBus.dispatch).not.toHaveBeenCalled();
    });
  });

  describe('splitOrder', () => {
    it('dispatches SPLIT_ORDER with the order\'s orgId and maps a successful split', async () => {
      const { prisma } = makePrisma(makeOrder());
      const commandBus = makeCommandBus({ success: true, data: { shipmentIds: ['ship-1', 'ship-2'] }, events: [] });
      const service = new OrderConversionService(prisma, commandBus);
      const groups = [{ trackableUnitIds: ['u1'], legacyItemIds: [] }, { trackableUnitIds: ['u2'], legacyItemIds: [] }];

      const result = await service.splitOrder('order-1', groups, 'user-1');

      expect(result.success).toBe(true);
      expect(result.shipmentIds).toEqual(['ship-1', 'ship-2']);
      expect(commandBus.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: SPLIT_ORDER,
          orgId: 'test-org',
          actorId: 'user-1',
          payload: { orderId: 'order-1', groups },
        })
      );
    });

    it('rejects when the order is not found, without dispatching', async () => {
      const { prisma } = makePrisma(null);
      const commandBus = makeCommandBus();
      const service = new OrderConversionService(prisma, commandBus);

      const result = await service.splitOrder('order-1', [{ trackableUnitIds: ['u1'], legacyItemIds: [] }, { trackableUnitIds: ['u2'], legacyItemIds: [] }]);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Order not found');
      expect(commandBus.dispatch).not.toHaveBeenCalled();
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

    it('dispatches ADD_ORDERS_TO_SHIPMENT with only the eligible order ids, and maps a successful result', async () => {
      const order = makeOrder();
      const shipment = makeShipment();
      const prisma = {
        shipment: { findFirst: jest.fn().mockResolvedValue(shipment) },
        order: { findMany: jest.fn().mockResolvedValue([order]) },
      } as any;
      const commandBus = makeCommandBus({ success: true, data: { shipmentId: 'ship-1', addedOrderIds: ['order-1'] }, events: [] });
      const service = new OrderConversionService(prisma, commandBus);

      const result = await service.addOrdersToShipment('test-org', 'ship-1', ['order-1'], 'user-1');

      expect(result.success).toBe(true);
      expect(result.shipmentIds).toEqual(['ship-1']);
      expect(commandBus.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ADD_ORDERS_TO_SHIPMENT,
          orgId: 'test-org',
          actorId: 'user-1',
          payload: { shipmentId: 'ship-1', orderIds: ['order-1'] },
        })
      );
    });

    it('propagates a command failure as a failed result, without touching shipmentIds', async () => {
      const order = makeOrder();
      const shipment = makeShipment();
      const prisma = {
        shipment: { findFirst: jest.fn().mockResolvedValue(shipment) },
        order: { findMany: jest.fn().mockResolvedValue([order]) },
      } as any;
      const commandBus = makeCommandBus({ success: false, error: 'Shipment not found', events: [] });
      const service = new OrderConversionService(prisma, commandBus);

      const result = await service.addOrdersToShipment('test-org', 'ship-1', ['order-1']);

      expect(result.success).toBe(false);
      expect(result.shipmentIds).toEqual([]);
      expect(result.errors).toEqual(['Shipment not found']);
    });

    it('rejects orders with a different origin than the shipment, without dispatching', async () => {
      const order = makeOrder({ originId: 'some-other-origin' });
      const shipment = makeShipment();
      const prisma = {
        shipment: { findFirst: jest.fn().mockResolvedValue(shipment) },
        order: { findMany: jest.fn().mockResolvedValue([order]) },
      } as any;
      const commandBus = makeCommandBus();
      const service = new OrderConversionService(prisma, commandBus);

      const result = await service.addOrdersToShipment('test-org', 'ship-1', ['order-1']);

      expect(result.success).toBe(false);
      expect(result.errors[0]).toMatch(/different origin/);
      expect(commandBus.dispatch).not.toHaveBeenCalled();
    });

    it('rejects orders with a different customer than the shipment, without dispatching', async () => {
      const order = makeOrder({ customerId: 'some-other-customer' });
      const shipment = makeShipment();
      const prisma = {
        shipment: { findFirst: jest.fn().mockResolvedValue(shipment) },
        order: { findMany: jest.fn().mockResolvedValue([order]) },
      } as any;
      const commandBus = makeCommandBus();
      const service = new OrderConversionService(prisma, commandBus);

      const result = await service.addOrdersToShipment('test-org', 'ship-1', ['order-1']);

      expect(result.success).toBe(false);
      expect(result.errors[0]).toMatch(/different customer/);
      expect(commandBus.dispatch).not.toHaveBeenCalled();
    });

    it('rejects adding orders to a shipment that has already left draft/ready, without dispatching', async () => {
      const shipment = makeShipment({ status: 'in_progress' });
      const prisma = {
        shipment: { findFirst: jest.fn().mockResolvedValue(shipment) },
      } as any;
      const commandBus = makeCommandBus();
      const service = new OrderConversionService(prisma, commandBus);

      const result = await service.addOrdersToShipment('test-org', 'ship-1', ['order-1']);

      expect(result.success).toBe(false);
      expect(result.message).toMatch(/already left draft\/ready/);
      expect(commandBus.dispatch).not.toHaveBeenCalled();
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
      const service = new OrderConversionService(prisma, makeCommandBus());

      const check = await service.checkCompatibility(['order-a', 'order-b']);

      expect(check.compatible).toBe(false);
      expect(check.errors[0]).toMatch(/different origins/);
      expect(check.warnings.some((w) => w.includes('different customers'))).toBe(true);
    });
  });
});
