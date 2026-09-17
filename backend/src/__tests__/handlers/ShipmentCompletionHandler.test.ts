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
      { id: 'stop-dest', locationId: 'loc-dest', sequenceNumber: 2, status: 'arrived', stopType: 'delivery' },
      { id: 'stop-origin', locationId: 'loc-origin', sequenceNumber: 1, status: 'completed', stopType: 'pickup' },
    ],
    ...overrides,
  };
}

describe('ShipmentCompletionHandler', () => {
  it('completes an in_progress shipment whose destination stop has arrived', async () => {
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
});
