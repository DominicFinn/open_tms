/**
 * Encoded polyline codec.
 *
 * `LaneRoute.encodedPolyline` holds a route in the encoded polyline format, and the backend's
 * `RouteDeviationService` decodes it to test whether a shipment has strayed off its lane. In
 * Google mode the encoding is done for us by `google.maps.geometry.encoding`; OSM mode has no
 * such helper, so it needs its own.
 *
 * The format is an open, published algorithm, not a Google-proprietary one, so a route drawn in
 * OSM mode stores identically to one drawn in Google mode and every existing consumer keeps
 * working. Precision is 5 decimal places, which is the format's standard and roughly a metre.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

const PRECISION = 1e5;

function encodeSignedValue(value: number): string {
  // Left-shift, then invert the whole thing for negatives, which is what makes the format's
  // variable-length chunks work for both signs.
  let v = value < 0 ? ~(value << 1) : value << 1;
  let out = '';
  while (v >= 0x20) {
    out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
    v >>= 5;
  }
  out += String.fromCharCode(v + 63);
  return out;
}

export function encodePolyline(points: readonly LatLng[]): string {
  let previousLat = 0;
  let previousLng = 0;
  let encoded = '';

  for (const point of points) {
    const lat = Math.round(point.lat * PRECISION);
    const lng = Math.round(point.lng * PRECISION);
    // Each point is stored as a delta from the last, which is what keeps the string short.
    encoded += encodeSignedValue(lat - previousLat);
    encoded += encodeSignedValue(lng - previousLng);
    previousLat = lat;
    previousLng = lng;
  }

  return encoded;
}

export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    for (const axis of ['lat', 'lng'] as const) {
      let result = 0;
      let shift = 0;
      let byte: number;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);

      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (axis === 'lat') lat += delta;
      else lng += delta;
    }
    points.push({ lat: lat / PRECISION, lng: lng / PRECISION });
  }

  return points;
}

const EARTH_RADIUS_METRES = 6_371_000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Great-circle distance along a path.
 *
 * This is the honest answer for a manually drawn route: it measures the line the user actually
 * drew, not the roads underneath it. A route planned in Google mode reports Google's road
 * distance instead, so the two are not directly comparable, which is why a manual route is
 * stored with `provider: 'manual'`.
 */
export function pathLengthMetres(points: readonly LatLng[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const dLat = toRadians(b.lat - a.lat);
    const dLng = toRadians(b.lng - a.lng);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2;
    total += 2 * EARTH_RADIUS_METRES * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  return Math.round(total);
}
