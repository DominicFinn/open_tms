import {
  GEOFENCE_MIN_RADIUS_METERS,
  GEOFENCE_MAX_RADIUS_METERS,
  polygonAreaSquareMeters,
  radiusOutOfBoundsMessage,
  polygonAreaOutOfBoundsMessage,
} from '@open-tms/shared';

describe('radiusOutOfBoundsMessage', () => {
  it('accepts a radius within bounds', () => {
    expect(radiusOutOfBoundsMessage(250)).toBeNull();
    expect(radiusOutOfBoundsMessage(GEOFENCE_MIN_RADIUS_METERS)).toBeNull();
    expect(radiusOutOfBoundsMessage(GEOFENCE_MAX_RADIUS_METERS)).toBeNull();
  });

  it('rejects a radius below the minimum', () => {
    expect(radiusOutOfBoundsMessage(GEOFENCE_MIN_RADIUS_METERS - 1)).toMatch(/at least/);
  });

  it('rejects a radius above the maximum', () => {
    expect(radiusOutOfBoundsMessage(GEOFENCE_MAX_RADIUS_METERS + 1)).toMatch(/at most/);
  });
});

describe('polygonAreaSquareMeters', () => {
  it('computes the area of a roughly 100m x 100m square', () => {
    // ~100m in latitude degrees, ~100m in longitude degrees at the equator
    const points = [
      { lat: 0, lng: 0 },
      { lat: 0.0009, lng: 0 },
      { lat: 0.0009, lng: 0.0009 },
      { lat: 0, lng: 0.0009 },
    ];
    const area = polygonAreaSquareMeters(points);
    expect(area).toBeGreaterThan(9000);
    expect(area).toBeLessThan(11000);
  });

  it('returns 0 for fewer than 3 points', () => {
    expect(polygonAreaSquareMeters([{ lat: 0, lng: 0 }, { lat: 1, lng: 1 }])).toBe(0);
  });
});

describe('polygonAreaOutOfBoundsMessage', () => {
  it('accepts a polygon within bounds', () => {
    const points = [
      { lat: 41.88, lng: -87.63 },
      { lat: 41.881, lng: -87.63 },
      { lat: 41.881, lng: -87.628 },
    ];
    expect(polygonAreaOutOfBoundsMessage(points)).toBeNull();
  });

  it('rejects a polygon smaller than the minimum area', () => {
    const points = [
      { lat: 41.88, lng: -87.63 },
      { lat: 41.880001, lng: -87.63 },
      { lat: 41.880001, lng: -87.629999 },
    ];
    expect(polygonAreaOutOfBoundsMessage(points)).toMatch(/too small/);
  });

  it('rejects a polygon larger than the maximum area', () => {
    const points = [
      { lat: 41.0, lng: -88.0 },
      { lat: 42.0, lng: -88.0 },
      { lat: 42.0, lng: -87.0 },
      { lat: 41.0, lng: -87.0 },
    ];
    expect(polygonAreaOutOfBoundsMessage(points)).toMatch(/too large/);
  });
});
