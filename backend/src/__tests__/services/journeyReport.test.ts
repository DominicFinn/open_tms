import { buildJourneyReport } from '../../services/tracking/journeyReport';
import { ShipmentJourneyRecord, JourneyRecordStop } from '../../repositories/ShipmentRouteRepository';

const T = (h: number) => new Date(Date.UTC(2026, 9, 5, h));

function stop(spec: Partial<JourneyRecordStop> & Pick<JourneyRecordStop, 'id' | 'locationId' | 'sequenceNumber'>): JourneyRecordStop {
  return {
    locationName: spec.locationId, stopType: 'delivery', purpose: null, label: null,
    status: 'pending', actualArrival: null, actualDeparture: null, ...spec,
  };
}

// Origin → second pickup → fuel stop → drop at the hub → drop at the destination → back to the hub.
const JOURNEY: ShipmentJourneyRecord = {
  originId: 'loc-a',
  destinationId: 'loc-hub',
  stops: [
    stop({ id: 's1', locationId: 'loc-a', sequenceNumber: 1, stopType: 'pickup', status: 'completed', actualArrival: T(8), actualDeparture: T(9) }),
    stop({ id: 's2', locationId: 'loc-b', sequenceNumber: 2, stopType: 'pickup', status: 'completed', actualArrival: T(10), actualDeparture: null }),
    stop({ id: 's3', locationId: 'loc-fuel', sequenceNumber: 3, stopType: 'other', purpose: 'fuel', status: 'completed', actualArrival: T(11), actualDeparture: T(11) }),
    stop({ id: 's4', locationId: 'loc-hub', sequenceNumber: 4, status: 'completed', actualArrival: T(12) }),
    stop({ id: 's5', locationId: 'loc-c', sequenceNumber: 5, status: 'completed', actualArrival: T(14) }),
    stop({ id: 's6', locationId: 'loc-hub', sequenceNumber: 6 }),
  ],
  checkpoints: [
    { checkpointIndex: 1, lat: 40.1, lng: -74, distanceAlongRouteMeters: 1000, fractionComplete: 0.1, eventTime: T(9) },
  ],
};

describe('buildJourneyReport (#348)', () => {
  it('returns every stop in sequence with its type, status and times', () => {
    const report = buildJourneyReport(JOURNEY);

    expect(report.stops.map((s) => [s.id, s.stopType, s.status])).toEqual([
      ['s1', 'pickup', 'completed'], ['s2', 'pickup', 'completed'], ['s3', 'other', 'completed'],
      ['s4', 'delivery', 'completed'], ['s5', 'delivery', 'completed'], ['s6', 'delivery', 'pending'],
    ]);
    expect(report.stops[2]).toEqual(expect.objectContaining({ purpose: 'fuel', actualArrival: T(11), actualDeparture: T(11) }));
    expect(report.checkpoints).toEqual(JOURNEY.checkpoints);
  });

  it('takes the destination as the last visit to the destination location, not the first', () => {
    const report = buildJourneyReport(JOURNEY);

    expect(report.stops.filter((s) => s.isDestination).map((s) => s.id)).toEqual(['s6']);
    expect(report.destination).toEqual({ status: 'pending', actualArrival: null });
    expect(report.origin).toEqual({ status: 'completed', actualArrival: T(8), actualDeparture: T(9) });
    expect(report.stops.filter((s) => s.isOrigin).map((s) => s.id)).toEqual(['s1']);
  });

  it('flags a departure as inferred only on a completed pickup or other stop with no departure time', () => {
    const report = buildJourneyReport(JOURNEY);

    expect(report.stops.filter((s) => s.departureInferred).map((s) => s.id)).toEqual(['s2']);
  });

  it('reports no origin or destination when the shipment has no stops there', () => {
    const report = buildJourneyReport({ originId: 'loc-x', destinationId: 'loc-y', stops: JOURNEY.stops, checkpoints: [] });

    expect(report.origin).toBeNull();
    expect(report.destination).toBeNull();
    expect(report.stops.some((s) => s.isOrigin || s.isDestination)).toBe(false);
  });
});
