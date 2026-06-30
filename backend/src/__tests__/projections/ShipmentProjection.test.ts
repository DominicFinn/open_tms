import { ShipmentProjection } from '../../events/projections/ShipmentProjection';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestEvent } from '../helpers/testUtils';

const mockShipment = {
  id: 'ship-1', reference: 'SH-001', status: 'draft', hasException: false,
  customerId: 'cust-1', carrierId: null, laneId: null,
  proNumber: null, pickupDate: null, deliveryDate: null,
  createdAt: new Date(), updatedAt: new Date(),
  customer: { id: 'cust-1', name: 'Acme' },
  origin: { name: 'Chicago WH', city: 'Chicago', state: 'IL' },
  destination: { name: 'NY Depot', city: 'New York', state: 'NY' },
  carrier: null, lane: null,
  stops: [{ id: 's1' }],
  orderShipments: [{ id: 'os1' }, { id: 'os2' }],
};

const mockPrisma = {
  shipment: {
    findUnique: jest.fn().mockResolvedValue(mockShipment),
  },
  shipmentReadModel: {
    upsert: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({}),
  },
  shipmentStop: {
    count: jest.fn().mockResolvedValue(3),
  },
  carrier: {
    findUnique: jest.fn().mockResolvedValue({ name: 'FastFreight' }),
  },
} as any;

describe('ShipmentProjection', () => {
  let projection: ShipmentProjection;

  beforeEach(() => {
    jest.clearAllMocks();
    projection = new ShipmentProjection(mockPrisma);
  });

  describe('handler metadata', () => {
    it('has correct name and subscribes to shipment and tracking events', () => {
      expect(projection.name).toBe('projection.shipment');
      expect(projection.eventPatterns).toContain('shipment.*');
      expect(projection.eventPatterns).toContain('tracking.*');
    });
  });

  describe('onShipmentCreated', () => {
    it('upserts ShipmentReadModel with denormalized data', async () => {
      const event = createTestEvent(
        EVENT_TYPES.SHIPMENT_CREATED, 'shipment', 'ship-1',
        { shipmentReference: 'SH-001', customerId: 'cust-1', status: 'draft' }
      );

      await projection.handle(event);

      expect(mockPrisma.shipmentReadModel.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ship-1' },
          create: expect.objectContaining({
            reference: 'SH-001',
            customerName: 'Acme',
            originCity: 'Chicago',
            destinationCity: 'New York',
            orderCount: 2,
            stopCount: 1,
          }),
        })
      );
    });
  });

  describe('onStatusChanged', () => {
    it('updates status in read model', async () => {
      const event = createTestEvent(
        EVENT_TYPES.SHIPMENT_STATUS_CHANGED, 'shipment', 'ship-1',
        { previousStatus: 'draft', newStatus: 'in_progress', shipmentReference: 'SH-001' }
      );

      await projection.handle(event);

      expect(mockPrisma.shipmentReadModel.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ship-1' },
          data: expect.objectContaining({ status: 'in_progress' }),
        })
      );
    });
  });

  describe('onShipmentDelivered', () => {
    it('marks the read model complete', async () => {
      const event = createTestEvent(
        EVENT_TYPES.SHIPMENT_DELIVERED, 'shipment', 'ship-1',
        { shipmentReference: 'SH-001', deliveredAt: '2026-07-03T10:00:00Z' }
      );

      await projection.handle(event);

      expect(mockPrisma.shipmentReadModel.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ship-1' },
          data: expect.objectContaining({ status: 'complete' }),
        })
      );
    });
  });

  describe('onShipmentDeleted', () => {
    it('removes the soft-deleted shipment from the read model', async () => {
      const deleteFn = jest.fn().mockResolvedValue({});
      const prisma = { shipmentReadModel: { delete: deleteFn } } as any;
      const proj = new ShipmentProjection(prisma);
      const event = createTestEvent(
        EVENT_TYPES.SHIPMENT_DELETED, 'shipment', 'ship-1',
        { shipmentReference: 'SH-001', softDelete: true }
      );

      await proj.handle(event);

      expect(deleteFn).toHaveBeenCalledWith({ where: { id: 'ship-1' } });
    });
  });

  describe('onShipmentUnarchived', () => {
    it('re-inserts the restored shipment into the read model', async () => {
      const event = createTestEvent(
        EVENT_TYPES.SHIPMENT_UNARCHIVED, 'shipment', 'ship-1',
        { shipmentReference: 'SH-001' }
      );

      await projection.handle(event);

      // Routed through the create/upsert path now that archived is cleared.
      expect(mockPrisma.shipmentReadModel.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'ship-1' } })
      );
    });
  });

  describe('onShipmentCreated guard', () => {
    it('does not resurrect a shipment already archived/deleted (out-of-order events)', async () => {
      const findUnique = jest.fn().mockResolvedValue({
        ...mockShipment, archived: true, customer: { id: 'cust-1', name: 'Acme' },
      });
      const upsert = jest.fn();
      const del = jest.fn().mockResolvedValue({});
      const prisma = {
        shipment: { findUnique },
        shipmentReadModel: { upsert, delete: del },
      } as any;
      const proj = new ShipmentProjection(prisma);
      const event = createTestEvent(EVENT_TYPES.SHIPMENT_CREATED, 'shipment', 'ship-1', {});

      await proj.handle(event);

      expect(upsert).not.toHaveBeenCalled();
      expect(del).toHaveBeenCalledWith({ where: { id: 'ship-1' } });
    });
  });

  describe('onShipmentException', () => {
    it('sets the hasException flag without changing lifecycle status', async () => {
      const event = createTestEvent(
        EVENT_TYPES.SHIPMENT_EXCEPTION, 'shipment', 'ship-1',
        { shipmentReference: 'SH-001', exceptionType: 'carrier_exception' }
      );

      await projection.handle(event);

      const call = mockPrisma.shipmentReadModel.update.mock.calls[0][0];
      expect(call.where).toEqual({ id: 'ship-1' });
      expect(call.data).toEqual(expect.objectContaining({ hasException: true }));
      expect(call.data.status).toBeUndefined();
    });
  });

  describe('onCarrierAssigned', () => {
    it('updates carrier name in read model by looking up carrier', async () => {
      const event = createTestEvent(
        EVENT_TYPES.SHIPMENT_CARRIER_ASSIGNED, 'shipment', 'ship-1',
        { carrierId: 'carrier-1' }
      );

      await projection.handle(event);

      expect(mockPrisma.carrier.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'carrier-1' } })
      );
      expect(mockPrisma.shipmentReadModel.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            carrierId: 'carrier-1',
            carrierName: 'FastFreight',
          }),
        })
      );
    });
  });

  describe('onLocationReceived', () => {
    it('updates current position in read model', async () => {
      const event = createTestEvent(
        EVENT_TYPES.TRACKING_LOCATION_RECEIVED, 'tracking', 'ship-1',
        { shipmentId: 'ship-1', lat: 41.8781, lng: -87.6298, eventTime: '2026-04-10T12:00:00Z' }
      );

      await projection.handle(event);

      expect(mockPrisma.shipmentReadModel.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ship-1' },
          data: expect.objectContaining({
            currentLat: 41.8781,
            currentLng: -87.6298,
          }),
        })
      );
    });
  });

  describe('onStopUpdate', () => {
    it('re-counts stops on stop events', async () => {
      const event = createTestEvent(
        EVENT_TYPES.SHIPMENT_STOP_ARRIVED, 'shipment', 'ship-1', {}
      );

      await projection.handle(event);

      expect(mockPrisma.shipmentStop.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: { shipmentId: 'ship-1' } })
      );
      expect(mockPrisma.shipmentReadModel.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ stopCount: 3 }),
        })
      );
    });
  });
});
