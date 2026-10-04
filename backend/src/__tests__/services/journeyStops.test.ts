import { actionableStops, findDestinationStop, findOriginStop, JourneyStop } from '../../services/tracking/journeyStops';

function stop(id: string, locationId: string, sequenceNumber: number, extra: Partial<JourneyStop> = {}): JourneyStop {
  return { id, locationId, sequenceNumber, status: 'pending', actualArrival: null, actualDeparture: null, ...extra };
}

describe('journeyStops', () => {
  it('finds the origin as the first stop at the origin location, and the destination as the last at its location', () => {
    const stops = [stop('c', 'A', 3), stop('a', 'A', 1), stop('b', 'B', 2)];
    expect(findOriginStop(stops, 'A')?.id).toBe('a');
    expect(findDestinationStop(stops, 'A')?.id).toBe('c');
    expect(findOriginStop(stops, null)).toBeNull();
  });

  it('offers the lowest open stop per location and skips locations with nothing open', () => {
    const stops = [stop('a', 'A', 1, { status: 'completed' }), stop('b', 'B', 2, { status: 'arrived' }), stop('c', 'C', 3)];
    expect(actionableStops(stops).map((s) => s.id)).toEqual(['b', 'c']);
  });

  it('holds back a repeat visit until another location has been completed after the earlier one', () => {
    const left = new Date('2026-01-01T06:00:00Z');
    const base = [stop('a', 'A', 1, { status: 'completed', actualDeparture: left }), stop('c', 'A', 3)];

    expect(actionableStops([...base, stop('b', 'B', 2)]).map((s) => s.id)).toEqual(['b']);
    expect(actionableStops([...base, stop('b', 'B', 2, { status: 'completed', actualArrival: new Date('2026-01-01T07:00:00Z') })]).map((s) => s.id))
      .toEqual(['c']);
  });

  it('falls back to route order when the earlier visit has no completion time', () => {
    const stops = [stop('a', 'A', 1, { status: 'completed' }), stop('b', 'B', 2, { status: 'completed' }), stop('c', 'A', 3)];
    expect(actionableStops(stops).map((s) => s.id)).toEqual(['c']);
  });
});
