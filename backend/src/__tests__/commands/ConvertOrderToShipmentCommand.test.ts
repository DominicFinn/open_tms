import { ConvertOrderToShipmentCommandHandler, CONVERT_ORDER_TO_SHIPMENT } from '../../commands/orders/ConvertOrderToShipmentCommand';
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
    requestedPickupDate: null,
    requestedDeliveryDate: null,
    customer: { id: 'cust-1', name: 'Acme' },
    trackableUnits: [],
    lineItems: [],
    ...overrides,
  };
}

function makeTx(order: any) {
  return {
    order: {
      findUnique: jest.fn().mockResolvedValue(order),
      update: jest.fn().mockResolvedValue({}),
    },
    shipment: {
      create: jest.fn().mockResolvedValue({ id: 'ship-1', reference: `SH-${order?.orderNumber}`, items: [] }),
      update: jest.fn().mockResolvedValue({}),
    },
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

describe('ConvertOrderToShipmentCommandHandler', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates a draft shipment carrying the order\'s orgId and emits SHIPMENT_CREATED + ORDER_ASSIGNED_TO_SHIPMENT', async () => {
    const order = makeOrder();
    const tx = makeTx(order);
    const prisma = makePrisma(tx);
    const { bus } = mockEventBus();
    const handler = new ConvertOrderToShipmentCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(CONVERT_ORDER_TO_SHIPMENT, { orderId: 'order-1' }, { orgId: 'test-org', actorId: 'user-1' })
    );

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ shipmentId: 'ship-1' });

    const shipmentData = tx.shipment.create.mock.calls[0][0].data;
    expect(shipmentData.orgId).toBe('test-org');
    expect(shipmentData.customerId).toBe('cust-1');
    expect(shipmentData.originId).toBe('loc-origin');
    expect(shipmentData.destinationId).toBe('loc-dest');

    expect(result.events).toHaveLength(2);
    const shipmentCreated = result.events.find((e) => e.type === EVENT_TYPES.SHIPMENT_CREATED)!;
    expect(shipmentCreated.entityId).toBe('ship-1');
    expect(shipmentCreated.orgId).toBe('test-org');

    const orderAssigned = result.events.find((e) => e.type === EVENT_TYPES.ORDER_ASSIGNED_TO_SHIPMENT)!;
    expect(orderAssigned.entityId).toBe('order-1');
    expect(orderAssigned.payload).toEqual({
      orderReference: 'ORD-001',
      shipmentId: 'ship-1',
      shipmentReference: 'SH-ORD-001',
    });
  });

  it('links the order to the shipment: creates a stop, flips status to assigned, writes an audit log', async () => {
    const order = makeOrder();
    const tx = makeTx(order);
    const prisma = makePrisma(tx);
    const { bus } = mockEventBus();
    const handler = new ConvertOrderToShipmentCommandHandler(prisma, bus);

    await handler.execute(
      createTestCommand(CONVERT_ORDER_TO_SHIPMENT, { orderId: 'order-1' }, { orgId: 'test-org', actorId: 'user-1' })
    );

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

  it('propagates the command\'s correlationId onto every emitted event', async () => {
    const order = makeOrder();
    const tx = makeTx(order);
    const prisma = makePrisma(tx);
    const { bus } = mockEventBus();
    const handler = new ConvertOrderToShipmentCommandHandler(prisma, bus);

    const command = createTestCommand(CONVERT_ORDER_TO_SHIPMENT, { orderId: 'order-1' }, { orgId: 'test-org', actorId: 'user-1' });
    const result = await handler.execute(command);

    for (const event of result.events) {
      expect(event.metadata.correlationId).toBe(command.metadata.correlationId);
      expect(event.actorId).toBe('user-1');
    }
  });

  it('rejects an order that is already assigned', async () => {
    const order = makeOrder({ status: 'assigned' });
    const tx = makeTx(order);
    const prisma = makePrisma(tx);
    const { bus } = mockEventBus();
    const handler = new ConvertOrderToShipmentCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(CONVERT_ORDER_TO_SHIPMENT, { orderId: 'order-1' }, { orgId: 'test-org' })
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Order already assigned/);
    expect(tx.shipment.create).not.toHaveBeenCalled();
  });

  it('rejects an order missing origin or destination', async () => {
    const order = makeOrder({ originId: null });
    const tx = makeTx(order);
    const prisma = makePrisma(tx);
    const { bus } = mockEventBus();
    const handler = new ConvertOrderToShipmentCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(CONVERT_ORDER_TO_SHIPMENT, { orderId: 'order-1' }, { orgId: 'test-org' })
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/missing origin or destination/);
  });

  it('rejects when the order is not found', async () => {
    const tx = makeTx(null);
    const prisma = makePrisma(tx);
    const { bus } = mockEventBus();
    const handler = new ConvertOrderToShipmentCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(CONVERT_ORDER_TO_SHIPMENT, { orderId: 'order-1' }, { orgId: 'test-org' })
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Order not found/);
  });
});
