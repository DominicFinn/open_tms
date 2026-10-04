import { ArrivalCriteriaEvaluationService } from '../../services/ArrivalCriteriaEvaluationService';
import { RECORD_GEOFENCE_ARRIVAL } from '../../commands/tracking/RecordGeofenceArrivalCommand';
import { RECORD_GEOFENCE_DEPARTURE } from '../../commands/tracking/RecordGeofenceDepartureCommand';
import { RECORD_JOURNEY_CHECKPOINT } from '../../commands/tracking/RecordJourneyCheckpointCommand';
import { encodePolyline } from '../../services/routing/GoogleMapsDirectionsService';

// Three locations far enough apart that a ping can only be inside one 250m geofence at a time.
const LOCATIONS: Record<string, { lat: number; lng: number }> = {
  'loc-origin': { lat: 40.0, lng: -74.0 },
  'loc-mid': { lat: 40.5, lng: -74.0 },
  'loc-dest': { lat: 41.0, lng: -74.0 },
};

interface StopSpec {
  id: string;
  locationId: string;
  sequenceNumber: number;
  status?: string;
  stopType?: string;
  actualArrival?: Date | null;
  actualDeparture?: Date | null;
}

function stop(spec: StopSpec) {
  const { lat, lng } = LOCATIONS[spec.locationId];
  return {
    status: 'pending', actualArrival: null, actualDeparture: null, ...spec,
    location: {
      lat, lng,
      arrivalCriteria: [{ id: `crit-${spec.locationId}`, criteriaType: 'geofence', radiusMeters: 250, active: true, priority: 10 }],
    },
  };
}

function mockPrisma(stops: StopSpec[], route: { encodedPolyline: string } | null = null) {
  return {
    shipment: {
      findUnique: jest.fn().mockResolvedValue({
        orgId: 'org-1',
        originId: 'loc-origin',
        destinationId: 'loc-dest',
        destination: { ...LOCATIONS['loc-dest'], arrivalCriteria: [] },
        stops: stops.map(stop),
        route,
        lane: null,
      }),
    },
  } as any;
}

function setup(stops: StopSpec[], route: { encodedPolyline: string } | null = null) {
  const prisma = mockPrisma(stops, route);
  const deliveryService = { updateOrdersForStop: jest.fn().mockResolvedValue(1) } as any;
  const commandBus = {
    dispatch: jest.fn().mockImplementation((c: any) => Promise.resolve({
      success: true, events: [],
      data: c.type === RECORD_GEOFENCE_ARRIVAL ? { arrived: true } : { departed: true },
    })),
  } as any;
  const service = new ArrivalCriteriaEvaluationService(prisma, deliveryService, commandBus);
  const ping = (locationId: string, extra: object = {}) => service.evaluateAndUpdateOrders({
    orgId: 'org-1', shipmentId: 'ship-1', ...LOCATIONS[locationId], rawPayload: {}, ...extra,
  });
  const dispatched = () => commandBus.dispatch.mock.calls.map((c: any) => [c[0].type, c[0].payload]);
  return { prisma, deliveryService, commandBus, ping, dispatched };
}

const ROUTE: StopSpec[] = [
  { id: 'stop-origin', locationId: 'loc-origin', sequenceNumber: 1 },
  { id: 'stop-mid', locationId: 'loc-mid', sequenceNumber: 2 },
  { id: 'stop-dest', locationId: 'loc-dest', sequenceNumber: 3 },
];

describe('ArrivalCriteriaEvaluationService', () => {
  it('arrives at the origin without completing it', async () => {
    const { ping, dispatched, deliveryService } = setup(ROUTE);

    await ping('loc-origin');

    expect(dispatched()).toEqual([[RECORD_GEOFENCE_ARRIVAL, expect.objectContaining({ stopId: 'stop-origin', completesStop: false })]]);
    expect(deliveryService.updateOrdersForStop).toHaveBeenCalledWith('org-1', 'stop-origin', 'arrived', 'geofence', expect.any(Date));
  });

  it('departs an arrived origin once a ping is outside its geofence', async () => {
    const { ping, dispatched } = setup([{ ...ROUTE[0], status: 'arrived' }, ROUTE[1], ROUTE[2]]);

    await ping('loc-mid', { lat: 40.2 }); // between origin and middle stop, inside neither

    expect(dispatched()).toEqual([[RECORD_GEOFENCE_DEPARTURE, expect.objectContaining({ stopId: 'stop-origin', lat: 40.2 })]]);
  });

  it('completes a middle stop on entry, marking its orders delivered, and leaves the destination pending (#324)', async () => {
    const { ping, dispatched, deliveryService } = setup([{ ...ROUTE[0], status: 'completed' }, ROUTE[1], ROUTE[2]]);

    await ping('loc-mid');

    expect(dispatched()).toEqual([[RECORD_GEOFENCE_ARRIVAL, expect.objectContaining({ stopId: 'stop-mid', completesStop: true })]]);
    expect(deliveryService.updateOrdersForStop).toHaveBeenCalledWith('org-1', 'stop-mid', 'completed', 'geofence', expect.any(Date));
  });

  it('infers the origin departure first when a later stop is reached before any departure was seen', async () => {
    const { ping, dispatched } = setup(ROUTE);

    await ping('loc-mid');

    expect(dispatched()).toEqual([
      [RECORD_GEOFENCE_DEPARTURE, expect.objectContaining({ stopId: 'stop-origin', inferred: true })],
      [RECORD_GEOFENCE_ARRIVAL, expect.objectContaining({ stopId: 'stop-mid', completesStop: true })],
    ]);
  });

  it('stamps the arrival and the order update with the device time, and passes the device id', async () => {
    const { ping, dispatched, deliveryService } = setup([{ ...ROUTE[0], status: 'completed' }, ROUTE[1], ROUTE[2]]);
    const deviceTime = '2026-01-01T08:30:00.000Z';

    await ping('loc-dest', { eventTime: deviceTime, deviceId: 'dev-1' });

    expect(dispatched()[0][1]).toEqual(expect.objectContaining({ stopId: 'stop-dest', eventTime: deviceTime, deviceId: 'dev-1' }));
    expect(deliveryService.updateOrdersForStop).toHaveBeenCalledWith('org-1', 'stop-dest', 'completed', 'geofence', new Date(deviceTime));
  });

  it('does nothing for a shipment in another org', async () => {
    const { prisma, ping, commandBus, deliveryService } = setup(ROUTE);
    prisma.shipment.findUnique.mockResolvedValue(null);

    const matches = await ping('loc-dest', { orgId: 'org-2' });

    expect(matches).toEqual([]);
    expect(prisma.shipment.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'ship-1', orgId: 'org-2' } }));
    expect(commandBus.dispatch).not.toHaveBeenCalled();
    expect(deliveryService.updateOrdersForStop).not.toHaveBeenCalled();
  });

  describe('repeat visits to the same location', () => {
    // Origin -> middle -> back to the origin location for a final drop.
    const returnLeg = (middle: Partial<StopSpec>): StopSpec[] => [
      { id: 'stop-origin', locationId: 'loc-origin', sequenceNumber: 1, status: 'completed', actualDeparture: new Date('2026-01-01T06:00:00Z') },
      { id: 'stop-mid', locationId: 'loc-mid', sequenceNumber: 2, ...middle },
      { id: 'stop-return', locationId: 'loc-origin', sequenceNumber: 3 },
    ];

    it('ignores the return visit while the vehicle has not been anywhere else since leaving', async () => {
      const { ping, commandBus } = setup(returnLeg({ status: 'pending' }));

      await ping('loc-origin');

      expect(commandBus.dispatch).not.toHaveBeenCalled();
    });

    it('completes the return visit once another stop has been completed in between', async () => {
      const { ping, dispatched } = setup(returnLeg({ status: 'completed', actualArrival: new Date('2026-01-01T09:00:00Z') }));

      await ping('loc-origin');

      expect(dispatched()).toEqual([[RECORD_GEOFENCE_ARRIVAL, expect.objectContaining({ stopId: 'stop-return', completesStop: true })]]);
    });
  });

  it("measures checkpoints along a custom-route shipment's own route (#328)", async () => {
    const ownRoute = { encodedPolyline: encodePolyline([LOCATIONS['loc-origin'], LOCATIONS['loc-mid'], LOCATIONS['loc-dest']]) };
    const { ping, dispatched } = setup([{ ...ROUTE[0], status: 'completed' }, ROUTE[1], ROUTE[2]], ownRoute);

    await ping('loc-mid', { lat: 40.75 }); // between the middle stop and the destination, inside neither

    expect(dispatched()).toEqual([[RECORD_JOURNEY_CHECKPOINT, expect.objectContaining({ shipmentId: 'ship-1' })]]);
  });

  describe('a second pickup (#329)', () => {
    const milkRun = (mid: Partial<StopSpec>): StopSpec[] => [
      { id: 'stop-origin', locationId: 'loc-origin', sequenceNumber: 1, stopType: 'pickup', status: 'completed' },
      { id: 'stop-mid', locationId: 'loc-mid', sequenceNumber: 2, stopType: 'pickup', ...mid },
      { id: 'stop-dest', locationId: 'loc-dest', sequenceNumber: 3, stopType: 'delivery' },
    ];

    it('arrives at a later pickup without completing it', async () => {
      const { ping, dispatched, deliveryService } = setup(milkRun({}));
      await ping('loc-mid');
      expect(dispatched()).toEqual([[RECORD_GEOFENCE_ARRIVAL, expect.objectContaining({ stopId: 'stop-mid', completesStop: false })]]);
      expect(deliveryService.updateOrdersForStop).toHaveBeenCalledWith('org-1', 'stop-mid', 'arrived', 'geofence', expect.any(Date));
    });

    it('completes a later pickup when the vehicle leaves it, moving its orders', async () => {
      const { ping, dispatched, deliveryService } = setup(milkRun({ status: 'arrived' }));
      await ping('loc-mid', { lat: 40.75 });
      expect(dispatched()).toEqual([[RECORD_GEOFENCE_DEPARTURE, expect.objectContaining({ stopId: 'stop-mid' })]]);
      expect(deliveryService.updateOrdersForStop).toHaveBeenCalledWith('org-1', 'stop-mid', 'completed', 'geofence', expect.any(Date));
    });

    it('infers the departure from a pickup it never saw the vehicle leave when a drop is reached', async () => {
      const { ping, dispatched, deliveryService } = setup(milkRun({}));
      await ping('loc-dest');
      expect(dispatched()).toEqual([
        [RECORD_GEOFENCE_DEPARTURE, expect.objectContaining({ stopId: 'stop-mid', inferred: true })],
        [RECORD_GEOFENCE_ARRIVAL, expect.objectContaining({ stopId: 'stop-dest', completesStop: true })],
      ]);
      expect(deliveryService.updateOrdersForStop).toHaveBeenCalledWith('org-1', 'stop-mid', 'completed', 'geofence', expect.any(Date));
    });
  });
});

