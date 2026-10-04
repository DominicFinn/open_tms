import { CombineOrdersIntoShipmentCommandHandler, COMBINE_ORDERS_INTO_SHIPMENT } from '../../commands/orders/CombineOrdersIntoShipmentCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

function makeOrder(overrides: any = {}) {
  return {
    id: 'order-a',
    orgId: 'test-org',
    orderNumber: 'ORD-A',
    status: 'verified',
    customerId: 'cust-1',
    originId: 'loc-origin',
    destinationId: 'loc-dest-1',
    serviceLevel: 'LTL',
    temperatureControl: 'ambient',
    requiresHazmat: false,
    createdAt: new Date('2026-01-01'),
    customer: { id: 'cust-1', name: 'Acme' },
    trackableUnits: [],
    lineItems: [],
    ...overrides,
  };
}

function makeTx() {
  return {
    order: { findMany: jest.fn(), update: jest.fn().mockResolvedValue({}) },
    shipment: {
      create: jest.fn().mockResolvedValue({ id: 'ship-1', reference: 'SH-BATCH-XYZ', items: [] }),
      update: jest.fn().mockResolvedValue({}),
    },
    orderShipment: { create: jest.fn().mockResolvedValue({}) },
    shipmentStop: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'stop-1' }),
      aggregate: jest.fn().mockResolvedValue({ _max: { sequenceNumber: null } }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    lane: { findMany: jest.fn().mockResolvedValue([]) },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  } as any;
}

function makePrisma(tx: any) {
  return {
    $transaction: jest.fn((fn: Function) => fn(tx)),
    domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
  } as any;
}

describe('CombineOrdersIntoShipmentCommandHandler', () => {
  beforeEach(() => jest.clearAllMocks());

  it('combines orders into one shipment, creates a stop per unique destination, and emits one SHIPMENT_CREATED plus one ORDER_ASSIGNED_TO_SHIPMENT per order', async () => {
    const orderA = makeOrder({ id: 'order-a', orderNumber: 'ORD-A', destinationId: 'loc-dest-1' });
    const orderB = makeOrder({ id: 'order-b', orderNumber: 'ORD-B', destinationId: 'loc-dest-2' });
    const tx = makeTx();
    tx.order.findMany.mockResolvedValue([orderA, orderB]);
    const prisma = makePrisma(tx);
    const { bus } = mockEventBus();
    const handler = new CombineOrdersIntoShipmentCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(COMBINE_ORDERS_INTO_SHIPMENT, { orderIds: ['order-a', 'order-b'] }, { orgId: 'test-org', actorId: 'user-1' })
    );

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ shipmentId: 'ship-1' });
    expect(tx.shipment.create.mock.calls[0][0].data.orgId).toBe('test-org');

    // the pickup, then one stop per order (each has a distinct destination and shipmentStop.findFirst always returns null here)
    expect(tx.shipmentStop.create).toHaveBeenCalledTimes(3);
    expect(tx.order.update).toHaveBeenCalledTimes(2);

    const shipmentCreatedEvents = result.events.filter((e) => e.type === EVENT_TYPES.SHIPMENT_CREATED);
    expect(shipmentCreatedEvents).toHaveLength(1);
    const orderAssignedEvents = result.events.filter((e) => e.type === EVENT_TYPES.ORDER_ASSIGNED_TO_SHIPMENT);
    expect(orderAssignedEvents).toHaveLength(2);
    expect(orderAssignedEvents.map((e) => e.entityId).sort()).toEqual(['order-a', 'order-b']);
  });

  it('propagates the command\'s actorId and correlationId onto every emitted event', async () => {
    const orderA = makeOrder();
    const tx = makeTx();
    tx.order.findMany.mockResolvedValue([orderA]);
    const prisma = makePrisma(tx);
    const { bus } = mockEventBus();
    const handler = new CombineOrdersIntoShipmentCommandHandler(prisma, bus);

    const command = createTestCommand(COMBINE_ORDERS_INTO_SHIPMENT, { orderIds: ['order-a'] }, { orgId: 'test-org', actorId: 'user-1' });
    const result = await handler.execute(command);

    for (const event of result.events) {
      expect(event.metadata.correlationId).toBe(command.metadata.correlationId);
      expect(event.actorId).toBe('user-1');
    }
  });

  it('only loads orders inside the command org, and creates the shipment in that org (#326)', async () => {
    const tx = makeTx();
    tx.order.findMany.mockResolvedValue([makeOrder()]);
    const prisma = makePrisma(tx);
    const { bus } = mockEventBus();
    const handler = new CombineOrdersIntoShipmentCommandHandler(prisma, bus);

    await handler.execute(
      createTestCommand(COMBINE_ORDERS_INTO_SHIPMENT, { orderIds: ['order-a'] }, { orgId: 'test-org', actorId: 'user-1' })
    );

    expect(tx.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { in: ['order-a'] }, orgId: 'test-org' }) })
    );
    expect(tx.shipment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ orgId: 'test-org' }) })
    );
  });

  it('rejects when no valid orders are found', async () => {
    const tx = makeTx();
    tx.order.findMany.mockResolvedValue([]);
    const prisma = makePrisma(tx);
    const { bus } = mockEventBus();
    const handler = new CombineOrdersIntoShipmentCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(COMBINE_ORDERS_INTO_SHIPMENT, { orderIds: ['order-a'] }, { orgId: 'test-org' })
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/No valid orders found/);
    expect(tx.shipment.create).not.toHaveBeenCalled();
  });

  it('sets the shipment service level and handling flags from its orders (#325)', async () => {
    const tx = makeTx();
    tx.order.findMany.mockResolvedValue([
      makeOrder({ id: 'a' }),
      makeOrder({ id: 'b', temperatureControl: 'refrigerated' }),
    ]);
    const handler = new CombineOrdersIntoShipmentCommandHandler(makePrisma(tx), mockEventBus().bus);

    const result = await handler.execute(createTestCommand(COMBINE_ORDERS_INTO_SHIPMENT, { orderIds: ['a', 'b'] }, { orgId: 'test-org' }));

    expect(result.success).toBe(true);
    expect(tx.shipment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ serviceLevel: 'LTL', tempControlled: true, hazmat: false }),
    }));
  });

  it('refuses to combine FTL orders (#325)', async () => {
    const tx = makeTx();
    tx.order.findMany.mockResolvedValue([makeOrder({ id: 'a', serviceLevel: 'FTL' }), makeOrder({ id: 'b', serviceLevel: 'FTL' })]);
    const handler = new CombineOrdersIntoShipmentCommandHandler(makePrisma(tx), mockEventBus().bus);

    const result = await handler.execute(createTestCommand(COMBINE_ORDERS_INTO_SHIPMENT, { orderIds: ['a', 'b'] }, { orgId: 'test-org' }));

    expect(result.success).toBe(false);
    expect(tx.shipment.create).not.toHaveBeenCalled();
  });

  it('starts the shipment with a pickup stop at the origin, before the delivery stops (#324)', async () => {
    const tx = makeTx();
    tx.shipment.create.mockResolvedValue({ id: 'ship-1', reference: 'SH-BATCH-XYZ', items: [], originId: 'loc-origin' });
    tx.order.findMany.mockResolvedValue([makeOrder()]);
    const handler = new CombineOrdersIntoShipmentCommandHandler(makePrisma(tx), mockEventBus().bus);

    await handler.execute(createTestCommand(COMBINE_ORDERS_INTO_SHIPMENT, { orderIds: ['order-a'] }, { orgId: 'test-org' }));

    expect(tx.shipmentStop.create.mock.calls[0][0]).toEqual({
      data: { shipmentId: 'ship-1', locationId: 'loc-origin', sequenceNumber: 1, stopType: 'pickup', status: 'pending' },
    });
  });

  it('ends the shipment at its last drop when orders go to different places (#324)', async () => {
    const tx = makeTx();
    tx.shipment.create.mockResolvedValue({ id: 'ship-1', reference: 'SH-BATCH-XYZ', items: [], originId: 'loc-origin', destinationId: 'loc-dest-1' });
    tx.shipmentStop.findFirst.mockImplementation((args: any) => Promise.resolve(args?.orderBy ? { locationId: 'loc-dest-2' } : null));
    tx.order.findMany.mockResolvedValue([
      makeOrder({ id: 'a', destinationId: 'loc-dest-1' }),
      makeOrder({ id: 'b', destinationId: 'loc-dest-2' }),
    ]);
    const handler = new CombineOrdersIntoShipmentCommandHandler(makePrisma(tx), mockEventBus().bus);

    await handler.execute(createTestCommand(COMBINE_ORDERS_INTO_SHIPMENT, { orderIds: ['a', 'b'] }, { orgId: 'test-org' }));

    expect(tx.shipment.update).toHaveBeenCalledWith(expect.objectContaining({ data: { destinationId: 'loc-dest-2' } }));
  });

  it('refuses to combine orders for different customers (#325)', async () => {
    const tx = makeTx();
    tx.order.findMany.mockResolvedValue([makeOrder({ id: 'a', customerId: 'cust-1' }), makeOrder({ id: 'b', customerId: 'cust-2' })]);
    const handler = new CombineOrdersIntoShipmentCommandHandler(makePrisma(tx), mockEventBus().bus);

    const result = await handler.execute(createTestCommand(COMBINE_ORDERS_INTO_SHIPMENT, { orderIds: ['a', 'b'] }, { orgId: 'test-org' }));

    expect(result.success).toBe(false);
    expect(tx.shipment.create).not.toHaveBeenCalled();
  });
});

