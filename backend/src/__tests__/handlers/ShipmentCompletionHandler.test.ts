import { ShipmentCompletionHandler } from '../../events/handlers/ShipmentCompletionHandler';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestEvent } from '../helpers/testUtils';

function mockShipment(overrides: any = {}) {
  return {
    id: 'ship-1',
    reference: 'SHP-001',
    status: 'in_progress',
    destinationId: 'loc-dest',
    stops: [
      { id: 'stop-dest', locationId: 'loc-dest', sequenceNumber: 2, status: 'completed', stopType: 'delivery' },
      { id: 'stop-origin', locationId: 'loc-origin', sequenceNumber: 1, status: 'completed', stopType: 'pickup' },
    ],
    ...overrides,
  };
}

describe('ShipmentCompletionHandler', () => {
  it('completes an in_progress shipment once every stop is completed', async () => {
    const prisma = {
      shipment: {
        findUnique: jest.fn().mockResolvedValue(mockShipment()),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    } as any;
    const eventBus = { publish: jest.fn().mockResolvedValue(undefined) } as any;
    const handler = new ShipmentCompletionHandler(prisma, eventBus);

    await handler.handle(createTestEvent(EVENT_TYPES.TRACKING_GEOFENCE_ENTERED, 'shipment', 'ship-1', {}));

    expect(prisma.shipment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'ship-1', status: 'in_progress' } })
    );
    expect(eventBus.publish).toHaveBeenCalledTimes(2); // delivered + status_changed
  });

  it('stamps the delivery with the arrival device time, not processing time (#323)', async () => {
    const prisma = {
      shipment: {
        findUnique: jest.fn().mockResolvedValue(mockShipment()),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    } as any;
    const eventBus = { publish: jest.fn().mockResolvedValue(undefined) } as any;
    const handler = new ShipmentCompletionHandler(prisma, eventBus);
    const arrived = '2026-10-01T15:30:00.000Z';

    await handler.handle(createTestEvent(EVENT_TYPES.TRACKING_GEOFENCE_ENTERED, 'shipment', 'ship-1', { eventTime: arrived }));

    expect(prisma.shipment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'complete', deliveryDate: new Date(arrived) } })
    );
    const payloads = eventBus.publish.mock.calls.map((c: any) => c[0].payload);
    expect(payloads[0]).toEqual(expect.objectContaining({ deliveredAt: arrived, eventTime: arrived }));
    expect(payloads[1]).toEqual(expect.objectContaining({ newStatus: 'complete', eventTime: arrived }));
  });

  it('does not double-publish when two events race for the same destination arrival', async () => {
    // A single destination arrival now emits both tracking.geofence_entered and
    // shipment.stop_arrived (#283); this handler subscribes to both. Simulate
    // the second delivery losing the conditional update because the first
    // already flipped status away from in_progress.
    const prisma = {
      shipment: {
        findUnique: jest.fn().mockResolvedValue(mockShipment()),
        updateMany: jest.fn().mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 }),
      },
    } as any;
    const eventBus = { publish: jest.fn().mockResolvedValue(undefined) } as any;
    const handler = new ShipmentCompletionHandler(prisma, eventBus);

    await handler.handle(createTestEvent(EVENT_TYPES.TRACKING_GEOFENCE_ENTERED, 'shipment', 'ship-1', {}));
    await handler.handle(createTestEvent(EVENT_TYPES.SHIPMENT_STOP_ARRIVED, 'shipment', 'ship-1', { stopId: 'stop-dest', shipmentId: 'ship-1' }));

    expect(eventBus.publish).toHaveBeenCalledTimes(2); // only the first delivery's delivered + status_changed
  });

  it('does nothing when the shipment is not in_progress', async () => {
    const prisma = {
      shipment: {
        findUnique: jest.fn().mockResolvedValue(mockShipment({ status: 'complete' })),
        updateMany: jest.fn(),
      },
    } as any;
    const eventBus = { publish: jest.fn() } as any;
    const handler = new ShipmentCompletionHandler(prisma, eventBus);

    await handler.handle(createTestEvent(EVENT_TYPES.TRACKING_GEOFENCE_ENTERED, 'shipment', 'ship-1', {}));

    expect(prisma.shipment.updateMany).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  describe('multi-stop (#324)', () => {
    const threeStops = (middle: string) => mockShipment({
      stops: [
        { id: 'stop-dest', locationId: 'loc-dest', sequenceNumber: 3, status: 'completed', stopType: 'delivery' },
        { id: 'stop-mid', locationId: 'loc-mid', sequenceNumber: 2, status: middle, stopType: 'delivery' },
        { id: 'stop-origin', locationId: 'loc-origin', sequenceNumber: 1, status: 'completed', stopType: 'pickup' },
      ],
    });

    function setup(shipment: any) {
      const prisma = {
        shipment: {
          findUnique: jest.fn().mockResolvedValue(shipment),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      } as any;
      const eventBus = { publish: jest.fn().mockResolvedValue(undefined) } as any;
      return { prisma, eventBus, handler: new ShipmentCompletionHandler(prisma, eventBus) };
    }

    it('does not complete when the destination is done but a middle stop is still pending', async () => {
      const { prisma, handler } = setup(threeStops('pending'));
      await handler.handle(createTestEvent(EVENT_TYPES.SHIPMENT_STOP_ARRIVED, 'shipment', 'ship-1', { stopId: 'stop-dest', shipmentId: 'ship-1' }));
      expect(prisma.shipment.updateMany).not.toHaveBeenCalled();
    });

    it('raises a stops_not_visited exception when the final stop completes with others open', async () => {
      const { eventBus, handler } = setup(threeStops('pending'));
      await handler.handle(createTestEvent(EVENT_TYPES.SHIPMENT_STOP_COMPLETED, 'shipment', 'ship-1', { stopId: 'stop-dest', shipmentId: 'ship-1' }));
      expect(eventBus.publish).toHaveBeenCalledTimes(1);
      expect(eventBus.publish.mock.calls[0][0]).toMatchObject({
        type: EVENT_TYPES.SHIPMENT_EXCEPTION,
        payload: { exceptionType: 'stops_not_visited', stopIds: ['stop-mid'] },
      });
    });

    it('does not flag when a middle stop (not the final one) completes', async () => {
      const shipment = threeStops('completed');
      shipment.stops[0].status = 'pending';
      const { eventBus, handler } = setup(shipment);
      await handler.handle(createTestEvent(EVENT_TYPES.SHIPMENT_STOP_COMPLETED, 'shipment', 'ship-1', { stopId: 'stop-mid', shipmentId: 'ship-1' }));
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('completes when the last open stop is done, in any order, counting skipped stops as done', async () => {
      const { prisma, eventBus, handler } = setup(threeStops('skipped'));
      await handler.handle(createTestEvent(EVENT_TYPES.SHIPMENT_STOP_COMPLETED, 'shipment', 'ship-1', { stopId: 'stop-dest', shipmentId: 'ship-1' }));
      expect(prisma.shipment.updateMany).toHaveBeenCalled();
      expect(eventBus.publish.mock.calls.map((c: any) => c[0].type)).toEqual([EVENT_TYPES.SHIPMENT_DELIVERED, EVENT_TYPES.SHIPMENT_STATUS_CHANGED]);
    });
  });
});

