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

  describe('unknown event types', () => {
    it('ignores events it does not handle', async () => {
      const event = createTestEvent('order.some_future_event', 'order', 'order-1', {});

      await projection.handle(event);

      expect(mockPrisma.orderReadModel.upsert).not.toHaveBeenCalled();
      expect(mockPrisma.orderReadModel.update).not.toHaveBeenCalled();
    });
  });
});
