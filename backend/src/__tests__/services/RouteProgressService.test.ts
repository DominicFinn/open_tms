import { locateOnRoute, checkpointIndexForFraction, passedCheckpoints, fractionOfSpan } from '../../services/routing/RouteProgressService';
import { encodePolyline } from '../../services/routing/GoogleMapsDirectionsService';

describe('RouteProgressService', () => {
  // A straight, evenly-spaced route so fraction/distance are easy to reason about.
  const routePoints = [
    { lat: 40.0, lng: -74.0 },
    { lat: 40.25, lng: -74.0 },
    { lat: 40.5, lng: -74.0 },
    { lat: 40.75, lng: -74.0 },
    { lat: 41.0, lng: -74.0 },
  ];
  const encodedRoute = encodePolyline(routePoints);

  describe('locateOnRoute', () => {
    it('reports ~0 fraction at the start of the route', () => {
      const progress = locateOnRoute({ lat: 40.0, lng: -74.0 }, encodedRoute);
      expect(progress).not.toBeNull();
      expect(progress!.fraction).toBeCloseTo(0, 2);
      expect(progress!.distanceAlongRouteMeters).toBeLessThan(1000);
    });

    it('reports ~1 fraction at the end of the route', () => {
      const progress = locateOnRoute({ lat: 41.0, lng: -74.0 }, encodedRoute);
      expect(progress).not.toBeNull();
      expect(progress!.fraction).toBeCloseTo(1, 2);
    });

    it('reports ~0.5 fraction at the midpoint', () => {
      const progress = locateOnRoute({ lat: 40.5, lng: -74.0 }, encodedRoute);
      expect(progress).not.toBeNull();
      expect(progress!.fraction).toBeCloseTo(0.5, 1);
    });

    it('returns null for a degenerate (single-point) polyline', () => {
      const singlePoint = encodePolyline([{ lat: 40.0, lng: -74.0 }]);
      expect(locateOnRoute({ lat: 40.0, lng: -74.0 }, singlePoint)).toBeNull();
    });
  });

  describe('checkpointIndexForFraction', () => {
    it('clamps to a minimum of 1 near the start', () => {
      expect(checkpointIndexForFraction(0)).toBe(1);
      expect(checkpointIndexForFraction(0.05)).toBe(1);
    });

    it('clamps to a maximum of 9 near the end (10 is reserved for arrival)', () => {
      expect(checkpointIndexForFraction(0.99)).toBe(9);
      expect(checkpointIndexForFraction(1)).toBe(9);
    });

    it('buckets the midpoint into segment 5', () => {
      expect(checkpointIndexForFraction(0.5)).toBe(5);
    });
  });

  describe('passedCheckpoints', () => {
    it('places checkpoints 1..n-1 at equal fractions along the planned route', () => {
      const passed = passedCheckpoints(encodedRoute, 6);
      expect(passed.map((p) => p.checkpointIndex)).toEqual([1, 2, 3, 4, 5]);
      expect(passed[4].fractionComplete).toBe(0.5);
      // The route runs due north from 40.0 to 41.0, so 50% sits at ~40.5.
      expect(passed[4].lat).toBeCloseTo(40.5, 2);
      expect(passed[4].lng).toBeCloseTo(-74.0, 5);
    });

    it('returns nothing when no checkpoint precedes the reached one', () => {
      expect(passedCheckpoints(encodedRoute, 1)).toEqual([]);
    });
  });

  describe('excluding the origin and destination geofences (#307)', () => {
    const progress = { distanceAlongRouteMeters: 10_000, totalRouteMeters: 100_000, fraction: 0.1 };

    it('measures progress from the origin geofence edge to the destination geofence edge', () => {
      expect(fractionOfSpan(progress, { startOffsetMeters: 10_000, endOffsetMeters: 10_000 })).toBe(0);
      expect(fractionOfSpan({ ...progress, distanceAlongRouteMeters: 50_000 }, { startOffsetMeters: 10_000, endOffsetMeters: 10_000 })).toBe(0.5);
    });

    it('falls back to the whole route when the geofences would cover it', () => {
      expect(fractionOfSpan(progress, { startOffsetMeters: 60_000, endOffsetMeters: 60_000 })).toBeCloseTo(0.1);
    });

    it('places filled-in checkpoints inside the span, not inside a geofence', () => {
      const full = passedCheckpoints(encodedRoute, 2);
      const trimmed = passedCheckpoints(encodedRoute, 2, { startOffsetMeters: 5_000, endOffsetMeters: 5_000 });
      expect(trimmed[0].distanceAlongRouteMeters).toBeGreaterThan(full[0].distanceAlongRouteMeters);
      expect(trimmed[0].fractionComplete).toBe(0.1);
    });
  });
});

