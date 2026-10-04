import { AddOrdersToShipmentCommandHandler, ADD_ORDERS_TO_SHIPMENT } from '../../commands/orders/AddOrdersToShipmentCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

function makeOrder(overrides: any = {}) {
  return {
    id: 'order-1',
    orgId: 'test-org',
    orderNumber: 'ORD-001',
    status: 'verified',
    customerId: 'cust-1',
    originId: 'loc-origin',
    destinationId: 'loc-dest',
    serviceLevel: 'LTL',
    temperatureControl: 'ambient',
    requiresHazmat: false,
    trackableUnits: [],
    lineItems: [],
    ...overrides,
  };
}

function makeShipment(overrides: any = {}) {
  return {
    id: 'ship-1',
    orgId: 'test-org',
    reference: 'SH-EXISTING',
    customerId: 'cust-1',
    serviceLevel: 'LTL',
    tempControlled: false,
    hazmat: false,
    items: [{ orderId: 'order-existing', orderNumber: 'ORD-EXISTING' }],
    ...overrides,
  };
}

// The shipment already has its pickup at the orders' origin; any other stop lookup finds nothing.
const findStop = (args: any) => Promise.resolve(
  args?.where?.stopType?.in?.includes('pickup') && args.where.locationId === 'loc-origin' ? { id: 'stop-pickup', sequenceNumber: 1 } : null,
);

function makeTx(shipment: any = makeShipment()) {
  return {
    shipment: {
      findFirst: jest.fn().mockResolvedValue(shipment),
      update: jest.fn().mockResolvedValue({}),
    },
    order: { findMany: jest.fn(), update: jest.fn().mockResolvedValue({}) },
    orderShipment: { create: jest.fn().mockResolvedValue({}), count: jest.fn().mockResolvedValue(1) },
    shipmentStop: {
      findFirst: jest.fn(findStop),
      create: jest.fn().mockResolvedValue({ id: 'stop-1' }),
      aggregate: jest.fn().mockResolvedValue({ _max: { sequenceNumber: null } }),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  } as any;
}

function makePrisma(tx: any) {
  return {
    $transaction: jest.fn((fn: Function) => fn(tx)),
    domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
  } as any;
}

describe('AddOrdersToShipmentCommandHandler', () => {
  beforeEach(() => jest.clearAllMocks());

  it('appends to the existing items array and emits one ORDER_ASSIGNED_TO_SHIPMENT per order', async () => {
    const order = makeOrder();
    const tx = makeTx();
    tx.order.findMany.mockResolvedValue([order]);
    const prisma = makePrisma(tx);
    const { bus } = mockEventBus();
    const handler = new AddOrdersToShipmentCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(ADD_ORDERS_TO_SHIPMENT, { shipmentId: 'ship-1', orderIds: ['order-1'] }, { orgId: 'test-org', actorId: 'user-1' })
    );

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ shipmentId: 'ship-1', addedOrderIds: ['order-1'] });

    const itemsWritten = tx.shipment.update.mock.calls[0][0].data.items;
    expect(itemsWritten).toHaveLength(2);
    expect(itemsWritten[0].orderId).toBe('order-existing');
    expect(itemsWritten[1].orderId).toBe('order-1');

    const events = result.events.filter((e) => e.type === EVENT_TYPES.ORDER_ASSIGNED_TO_SHIPMENT);
    expect(events).toHaveLength(1);
    expect(events[0].entityId).toBe('order-1');
    expect(events[0].payload).toEqual({
      orderReference: 'ORD-001',
      shipmentId: 'ship-1',
      shipmentReference: 'SH-EXISTING',
    });
  });

  it('reuses an existing stop for a destination rather than creating a duplicate', async () => {
    const order = makeOrder();
    const tx = makeTx();
    tx.shipmentStop.findFirst.mockResolvedValue({ id: 'existing-stop-1' });
    tx.order.findMany.mockResolvedValue([order]);
    const prisma = makePrisma(tx);
    const { bus } = mockEventBus();
    const handler = new AddOrdersToShipmentCommandHandler(prisma, bus);

    await handler.execute(
      createTestCommand(ADD_ORDERS_TO_SHIPMENT, { shipmentId: 'ship-1', orderIds: ['order-1'] }, { orgId: 'test-org' })
    );

    expect(tx.shipmentStop.create).not.toHaveBeenCalled();
    expect(tx.order.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deliveryStopId: 'existing-stop-1' }) })
    );
  });

  it('propagates the command\'s actorId and correlationId onto every emitted event', async () => {
    const order = makeOrder();
    const tx = makeTx();
    tx.order.findMany.mockResolvedValue([order]);
    const prisma = makePrisma(tx);
    const { bus } = mockEventBus();
    const handler = new AddOrdersToShipmentCommandHandler(prisma, bus);

    const command = createTestCommand(ADD_ORDERS_TO_SHIPMENT, { shipmentId: 'ship-1', orderIds: ['order-1'] }, { orgId: 'test-org', actorId: 'user-1' });
    const result = await handler.execute(command);

    for (const event of result.events) {
      expect(event.metadata.correlationId).toBe(command.metadata.correlationId);
      expect(event.actorId).toBe('user-1');
    }
  });

  it('rejects when the shipment is not found', async () => {
    const tx = makeTx();
    tx.shipment.findFirst.mockResolvedValue(null);
    const prisma = makePrisma(tx);
    const { bus } = mockEventBus();
    const handler = new AddOrdersToShipmentCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(ADD_ORDERS_TO_SHIPMENT, { shipmentId: 'missing', orderIds: ['order-1'] }, { orgId: 'test-org' })
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Shipment not found/);
    expect(tx.shipment.update).not.toHaveBeenCalled();
  });

  it('rejects when none of the given order ids resolve to a real order', async () => {
    const tx = makeTx();
    tx.order.findMany.mockResolvedValue([]);
    const prisma = makePrisma(tx);
    const { bus } = mockEventBus();
    const handler = new AddOrdersToShipmentCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(ADD_ORDERS_TO_SHIPMENT, { shipmentId: 'ship-1', orderIds: ['order-1'] }, { orgId: 'test-org' })
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/No valid orders to add/);
    expect(tx.shipment.update).not.toHaveBeenCalled();
  });

  describe('load rules (#325)', () => {
    async function add(shipment: any, orders: any[], existing = 1) {
      const tx = makeTx(makeShipment(shipment));
      tx.orderShipment.count.mockResolvedValue(existing);
      tx.order.findMany.mockResolvedValue(orders);
      const handler = new AddOrdersToShipmentCommandHandler(makePrisma(tx), mockEventBus().bus);
      const result = await handler.execute(createTestCommand(ADD_ORDERS_TO_SHIPMENT, { shipmentId: 'ship-1', orderIds: orders.map((o) => o.id) }));
      return { tx, result };
    }

    it('refuses a second order on an FTL shipment', async () => {
      const { result, tx } = await add({ serviceLevel: 'FTL' }, [makeOrder({ serviceLevel: 'FTL' })], 1);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/FTL shipment carries one order/);
      expect(tx.orderShipment.create).not.toHaveBeenCalled();
    });

    it('refuses an FTL order on an LTL shipment', async () => {
      const { result } = await add({ serviceLevel: 'LTL' }, [makeOrder({ serviceLevel: 'FTL' })]);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/FTL orders can't join a LTL shipment/);
    });

    it('refuses an order for another customer, even on LTL', async () => {
      const { result } = await add({ customerId: 'cust-1' }, [makeOrder({ id: 'b', customerId: 'cust-2' })]);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/another customer/);
    });

    it('gives a shipment with no service level the orders\' one', async () => {
      const { tx, result } = await add({ serviceLevel: null }, [makeOrder({ serviceLevel: 'FTL' })], 0);
      expect(result.success).toBe(true);
      expect(tx.shipment.update).toHaveBeenCalledWith(expect.objectContaining({ data: { serviceLevel: 'FTL' } }));
    });
  });

  it('adds a new drop before the destination and announces the stop change (#328)', async () => {
    const tx = makeTx(makeShipment({ destinationId: 'loc-final' }));
    tx.order.findMany.mockResolvedValue([makeOrder({ destinationId: 'loc-new' })]);
    tx.orderShipment.count.mockResolvedValue(1);
    tx.shipmentStop.findMany.mockResolvedValue([
      { id: 'stop-new', locationId: 'loc-new', sequenceNumber: 3 },
      { id: 'stop-final', locationId: 'loc-final', sequenceNumber: 2 },
      { id: 'stop-pickup', locationId: 'loc-origin', sequenceNumber: 1 },
    ]);
    const handler = new AddOrdersToShipmentCommandHandler(makePrisma(tx), mockEventBus().bus);

    const result = await handler.execute(createTestCommand(ADD_ORDERS_TO_SHIPMENT, { shipmentId: 'ship-1', orderIds: ['order-1'] }));

    const renumbered = tx.shipmentStop.update.mock.calls.map((c: any) => [c[0].where.id, c[0].data.sequenceNumber]);
    expect(renumbered).toEqual([['stop-pickup', 1], ['stop-new', 2], ['stop-final', 3]]);
    expect(result.events.map((e) => e.type)).toContain(EVENT_TYPES.SHIPMENT_UPDATED);
  });

  it('changes no stops and sends no update when the drop is already a stop', async () => {
    const tx = makeTx();
    tx.order.findMany.mockResolvedValue([makeOrder()]);
    tx.shipmentStop.findFirst.mockResolvedValue({ id: 'stop-existing' });
    const handler = new AddOrdersToShipmentCommandHandler(makePrisma(tx), mockEventBus().bus);

    const result = await handler.execute(createTestCommand(ADD_ORDERS_TO_SHIPMENT, { shipmentId: 'ship-1', orderIds: ['order-1'] }));

    expect(tx.shipmentStop.update).not.toHaveBeenCalled();
    expect(result.events.map((e) => e.type)).not.toContain(EVENT_TYPES.SHIPMENT_UPDATED);
  });
});

