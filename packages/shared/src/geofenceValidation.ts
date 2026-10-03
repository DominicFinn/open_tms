/**
 * Realistic size bounds for a location geofence, plus the geometry checks that enforce them.
 * Shared between the backend route schema and the frontend editor so both apply the same numbers.
 *
 * BUSINESS RULE: below GEOFENCE_MIN_RADIUS_METERS a geofence is smaller than typical GPS accuracy
 * (5-10m, worse near buildings/yards), so arrival detection would be unreliable. Above
 * GEOFENCE_MAX_RADIUS_METERS a geofence stops representing "at this facility" and starts matching
 * trucks that are simply in the area. Polygon bounds mirror the same reasoning via the area of a
 * circle at the min/max radius, so both shape types enforce a consistent size range.
 */

export const GEOFENCE_MIN_RADIUS_METERS = 25;
export const GEOFENCE_MAX_RADIUS_METERS = 5000;

export const GEOFENCE_MIN_AREA_SQUARE_METERS = Math.PI * GEOFENCE_MIN_RADIUS_METERS ** 2;
export const GEOFENCE_MAX_AREA_SQUARE_METERS = Math.PI * GEOFENCE_MAX_RADIUS_METERS ** 2;

const EARTH_RADIUS_METERS = 6371000;

export interface GeofencePoint {
  lat: number;
  lng: number;
}

/**
 * Approximate polygon area in square meters via an equirectangular projection (centered on the
 * polygon's own latitude) followed by the shoelace formula. Accurate enough at the sub-5000m scale
 * these geofences are bounded to; not suitable for continental-scale polygons.
 */
export function polygonAreaSquareMeters(points: GeofencePoint[]): number {
  if (points.length < 3) return 0;

  const latOrigin = (points.reduce((sum, p) => sum + p.lat, 0) / points.length) * (Math.PI / 180);
  const toXY = (p: GeofencePoint) => ({
    x: EARTH_RADIUS_METERS * (p.lng * (Math.PI / 180)) * Math.cos(latOrigin),
    y: EARTH_RADIUS_METERS * (p.lat * (Math.PI / 180)),
  });

  const xy = points.map(toXY);
  let sum = 0;
  for (let i = 0; i < xy.length; i++) {
    const a = xy[i];
    const b = xy[(i + 1) % xy.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

export function radiusOutOfBoundsMessage(radiusMeters: number): string | null {
  if (radiusMeters < GEOFENCE_MIN_RADIUS_METERS) {
    return `Radius must be at least ${GEOFENCE_MIN_RADIUS_METERS}m`;
  }
  if (radiusMeters > GEOFENCE_MAX_RADIUS_METERS) {
    return `Radius must be at most ${GEOFENCE_MAX_RADIUS_METERS}m`;
  }
  return null;
}

export function polygonAreaOutOfBoundsMessage(points: GeofencePoint[]): string | null {
  if (points.length < 3) return null;
  const area = polygonAreaSquareMeters(points);
  if (area < GEOFENCE_MIN_AREA_SQUARE_METERS) {
    return `Shape is too small — draw a larger area (min ~${Math.round(GEOFENCE_MIN_AREA_SQUARE_METERS)}m²)`;
  }
  if (area > GEOFENCE_MAX_AREA_SQUARE_METERS) {
    return `Shape is too large — draw a smaller area (max ~${Math.round(GEOFENCE_MAX_AREA_SQUARE_METERS / 1_000_000)}km²)`;
  }
  return null;
}
