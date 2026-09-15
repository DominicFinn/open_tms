import { locateOnRoute, checkpointIndexForFraction } from '../../services/routing/RouteProgressService';
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
});
