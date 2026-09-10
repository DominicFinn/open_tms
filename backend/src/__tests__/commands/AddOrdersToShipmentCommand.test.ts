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
    items: [{ orderId: 'order-existing', orderNumber: 'ORD-EXISTING' }],
    ...overrides,
  };
}

function makeTx(shipment: any = makeShipment()) {
  return {
    shipment: {
      findFirst: jest.fn().mockResolvedValue(shipment),
      update: jest.fn().mockResolvedValue({}),
    },
    order: { findMany: jest.fn(), update: jest.fn().mockResolvedValue({}) },
    orderShipment: { create: jest.fn().mockResolvedValue({}) },
    shipmentStop: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'stop-1' }),
      aggregate: jest.fn().mockResolvedValue({ _max: { sequenceNumber: null } }),
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
});
