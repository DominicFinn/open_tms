import { ArrivalCriteriaEvaluationService } from '../../services/ArrivalCriteriaEvaluationService';

function mockPrisma(opts: {
  stopId: string;
  locationId: string;
  isDestination: boolean;
  originId: string | null;
  destinationId: string | null;
}) {
  const geofenceCriteria = { id: 'crit-1', criteriaType: 'geofence', radiusMeters: 250, lat: 40.0, lng: -74.0, active: true, priority: 10 };
  return {
    shipmentStop: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: opts.stopId,
          locationId: opts.locationId,
          status: 'pending',
          location: { lat: 40.0, lng: -74.0, arrivalCriteria: [geofenceCriteria] },
        },
      ]),
    },
    shipment: {
      findUnique: jest.fn().mockResolvedValue({
        orgId: 'org-1',
        originId: opts.originId,
        destinationId: opts.destinationId,
        origin: { arrivalCriteria: [] },
        destination: { arrivalCriteria: [] },
        stops: [{ id: opts.stopId, locationId: opts.locationId, status: 'pending' }],
        lane: null,
      }),
    },
  } as any;
}

describe('ArrivalCriteriaEvaluationService — order delivery status on arrival', () => {
  it('marks orders delivered (not just in_transit) when the arrival is at the destination stop', async () => {
    const prisma = mockPrisma({
      stopId: 'stop-dest', locationId: 'loc-dest', isDestination: true,
      originId: 'loc-origin', destinationId: 'loc-dest',
    });
    const deliveryService = { updateOrdersForStop: jest.fn().mockResolvedValue(1) } as any;
    const commandBus = { dispatch: jest.fn().mockResolvedValue({ success: true, data: { arrived: true }, events: [] }) } as any;

    const service = new ArrivalCriteriaEvaluationService(prisma, deliveryService, commandBus);
    await service.evaluateAndUpdateOrders({ orgId: 'org-1', shipmentId: 'ship-1', lat: 40.0, lng: -74.0, rawPayload: {} });

    expect(deliveryService.updateOrdersForStop).toHaveBeenCalledWith('org-1', 'stop-dest', 'completed', 'geofence');
    expect(prisma.shipment.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'ship-1', orgId: 'org-1' } }),
    );
  });

  it('marks orders in_transit (not delivered) when the arrival is at a non-destination stop', async () => {
    const prisma = mockPrisma({
      stopId: 'stop-origin', locationId: 'loc-origin', isDestination: false,
      originId: 'loc-origin', destinationId: 'loc-dest',
    });
    const deliveryService = { updateOrdersForStop: jest.fn().mockResolvedValue(1) } as any;
    const commandBus = { dispatch: jest.fn().mockResolvedValue({ success: true, data: { arrived: true }, events: [] }) } as any;

    const service = new ArrivalCriteriaEvaluationService(prisma, deliveryService, commandBus);
    await service.evaluateAndUpdateOrders({ orgId: 'org-1', shipmentId: 'ship-1', lat: 40.0, lng: -74.0, rawPayload: {} });

    expect(deliveryService.updateOrdersForStop).toHaveBeenCalledWith('org-1', 'stop-origin', 'arrived', 'geofence');
  });

  it('does nothing for a shipment in another org', async () => {
    const prisma = mockPrisma({
      stopId: 'stop-dest', locationId: 'loc-dest', isDestination: true,
      originId: 'loc-origin', destinationId: 'loc-dest',
    });
    prisma.shipment.findUnique.mockResolvedValue(null);
    const deliveryService = { updateOrdersForStop: jest.fn() } as any;
    const commandBus = { dispatch: jest.fn() } as any;

    const service = new ArrivalCriteriaEvaluationService(prisma, deliveryService, commandBus);
    const matches = await service.evaluateAndUpdateOrders({ orgId: 'org-2', shipmentId: 'ship-1', lat: 40.0, lng: -74.0, rawPayload: {} });

    expect(matches).toEqual([]);
    expect(prisma.shipmentStop.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ shipment: { orgId: 'org-2' } }) }),
    );
    expect(commandBus.dispatch).not.toHaveBeenCalled();
    expect(deliveryService.updateOrdersForStop).not.toHaveBeenCalled();
  });
});
