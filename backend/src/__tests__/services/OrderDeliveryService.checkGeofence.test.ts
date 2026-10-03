import { OrderDeliveryService } from '../../services/OrderDeliveryService';

function mockPrisma(stop: { status: string }) {
  const tx = {
    shipmentStop: { update: jest.fn().mockResolvedValue({}) },
    order: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  return {
    shipmentStop: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'stop-1',
          status: stop.status,
          geofenceRadius: 250,
          orders: [],
          location: { lat: 40.0, lng: -74.0, name: 'Test Dock' },
        },
      ]),
      findUnique: jest.fn().mockResolvedValue({
        id: 'stop-1', status: stop.status, actualArrival: null, actualDeparture: null,
        shipmentId: 'ship-1', orders: [], shipment: { orgId: 'org-1' },
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn((fn: Function) => fn(tx)),
  } as any;
}

describe('OrderDeliveryService.checkGeofenceAndUpdateOrders — repeat-ping idempotency', () => {
  it('marks a pending stop arrived on the first matching ping', async () => {
    const prisma = mockPrisma({ status: 'pending' });
    const service = new OrderDeliveryService(prisma);

    await service.checkGeofenceAndUpdateOrders('org-1', 'ship-1', 40.0, -74.0);

    expect(prisma.shipmentStop.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'stop-1', shipment: { orgId: 'org-1' } }, data: expect.objectContaining({ status: 'arrived' }) })
    );
    expect(prisma.shipmentStop.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ shipmentId: 'ship-1', shipment: { orgId: 'org-1' } }) })
    );
  });

  it('does not re-stamp a stop that is already arrived on a repeat ping', async () => {
    const prisma = mockPrisma({ status: 'arrived' });
    const service = new OrderDeliveryService(prisma);

    await service.checkGeofenceAndUpdateOrders('org-1', 'ship-1', 40.0, -74.0);

    expect(prisma.shipmentStop.update).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not downgrade a completed stop back to arrived on a repeat ping', async () => {
    // Regression case: a stop already completed via the event-driven path
    // (#283) must not be reverted by this legacy evaluator re-matching the
    // same geofence on a later ping.
    const prisma = mockPrisma({ status: 'completed' });
    const service = new OrderDeliveryService(prisma);

    await service.checkGeofenceAndUpdateOrders('org-1', 'ship-1', 40.0, -74.0);

    expect(prisma.shipmentStop.update).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
