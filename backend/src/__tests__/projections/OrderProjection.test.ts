import { OrderProjection } from '../../events/projections/OrderProjection';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestEvent } from '../helpers/testUtils';

const mockOrder = {
  id: 'order-1', orderNumber: 'ORD-001', poNumber: null, status: 'pending',
  deliveryStatus: 'unassigned', customerId: 'cust-1', serviceLevel: 'LTL',
  temperatureControl: 'ambient', requiresHazmat: false,
  requestedDeliveryDate: null, importSource: 'manual',
  createdAt: new Date(), updatedAt: new Date(),
  originId: 'loc-1', destinationId: 'loc-2',
  customer: { id: 'cust-1', name: 'Acme' },
  origin: { name: 'Chicago WH', city: 'Chicago', state: 'IL' },
  destination: { name: 'NY Depot', city: 'New York', state: 'NY' },
  trackableUnits: [{ id: 'tu-1' }],
  lineItems: [{ id: 'li-1', weight: 500 }],
};

const mockPrisma = {
  order: {
    findUnique: jest.fn().mockResolvedValue(mockOrder),
  },
  orderReadModel: {
    upsert: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({}),
  },
  orderLineItem: {
    findMany: jest.fn().mockResolvedValue([{ weight: 500 }, { weight: 200 }]),
    count: jest.fn().mockResolvedValue(2),
  },
  trackableUnit: {
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(1),
  },
} as any;

describe('OrderProjection', () => {
  let projection: OrderProjection;

  beforeEach(() => {
    jest.clearAllMocks();
    projection = new OrderProjection(mockPrisma);
  });

  describe('handler metadata', () => {
    it('has correct name and patterns', () => {
      expect(projection.name).toBe('projection.order');
      expect(projection.eventPatterns).toContain('order.*');
    });
  });

  describe('onOrderCreated', () => {
    it('upserts OrderReadModel with denormalized data', async () => {
      const event = createTestEvent(
        EVENT_TYPES.ORDER_CREATED, 'order', 'order-1',
        { orderReference: 'ORD-001', customerId: 'cust-1', status: 'pending' }
      );

      await projection.handle(event);

      expect(mockPrisma.order.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'order-1' } })
      );
      expect(mockPrisma.orderReadModel.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-1' },
          create: expect.objectContaining({
            orderNumber: 'ORD-001',
            customerName: 'Acme',
            originCity: 'Chicago',
            destinationCity: 'New York',
            trackableUnitCount: 1,
            temperatureRequired: false,
            hazmat: false,
          }),
        })
      );
    });

    it('skips gracefully when order not found', async () => {
      mockPrisma.order.findUnique.mockResolvedValueOnce(null);

      const event = createTestEvent(
        EVENT_TYPES.ORDER_CREATED, 'order', 'nonexistent', {}
      );

      await projection.handle(event);

      expect(mockPrisma.orderReadModel.upsert).not.toHaveBeenCalled();
    });
  });

  describe('onOrderStatusChanged', () => {
    it('updates status in read model', async () => {
      const event = createTestEvent(
        EVENT_TYPES.ORDER_STATUS_CHANGED, 'order', 'order-1',
        { orderReference: 'ORD-001', previousStatus: 'pending', newStatus: 'validated' }
      );

      await projection.handle(event);

      expect(mockPrisma.orderReadModel.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-1' },
          data: expect.objectContaining({ status: 'validated' }),
        })
      );
    });
  });

  describe('onDeliveryStatusChanged', () => {
    it('updates delivery status in read model', async () => {
      const event = createTestEvent(
        EVENT_TYPES.ORDER_DELIVERY_STATUS_CHANGED, 'order', 'order-1',
        { orderReference: 'ORD-001', previousStatus: 'unassigned', newStatus: 'assigned' }
      );

      await projection.handle(event);

      expect(mockPrisma.orderReadModel.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ deliveryStatus: 'assigned' }),
        })
      );
    });
  });

  describe('onAssignedToShipment', () => {
    it('sets shipment reference in read model', async () => {
      const event = createTestEvent(
        EVENT_TYPES.ORDER_ASSIGNED_TO_SHIPMENT, 'order', 'order-1',
        { orderReference: 'ORD-001', shipmentId: 'ship-1', shipmentReference: 'SH-001' }
      );

      await projection.handle(event);

      expect(mockPrisma.orderReadModel.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            shipmentId: 'ship-1',
            shipmentReference: 'SH-001',
            deliveryStatus: 'assigned',
          }),
        })
      );
    });
  });

  describe('onOrderDelivered', () => {
    it('marks as delivered with timestamp', async () => {
      const event = createTestEvent(
        EVENT_TYPES.ORDER_DELIVERED, 'order', 'order-1', {}
      );

      await projection.handle(event);

      expect(mockPrisma.orderReadModel.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            deliveryStatus: 'delivered',
            exceptionType: null,
          }),
        })
      );
    });
  });

  describe('trackable_unit.* events (Phase 2)', () => {
    it('subscribes to trackable_unit.* in addition to order.*', () => {
      expect(projection.eventPatterns).toEqual(expect.arrayContaining(['order.*', 'trackable_unit.*']));
    });

    it('refreshes count + weight aggregates when a unit is created', async () => {
      mockPrisma.trackableUnit.count.mockResolvedValueOnce(4);
      mockPrisma.orderLineItem.count.mockResolvedValueOnce(7);
      const event = createTestEvent(EVENT_TYPES.TRACKABLE_UNIT_CREATED, 'trackable_unit', 'tu-1', { orderId: 'order-1' });

      await projection.handle(event);

      expect(mockPrisma.trackableUnit.count).toHaveBeenCalledWith({ where: { orderId: 'order-1' } });
      expect(mockPrisma.orderReadModel.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-1' },
          data: expect.objectContaining({ trackableUnitCount: 4, lineItemCount: 7 }),
        }),
      );
    });

    it('prefers per-unit weight overrides when any unit has weight set', async () => {
      mockPrisma.trackableUnit.findMany.mockResolvedValueOnce([{ weight: 1000 }, { weight: null }, { weight: 500 }]);
      mockPrisma.trackableUnit.count.mockResolvedValueOnce(3);
      mockPrisma.orderLineItem.count.mockResolvedValueOnce(10);

      const event = createTestEvent(EVENT_TYPES.TRACKABLE_UNIT_UPDATED, 'trackable_unit', 'tu-1', { orderId: 'order-1' });
      await projection.handle(event);

      expect(mockPrisma.orderReadModel.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ totalWeight: 1500 }) }),
      );
    });

    it('barcode_generated does not trigger a read-model update', async () => {
      const event = createTestEvent(EVENT_TYPES.TRACKABLE_UNIT_BARCODE_GENERATED, 'trackable_unit', 'tu-1', { orderId: 'order-1' });
      await projection.handle(event);
      expect(mockPrisma.orderReadModel.update).not.toHaveBeenCalled();
    });
  });

  describe('order_line_item.* events (Phase 4)', () => {
    it('subscribes to order_line_item.* in addition to order.* and trackable_unit.*', () => {
      expect(projection.eventPatterns).toEqual(expect.arrayContaining(['order.*', 'trackable_unit.*', 'order_line_item.*']));
    });

    it('refreshes counts + total weight when a line item is created', async () => {
      mockPrisma.orderLineItem.count.mockResolvedValueOnce(5);
      mockPrisma.trackableUnit.count.mockResolvedValueOnce(2);
      mockPrisma.trackableUnit.findMany.mockResolvedValueOnce([]);
      mockPrisma.orderLineItem.findMany.mockResolvedValueOnce([{ weight: 10, quantity: 3 }, { weight: 5, quantity: 1 }]);

      const event = createTestEvent(EVENT_TYPES.ORDER_LINE_ITEM_CREATED, 'order_line_item', 'li-1', { orderId: 'order-1' });
      await projection.handle(event);

      expect(mockPrisma.orderLineItem.count).toHaveBeenCalledWith({ where: { orderId: 'order-1' } });
      expect(mockPrisma.orderReadModel.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-1' },
          data: expect.objectContaining({ lineItemCount: 5, trackableUnitCount: 2, totalWeight: 10 * 3 + 5 * 1 }),
        }),
      );
    });

    it('refreshes after delete and update too', async () => {
      mockPrisma.orderLineItem.count.mockResolvedValue(0);
      mockPrisma.trackableUnit.count.mockResolvedValue(1);
      mockPrisma.trackableUnit.findMany.mockResolvedValue([]);
      mockPrisma.orderLineItem.findMany.mockResolvedValue([]);

      await projection.handle(createTestEvent(EVENT_TYPES.ORDER_LINE_ITEM_UPDATED, 'order_line_item', 'li-1', { orderId: 'order-1' }));
      await projection.handle(createTestEvent(EVENT_TYPES.ORDER_LINE_ITEM_DELETED, 'order_line_item', 'li-1', { orderId: 'order-1' }));

      // Both events triggered a refresh; the empty-lines + no-unit-override case yields totalWeight=null.
      expect(mockPrisma.orderReadModel.update).toHaveBeenCalledTimes(2);
    });
  });

  describe('weight aggregation (per-piece × quantity)', () => {
    it('multiplies line weight by quantity (regression fix for the per-piece bug)', async () => {
      mockPrisma.orderLineItem.count.mockResolvedValueOnce(2);
      mockPrisma.trackableUnit.count.mockResolvedValueOnce(0);
      mockPrisma.trackableUnit.findMany.mockResolvedValueOnce([]);
      mockPrisma.orderLineItem.findMany.mockResolvedValueOnce([
        { weight: 25, quantity: 4 }, // 100
        { weight: 50, quantity: 2 }, // 100
      ]);

      const event = createTestEvent(EVENT_TYPES.ORDER_LINE_ITEM_CREATED, 'order_line_item', 'li-1', { orderId: 'order-1' });
      await projection.handle(event);

      expect(mockPrisma.orderReadModel.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ totalWeight: 200 }) }),
      );
    });

    it('still prefers per-unit overrides when any unit has weight set', async () => {
      mockPrisma.orderLineItem.count.mockResolvedValueOnce(2);
      mockPrisma.trackableUnit.count.mockResolvedValueOnce(2);
      mockPrisma.trackableUnit.findMany.mockResolvedValueOnce([{ weight: 750 }, { weight: 250 }]);
      mockPrisma.orderLineItem.findMany.mockResolvedValueOnce([{ weight: 1, quantity: 1 }]);

      const event = createTestEvent(EVENT_TYPES.ORDER_LINE_ITEM_CREATED, 'order_line_item', 'li-1', { orderId: 'order-1' });
      await projection.handle(event);

      expect(mockPrisma.orderReadModel.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ totalWeight: 1000 }) }),
      );
    });
  });

  describe('unknown event types', () => {
    it('ignores events it does not handle', async () => {
      const event = createTestEvent('order.some_future_event', 'order', 'order-1', {});

      await projection.handle(event);

      expect(mockPrisma.orderReadModel.upsert).not.toHaveBeenCalled();
      expect(mockPrisma.orderReadModel.update).not.toHaveBeenCalled();
    });
  });
});
