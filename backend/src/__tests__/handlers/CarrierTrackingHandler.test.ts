import { CarrierTrackingHandler } from '../../events/handlers/CarrierTrackingHandler';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestEvent, mockEventBus } from '../helpers/testUtils';

/* ---------- shared mocks ---------- */

function buildMockPrisma(overrides: any = {}) {
  return {
    shipment: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'ship-1',
        reference: 'SH-001',
        status: 'in_transit',
        carrierId: 'carrier-1',
        ...overrides.shipment,
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    carrierTrackingIntegration: {
      update: jest.fn().mockResolvedValue({}),
    },
  } as any;
}

/* ---------- tests ---------- */

describe('CarrierTrackingHandler', () => {
  beforeEach(() => jest.clearAllMocks());

  /* ---- CARRIER_TRACKING_DELIVERED ---- */

  describe('CARRIER_TRACKING_DELIVERED', () => {
    it('updates shipment status to delivered when in_transit', async () => {
      const prisma = buildMockPrisma();
      const { bus } = mockEventBus();
      const handler = new CarrierTrackingHandler(prisma, bus);

      const event = createTestEvent(
        EVENT_TYPES.CARRIER_TRACKING_DELIVERED,
        'carrier_tracking_event',
        'evt-1',
        {
          shipmentId: 'ship-1',
          carrierId: 'carrier-1',
          trackingNumber: '794644790132',
          providerType: 'fedex',
          occurredAt: '2026-04-12T15:00:00Z',
          signedBy: 'J. Smith',
        },
      );

      await handler.handle(event);

      expect(prisma.shipment.update).toHaveBeenCalledWith({
        where: { id: 'ship-1' },
        data: {
          status: 'delivered',
          deliveryDate: new Date('2026-04-12T15:00:00Z'),
        },
      });
    });

    it('emits SHIPMENT_DELIVERED and SHIPMENT_STATUS_CHANGED events', async () => {
      const prisma = buildMockPrisma();
      const { bus, persisted } = mockEventBus();
      const handler = new CarrierTrackingHandler(prisma, bus);

      const event = createTestEvent(
        EVENT_TYPES.CARRIER_TRACKING_DELIVERED,
        'carrier_tracking_event',
        'evt-1',
        {
          shipmentId: 'ship-1',
          trackingNumber: '794644790132',
          providerType: 'fedex',
          occurredAt: '2026-04-12T15:00:00Z',
          signedBy: 'J. Smith',
        },
      );

      await handler.handle(event);

      expect(bus.publish).toHaveBeenCalledTimes(2);

      const deliveredEvent = persisted.find(e => e.type === EVENT_TYPES.SHIPMENT_DELIVERED);
      expect(deliveredEvent).toBeDefined();
      expect(deliveredEvent!.entityId).toBe('ship-1');
      expect(deliveredEvent!.payload).toEqual(
        expect.objectContaining({
          source: 'carrier_tracking',
          providerType: 'fedex',
          signedBy: 'J. Smith',
        }),
      );

      const statusEvent = persisted.find(e => e.type === EVENT_TYPES.SHIPMENT_STATUS_CHANGED);
      expect(statusEvent).toBeDefined();
      expect(statusEvent!.payload).toEqual(
        expect.objectContaining({
          previousStatus: 'in_transit',
          newStatus: 'delivered',
        }),
      );
    });

    it('skips delivery for already-delivered shipment', async () => {
      const prisma = buildMockPrisma({ shipment: { status: 'delivered' } });
      const { bus } = mockEventBus();
      const handler = new CarrierTrackingHandler(prisma, bus);

      const event = createTestEvent(
        EVENT_TYPES.CARRIER_TRACKING_DELIVERED,
        'carrier_tracking_event',
        'evt-1',
        { shipmentId: 'ship-1', trackingNumber: '794644790132', providerType: 'fedex' },
      );

      await handler.handle(event);

      expect(prisma.shipment.update).not.toHaveBeenCalled();
      expect(bus.publish).not.toHaveBeenCalled();
    });

    it('skips delivery for draft shipment', async () => {
      const prisma = buildMockPrisma({ shipment: { status: 'draft' } });
      const { bus } = mockEventBus();
      const handler = new CarrierTrackingHandler(prisma, bus);

      const event = createTestEvent(
        EVENT_TYPES.CARRIER_TRACKING_DELIVERED,
        'carrier_tracking_event',
        'evt-1',
        { shipmentId: 'ship-1' },
      );

      await handler.handle(event);

      expect(prisma.shipment.update).not.toHaveBeenCalled();
    });

    it('handles dispatched shipment as deliverable', async () => {
      const prisma = buildMockPrisma({ shipment: { status: 'dispatched' } });
      const { bus } = mockEventBus();
      const handler = new CarrierTrackingHandler(prisma, bus);

      const event = createTestEvent(
        EVENT_TYPES.CARRIER_TRACKING_DELIVERED,
        'carrier_tracking_event',
        'evt-1',
        { shipmentId: 'ship-1', trackingNumber: 'T123', providerType: 'ups' },
      );

      await handler.handle(event);

      expect(prisma.shipment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'delivered' }),
        }),
      );
    });

    it('skips delivery when shipmentId is missing', async () => {
      const prisma = buildMockPrisma();
      const { bus } = mockEventBus();
      const handler = new CarrierTrackingHandler(prisma, bus);

      const event = createTestEvent(
        EVENT_TYPES.CARRIER_TRACKING_DELIVERED,
        'carrier_tracking_event',
        'evt-1',
        { trackingNumber: 'T123' }, // no shipmentId
      );

      await handler.handle(event);

      expect(prisma.shipment.findUnique).not.toHaveBeenCalled();
    });
  });

  /* ---- CARRIER_TRACKING_EXCEPTION ---- */

  describe('CARRIER_TRACKING_EXCEPTION', () => {
    it('transitions shipment to exception status', async () => {
      const prisma = buildMockPrisma();
      const { bus } = mockEventBus();
      const handler = new CarrierTrackingHandler(prisma, bus);

      const event = createTestEvent(
        EVENT_TYPES.CARRIER_TRACKING_EXCEPTION,
        'carrier_tracking_event',
        'evt-1',
        {
          shipmentId: 'ship-1',
          carrierId: 'carrier-1',
          trackingNumber: '794644790132',
          providerType: 'fedex',
          statusDetail: 'Package damaged in transit',
        },
      );

      await handler.handle(event);

      expect(prisma.shipment.update).toHaveBeenCalledWith({
        where: { id: 'ship-1' },
        data: { status: 'exception' },
      });
    });

    it('emits SHIPMENT_EXCEPTION and SHIPMENT_STATUS_CHANGED events', async () => {
      const prisma = buildMockPrisma();
      const { bus, persisted } = mockEventBus();
      const handler = new CarrierTrackingHandler(prisma, bus);

      const event = createTestEvent(
        EVENT_TYPES.CARRIER_TRACKING_EXCEPTION,
        'carrier_tracking_event',
        'evt-1',
        {
          shipmentId: 'ship-1',
          trackingNumber: '794644790132',
          providerType: 'fedex',
          statusDetail: 'Package damaged',
        },
      );

      await handler.handle(event);

      // Should emit SHIPMENT_EXCEPTION + SHIPMENT_STATUS_CHANGED
      expect(bus.publish).toHaveBeenCalledTimes(2);

      const exceptionEvent = persisted.find(e => e.type === EVENT_TYPES.SHIPMENT_EXCEPTION);
      expect(exceptionEvent).toBeDefined();
      expect(exceptionEvent!.payload).toEqual(
        expect.objectContaining({
          exceptionType: 'carrier_exception',
          reason: 'Package damaged',
          source: 'carrier_tracking',
        }),
      );

      const statusEvent = persisted.find(e => e.type === EVENT_TYPES.SHIPMENT_STATUS_CHANGED);
      expect(statusEvent).toBeDefined();
      expect(statusEvent!.payload).toEqual(
        expect.objectContaining({
          previousStatus: 'in_transit',
          newStatus: 'exception',
        }),
      );
    });

    it('emits exception event but does not re-transition if already in exception', async () => {
      const prisma = buildMockPrisma({ shipment: { status: 'exception' } });
      const { bus, persisted } = mockEventBus();
      const handler = new CarrierTrackingHandler(prisma, bus);

      const event = createTestEvent(
        EVENT_TYPES.CARRIER_TRACKING_EXCEPTION,
        'carrier_tracking_event',
        'evt-1',
        {
          shipmentId: 'ship-1',
          trackingNumber: 'T123',
          providerType: 'dhl',
          statusDetail: 'Address unknown',
        },
      );

      await handler.handle(event);

      // Should still emit SHIPMENT_EXCEPTION but NOT update status
      expect(bus.publish).toHaveBeenCalledTimes(1);
      expect(persisted[0].type).toBe(EVENT_TYPES.SHIPMENT_EXCEPTION);
      expect(prisma.shipment.update).not.toHaveBeenCalled();
    });

    it('skips exception for already-delivered shipment', async () => {
      const prisma = buildMockPrisma({ shipment: { status: 'delivered' } });
      const { bus } = mockEventBus();
      const handler = new CarrierTrackingHandler(prisma, bus);

      const event = createTestEvent(
        EVENT_TYPES.CARRIER_TRACKING_EXCEPTION,
        'carrier_tracking_event',
        'evt-1',
        { shipmentId: 'ship-1', statusDetail: 'Test' },
      );

      await handler.handle(event);

      expect(bus.publish).not.toHaveBeenCalled();
      expect(prisma.shipment.update).not.toHaveBeenCalled();
    });
  });

  /* ---- CARRIER_TRACKING_INTEGRATION_ERROR ---- */

  describe('CARRIER_TRACKING_INTEGRATION_ERROR', () => {
    it('updates integration status to error', async () => {
      const prisma = buildMockPrisma();
      const { bus } = mockEventBus();
      const handler = new CarrierTrackingHandler(prisma, bus);

      const event = createTestEvent(
        EVENT_TYPES.CARRIER_TRACKING_INTEGRATION_ERROR,
        'carrier_tracking_integration',
        'int-1',
        { error: 'OAuth token expired', retryable: true },
      );

      await handler.handle(event);

      expect(prisma.carrierTrackingIntegration.update).toHaveBeenCalledWith({
        where: { id: 'int-1' },
        data: { status: 'error' },
      });
    });

    it('skips when entityId is missing', async () => {
      const prisma = buildMockPrisma();
      const { bus } = mockEventBus();
      const handler = new CarrierTrackingHandler(prisma, bus);

      const event = createTestEvent(
        EVENT_TYPES.CARRIER_TRACKING_INTEGRATION_ERROR,
        'carrier_tracking_integration',
        '', // empty entityId
        { error: 'Some error' },
      );

      await handler.handle(event);

      expect(prisma.carrierTrackingIntegration.update).not.toHaveBeenCalled();
    });
  });

  /* ---- CARRIER_TRACKING_UPDATE_RECEIVED (status bridging) ---- */

  describe('CARRIER_TRACKING_UPDATE_RECEIVED', () => {
    it('advances shipment from draft to in_transit on in_transit tracking event', async () => {
      const prisma = buildMockPrisma({ shipment: { status: 'draft' } });
      const { bus, persisted } = mockEventBus();
      const handler = new CarrierTrackingHandler(prisma, bus);

      const event = createTestEvent(
        EVENT_TYPES.CARRIER_TRACKING_UPDATE_RECEIVED,
        'carrier_tracking_event',
        'evt-1',
        {
          shipmentId: 'ship-1',
          status: 'in_transit',
          trackingNumber: 'T123',
          providerType: 'ups',
        },
      );

      await handler.handle(event);

      expect(prisma.shipment.update).toHaveBeenCalledWith({
        where: { id: 'ship-1' },
        data: { status: 'in_transit' },
      });

      const statusEvent = persisted.find(e => e.type === EVENT_TYPES.SHIPMENT_STATUS_CHANGED);
      expect(statusEvent).toBeDefined();
      expect(statusEvent!.payload).toEqual(
        expect.objectContaining({
          previousStatus: 'draft',
          newStatus: 'in_transit',
        }),
      );
    });

    it('does not regress status from in_transit to draft on info_received', async () => {
      const prisma = buildMockPrisma({ shipment: { status: 'in_transit' } });
      const { bus } = mockEventBus();
      const handler = new CarrierTrackingHandler(prisma, bus);

      const event = createTestEvent(
        EVENT_TYPES.CARRIER_TRACKING_UPDATE_RECEIVED,
        'carrier_tracking_event',
        'evt-1',
        {
          shipmentId: 'ship-1',
          status: 'info_received',
          trackingNumber: 'T123',
          providerType: 'fedex',
        },
      );

      await handler.handle(event);

      expect(prisma.shipment.update).not.toHaveBeenCalled();
      expect(bus.publish).not.toHaveBeenCalled();
    });

    it('does not process delivered status (handled by dedicated handler)', async () => {
      const prisma = buildMockPrisma({ shipment: { status: 'in_transit' } });
      const { bus } = mockEventBus();
      const handler = new CarrierTrackingHandler(prisma, bus);

      const event = createTestEvent(
        EVENT_TYPES.CARRIER_TRACKING_UPDATE_RECEIVED,
        'carrier_tracking_event',
        'evt-1',
        {
          shipmentId: 'ship-1',
          status: 'delivered',
          trackingNumber: 'T123',
          providerType: 'ups',
        },
      );

      await handler.handle(event);

      expect(prisma.shipment.update).not.toHaveBeenCalled();
    });

    it('does not process exception status (handled by dedicated handler)', async () => {
      const prisma = buildMockPrisma({ shipment: { status: 'in_transit' } });
      const { bus } = mockEventBus();
      const handler = new CarrierTrackingHandler(prisma, bus);

      const event = createTestEvent(
        EVENT_TYPES.CARRIER_TRACKING_UPDATE_RECEIVED,
        'carrier_tracking_event',
        'evt-1',
        {
          shipmentId: 'ship-1',
          status: 'exception',
          trackingNumber: 'T123',
          providerType: 'dhl',
        },
      );

      await handler.handle(event);

      expect(prisma.shipment.update).not.toHaveBeenCalled();
    });
  });
});
