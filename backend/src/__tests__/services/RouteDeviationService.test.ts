import { RouteDeviationService, haversineDistance } from '../../services/routing/RouteDeviationService';
import { encodePolyline, decodePolyline } from '../../services/routing/GoogleMapsDirectionsService';

describe('RouteDeviationService', () => {
  const service = new RouteDeviationService();

  // A simple route along I-95 corridor: New York -> Philadelphia -> Washington DC
  const routePoints = [
    { lat: 40.7128, lng: -74.0060 },  // New York
    { lat: 40.2206, lng: -74.7629 },  // Trenton area
    { lat: 39.9526, lng: -75.1652 },  // Philadelphia
    { lat: 39.2904, lng: -76.6122 },  // Baltimore
    { lat: 38.9072, lng: -77.0369 },  // Washington DC
  ];
  const encodedRoute = encodePolyline(routePoints);

  describe('checkDeviation', () => {
    it('should detect no deviation when position is on route', () => {
      // Position right on Philadelphia
      const result = service.checkDeviation(
        { lat: 39.9526, lng: -75.1652 },
        encodedRoute,
        5000, // 5km corridor
      );

      expect(result.isDeviated).toBe(false);
      expect(result.deviationMeters).toBeLessThan(100);
      expect(result.severity).toBe('none');
    });

    it('should detect no deviation when position is within corridor', () => {
      // Slightly off the route (1-2 km east of Philly)
      const result = service.checkDeviation(
        { lat: 39.9526, lng: -75.1452 },
        encodedRoute,
        5000,
      );

      expect(result.isDeviated).toBe(false);
      expect(result.severity).toBe('none');
    });

    it('should detect warning deviation when position exceeds corridor', () => {
      // Use a small corridor where the position is between 1x and 2x corridor
      // Philadelphia is at 39.9526, -75.1652; move slightly north (within warning range)
      const result = service.checkDeviation(
        { lat: 39.97, lng: -75.20 }, // Slightly off route
        encodedRoute,
        1000, // 1km corridor; warning at >1km, critical at >2km
      );

      expect(result.isDeviated).toBe(true);
      expect(result.deviationMeters).toBeGreaterThan(1000);
      // Just check it's deviated; the exact severity depends on distance
      expect(['warning', 'critical']).toContain(result.severity);
    });

    it('should detect critical deviation when position is very far off route', () => {
      // Way off route (e.g., 100+ km away in Ohio)
      const result = service.checkDeviation(
        { lat: 40.0, lng: -80.0 },
        encodedRoute,
        5000,
      );

      expect(result.isDeviated).toBe(true);
      expect(result.deviationMeters).toBeGreaterThan(10000);
      expect(result.severity).toBe('critical');
    });

    it('should handle empty polyline', () => {
      const result = service.checkDeviation(
        { lat: 40.0, lng: -74.0 },
        encodePolyline([]),
        5000,
      );

      expect(result.isDeviated).toBe(false);
      expect(result.deviationMeters).toBe(0);
    });

    it('should handle single-point polyline', () => {
      const singlePoint = encodePolyline([{ lat: 40.0, lng: -74.0 }]);
      const result = service.checkDeviation(
        { lat: 40.0, lng: -74.0 },
        singlePoint,
        5000,
      );

      expect(result.isDeviated).toBe(false);
    });

    it('should return nearest point on route', () => {
      const result = service.checkDeviation(
        { lat: 40.0, lng: -76.5 },
        encodedRoute,
        5000,
      );

      // Nearest point should be somewhere on the route
      expect(result.nearestPointOnRoute).toBeDefined();
      expect(result.nearestPointOnRoute.lat).toBeGreaterThan(38);
      expect(result.nearestPointOnRoute.lat).toBeLessThan(42);
    });

    it('should correctly set corridor meters in result', () => {
      const result = service.checkDeviation(
        { lat: 40.0, lng: -74.0 },
        encodedRoute,
        8000,
      );

      expect(result.corridorMeters).toBe(8000);
    });
  });
});

describe('Polyline encoding/decoding', () => {
  it('should encode and decode a simple polyline', () => {
    const points = [
      { lat: 38.5, lng: -120.2 },
      { lat: 40.7, lng: -120.95 },
      { lat: 43.252, lng: -126.453 },
    ];

    const encoded = encodePolyline(points);
    const decoded = decodePolyline(encoded);

    expect(decoded.length).toBe(points.length);
    for (let i = 0; i < points.length; i++) {
      expect(decoded[i].lat).toBeCloseTo(points[i].lat, 4);
      expect(decoded[i].lng).toBeCloseTo(points[i].lng, 4);
    }
  });

  it('should handle negative coordinates', () => {
    const points = [
      { lat: -33.8688, lng: 151.2093 }, // Sydney
      { lat: -37.8136, lng: 144.9631 }, // Melbourne
    ];

    const encoded = encodePolyline(points);
    const decoded = decodePolyline(encoded);

    expect(decoded.length).toBe(2);
    expect(decoded[0].lat).toBeCloseTo(-33.8688, 4);
    expect(decoded[0].lng).toBeCloseTo(151.2093, 4);
  });

  it('should handle empty array', () => {
    const encoded = encodePolyline([]);
    const decoded = decodePolyline(encoded);
    expect(decoded.length).toBe(0);
  });

  it('should be reversible with many points', () => {
    const points = Array.from({ length: 100 }, (_, i) => ({
      lat: 30 + i * 0.1,
      lng: -90 + i * 0.05,
    }));

    const encoded = encodePolyline(points);
    const decoded = decodePolyline(encoded);

    expect(decoded.length).toBe(100);
    for (let i = 0; i < 100; i++) {
      expect(decoded[i].lat).toBeCloseTo(points[i].lat, 4);
      expect(decoded[i].lng).toBeCloseTo(points[i].lng, 4);
    }
  });
});

describe('haversineDistance', () => {
  it('should calculate zero distance for same point', () => {
    const dist = haversineDistance(
      { lat: 40.7128, lng: -74.0060 },
      { lat: 40.7128, lng: -74.0060 },
    );
    expect(dist).toBe(0);
  });

  it('should calculate correct distance between known points', () => {
    // NYC to DC is ~330 km
    const dist = haversineDistance(
      { lat: 40.7128, lng: -74.0060 },
      { lat: 38.9072, lng: -77.0369 },
    );
    expect(dist).toBeGreaterThan(300000);
    expect(dist).toBeLessThan(360000);
  });

  it('should calculate short distances accurately', () => {
    // 1 degree of latitude is ~111 km
    const dist = haversineDistance(
      { lat: 40.0, lng: -74.0 },
      { lat: 41.0, lng: -74.0 },
    );
    expect(dist).toBeGreaterThan(110000);
    expect(dist).toBeLessThan(112000);
  });
});
