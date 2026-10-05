import { RecordStopOrdersDeliveryCommandHandler, RECORD_STOP_ORDERS_DELIVERY } from '../../commands/orders/RecordStopOrdersDeliveryCommand';
import {
  ChangeOrderDeliveryStatusCommandHandler, CHANGE_ORDER_DELIVERY_STATUS,
  ResolveOrderDeliveryExceptionCommandHandler, RESOLVE_ORDER_DELIVERY_EXCEPTION,
} from '../../commands/orders/ChangeOrderDeliveryStatusCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

function mockTx(overrides: any = {}) {
  const tx = {
    shipmentStop: { findFirst: jest.fn(), update: jest.fn().mockResolvedValue({}) },
    order: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn(), update: jest.fn().mockResolvedValue({}) },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    ...overrides,
  } as any;
  const prisma = {
    $transaction: jest.fn((fn: Function) => fn(tx)),
    domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
  } as any;
  return { tx, prisma };
}

const STOPS = [
  { id: 'stop-origin', locationId: 'loc-o', sequenceNumber: 1, status: 'completed', actualArrival: null, actualDeparture: null },
  { id: 'stop-mid', locationId: 'loc-m', sequenceNumber: 2, status: 'completed', actualArrival: null, actualDeparture: null },
];

function stopRow(id: string, stopType: string) {
  return {
    id, stopType, shipmentId: 'ship-1', actualArrival: null, actualDeparture: null,
    location: { name: 'Dock' },
    shipment: { originId: 'loc-o', stops: STOPS },
  };
}

const OCCURRED = '2026-10-01T15:30:00.000Z';

describe('RecordStopOrdersDeliveryCommandHandler (#325)', () => {
  it('delivers the active orders at a completed delivery stop, one order.delivered each, at the given time', async () => {
    const { tx, prisma } = mockTx();
    tx.shipmentStop.findFirst.mockResolvedValue(stopRow('stop-mid', 'delivery'));
    tx.order.findMany.mockResolvedValue([
      { id: 'o1', orderNumber: 'ORD-1', deliveryStatus: 'in_transit' },
      { id: 'o2', orderNumber: 'ORD-2', deliveryStatus: null },
    ]);
    const handler = new RecordStopOrdersDeliveryCommandHandler(prisma, mockEventBus().bus);

    const result = await handler.execute(createTestCommand(RECORD_STOP_ORDERS_DELIVERY, {
      stopId: 'stop-mid', status: 'completed', method: 'geofence', occurredAt: OCCURRED,
    }));

    expect(result.data).toEqual({ ordersUpdated: 2, shipmentId: 'ship-1' });
    expect(tx.order.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ deliveryStopId: 'stop-mid', orgId: 'test-org' }) }));
    expect(tx.order.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ deliveryStatus: 'delivered', deliveredAt: new Date(OCCURRED) }),
    }));
    expect(result.events.map((e) => [e.type, e.entityId])).toEqual([[EVENT_TYPES.ORDER_DELIVERED, 'o1'], [EVENT_TYPES.ORDER_DELIVERED, 'o2']]);
    expect(result.events[0].payload).toEqual(expect.objectContaining({
      orderReference: 'ORD-1', deliveredAt: OCCURRED, shipmentId: 'ship-1', stopId: 'stop-mid', method: 'geofence',
    }));
  });

  it('puts every unmoved order on the shipment in transit when the pickup completes, and never delivers (#307)', async () => {
    const { tx, prisma } = mockTx();
    tx.shipmentStop.findFirst.mockResolvedValue(stopRow('stop-origin', 'pickup'));
    tx.order.findMany.mockResolvedValue([{ id: 'o1', orderNumber: 'ORD-1', deliveryStatus: null }]);
    const handler = new RecordStopOrdersDeliveryCommandHandler(prisma, mockEventBus().bus);

    const result = await handler.execute(createTestCommand(RECORD_STOP_ORDERS_DELIVERY, {
      stopId: 'stop-origin', status: 'completed', method: 'geofence', occurredAt: OCCURRED,
    }));

    expect(tx.order.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ orderShipments: { some: { shipmentId: 'ship-1' } }, OR: [{ deliveryStatus: null }] }),
    }));
    expect(tx.order.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ deliveryStatus: 'in_transit' }) }));
    expect(result.events.map((e) => e.type)).toEqual([EVENT_TYPES.ORDER_DELIVERY_STATUS_CHANGED]);
  });

  it("only moves the orders collected at a later pickup when it completes (#329)", async () => {
    const { tx, prisma } = mockTx();
    tx.shipmentStop.findFirst.mockResolvedValue(stopRow('stop-mid', 'pickup'));
    const handler = new RecordStopOrdersDeliveryCommandHandler(prisma, mockEventBus().bus);

    await handler.execute(createTestCommand(RECORD_STOP_ORDERS_DELIVERY, {
      stopId: 'stop-mid', status: 'completed', method: 'geofence', occurredAt: OCCURRED,
    }));

    expect(tx.order.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ AND: [{ OR: [{ pickupStopId: 'stop-mid' }] }] }),
    }));
  });

  it('counts orders with no pickup stop as collected at the first pickup (#329)', async () => {
    const { tx, prisma } = mockTx();
    tx.shipmentStop.findFirst.mockResolvedValue(stopRow('stop-origin', 'pickup'));
    const handler = new RecordStopOrdersDeliveryCommandHandler(prisma, mockEventBus().bus);

    await handler.execute(createTestCommand(RECORD_STOP_ORDERS_DELIVERY, {
      stopId: 'stop-origin', status: 'completed', method: 'geofence', occurredAt: OCCURRED,
    }));

    expect(tx.order.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ AND: [{ OR: [{ pickupStopId: 'stop-origin' }, { pickupStopId: null }] }] }),
    }));
  });

  it('changes no orders when the pickup only arrives', async () => {
    const { tx, prisma } = mockTx();
    tx.shipmentStop.findFirst.mockResolvedValue(stopRow('stop-origin', 'pickup'));
    const handler = new RecordStopOrdersDeliveryCommandHandler(prisma, mockEventBus().bus);

    const result = await handler.execute(createTestCommand(RECORD_STOP_ORDERS_DELIVERY, {
      stopId: 'stop-origin', status: 'arrived', method: 'geofence', occurredAt: OCCURRED,
    }));

    expect(result.data).toEqual({ ordersUpdated: 0, shipmentId: 'ship-1' });
    expect(tx.order.findMany).not.toHaveBeenCalled();
    expect(tx.shipmentStop.update).toHaveBeenCalled();
  });

  it('fails for a stop outside the org', async () => {
    const { tx, prisma } = mockTx();
    tx.shipmentStop.findFirst.mockResolvedValue(null);
    const handler = new RecordStopOrdersDeliveryCommandHandler(prisma, mockEventBus().bus);

    const result = await handler.execute(createTestCommand(RECORD_STOP_ORDERS_DELIVERY, {
      stopId: 'stop-x', status: 'completed', method: 'manual', occurredAt: OCCURRED,
    }));

    expect(result.success).toBe(false);
    expect(result.error).toBe('Shipment stop not found');
  });
});

describe('RecordStopOrdersDeliveryCommandHandler on an other stop (#345)', () => {
  it.each(['arrived', 'completed'])('records the stop as %s and changes no orders', async (status) => {
    const { tx, prisma } = mockTx();
    tx.shipmentStop.findFirst.mockResolvedValue(stopRow('stop-mid', 'other'));
    const handler = new RecordStopOrdersDeliveryCommandHandler(prisma, mockEventBus().bus);

    const result = await handler.execute(createTestCommand(RECORD_STOP_ORDERS_DELIVERY, {
      stopId: 'stop-mid', status, method: 'geofence', occurredAt: OCCURRED,
    }));

    expect(result.data).toEqual({ ordersUpdated: 0, shipmentId: 'ship-1' });
    expect(tx.shipmentStop.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status }) }));
    expect(tx.order.findMany).not.toHaveBeenCalled();
    expect(result.events).toEqual([]);
  });
});

describe('ChangeOrderDeliveryStatusCommandHandler (#325)', () => {
  const order = { id: 'o1', orderNumber: 'ORD-1', orgId: 'test-org', deliveryStatus: 'in_transit' };

  it('emits order.delivered for a manual delivery, with no confirmer name or notes in the event', async () => {
    const { tx, prisma } = mockTx();
    tx.order.findFirst.mockResolvedValue(order);
    const handler = new ChangeOrderDeliveryStatusCommandHandler(prisma, mockEventBus().bus);

    const result = await handler.execute(createTestCommand(CHANGE_ORDER_DELIVERY_STATUS, {
      orderId: 'o1', deliveryStatus: 'delivered', deliveryMethod: 'manual', deliveryConfirmedBy: 'Jane Receiver', deliveryNotes: 'left at dock 4',
    }));

    expect(result.events.map((e) => e.type)).toEqual([EVENT_TYPES.ORDER_DELIVERED]);
    const serialized = JSON.stringify(result.events[0].payload);
    expect(serialized).not.toContain('Jane');
    expect(serialized).not.toContain('dock 4');
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userName: 'Jane Receiver' }) }));
  });

  it('emits order.exception with the exception type for a delivery exception', async () => {
    const { tx, prisma } = mockTx();
    tx.order.findFirst.mockResolvedValue(order);
    const handler = new ChangeOrderDeliveryStatusCommandHandler(prisma, mockEventBus().bus);

    const result = await handler.execute(createTestCommand(CHANGE_ORDER_DELIVERY_STATUS, {
      orderId: 'o1', deliveryStatus: 'exception', exceptionType: 'refused', exceptionNotes: 'consignee refused',
    }));

    expect(result.events[0]).toMatchObject({ type: EVENT_TYPES.ORDER_EXCEPTION, payload: { exceptionType: 'refused' } });
  });

  it('fails with "Order not found" for an order outside the org', async () => {
    const { tx, prisma } = mockTx();
    tx.order.findFirst.mockResolvedValue(null);
    const handler = new ChangeOrderDeliveryStatusCommandHandler(prisma, mockEventBus().bus);

    const result = await handler.execute(createTestCommand(CHANGE_ORDER_DELIVERY_STATUS, { orderId: 'o9', deliveryStatus: 'delivered' }));

    expect(result.success).toBe(false);
    expect(result.error).toBe('Order not found');
    expect(tx.order.findFirst).toHaveBeenCalledWith({ where: { id: 'o9', orgId: 'test-org' } });
  });
});

describe('ResolveOrderDeliveryExceptionCommandHandler (#325)', () => {
  it('puts an order in exception back in transit and emits order.exception_resolved', async () => {
    const { tx, prisma } = mockTx();
    tx.order.findFirst.mockResolvedValue({ id: 'o1', orderNumber: 'ORD-1', deliveryStatus: 'exception', exceptionType: 'delay', deliveryNotes: null });
    const handler = new ResolveOrderDeliveryExceptionCommandHandler(prisma, mockEventBus().bus);

    const result = await handler.execute(createTestCommand(RESOLVE_ORDER_DELIVERY_EXCEPTION, { orderId: 'o1' }));

    expect(tx.order.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ deliveryStatus: 'in_transit' }) }));
    expect(result.events.map((e) => e.type)).toEqual([EVENT_TYPES.ORDER_EXCEPTION_RESOLVED]);
  });

  it('refuses when the order is not in exception', async () => {
    const { tx, prisma } = mockTx();
    tx.order.findFirst.mockResolvedValue({ id: 'o1', orderNumber: 'ORD-1', deliveryStatus: 'in_transit' });
    const handler = new ResolveOrderDeliveryExceptionCommandHandler(prisma, mockEventBus().bus);

    const result = await handler.execute(createTestCommand(RESOLVE_ORDER_DELIVERY_EXCEPTION, { orderId: 'o1' }));

    expect(result.success).toBe(false);
    expect(result.error).toBe('Order is not in exception status');
  });
});
