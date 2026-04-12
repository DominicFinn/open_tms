/**
 * GoogleMapsDirectionsService - Uses the Google Maps Directions API
 * to compute routes between locations and return encoded polylines.
 *
 * This is used for planned lane routes (draggable directions on the frontend),
 * NOT for real-time ETA monitoring (which uses IRoutingProvider).
 *
 * Requires GOOGLE_MAPS_API_KEY in Organization settings.
 */

import { LatLng } from './IRoutingProvider.js';

export interface DirectionsRequest {
  origin: LatLng;
  destination: LatLng;
  waypoints?: LatLng[];
  avoidTolls?: boolean;
  avoidHighways?: boolean;
}

export interface DirectionsResult {
  encodedPolyline: string;
  distanceMeters: number;
  durationSeconds: number;
  summary: string;
  waypoints: LatLng[];
}

export interface IGoogleMapsDirectionsService {
  /** Compute a route and return the encoded polyline + metadata */
  computeDirections(apiKey: string, request: DirectionsRequest): Promise<DirectionsResult>;
}

export class GoogleMapsDirectionsService implements IGoogleMapsDirectionsService {
  async computeDirections(apiKey: string, request: DirectionsRequest): Promise<DirectionsResult> {
    const { origin, destination, waypoints, avoidTolls, avoidHighways } = request;

    const params = new URLSearchParams({
      origin: `${origin.lat},${origin.lng}`,
      destination: `${destination.lat},${destination.lng}`,
      key: apiKey,
      mode: 'driving',
    });

    if (waypoints?.length) {
      const wpStr = waypoints.map(w => `via:${w.lat},${w.lng}`).join('|');
      params.set('waypoints', wpStr);
    }

    const avoid: string[] = [];
    if (avoidTolls) avoid.push('tolls');
    if (avoidHighways) avoid.push('highways');
    if (avoid.length) params.set('avoid', avoid.join('|'));

    const url = `https://maps.googleapis.com/maps/api/directions/json?${params.toString()}`;
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`Google Directions API returned ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();

    if (data.status !== 'OK') {
      throw new Error(`Google Directions API error: ${data.status} - ${data.error_message || 'Unknown error'}`);
    }

    const route = data.routes[0];
    if (!route) {
      throw new Error('Google Directions API returned no routes');
    }

    // Sum up leg distances and durations
    let totalDistanceMeters = 0;
    let totalDurationSeconds = 0;
    for (const leg of route.legs) {
      totalDistanceMeters += leg.distance.value;
      totalDurationSeconds += leg.duration.value;
    }

    // Extract overview polyline
    const encodedPolyline = route.overview_polyline?.points || '';

    // Decode the polyline to get waypoints for quick reference
    const decodedWaypoints = decodePolyline(encodedPolyline);

    return {
      encodedPolyline,
      distanceMeters: totalDistanceMeters,
      durationSeconds: totalDurationSeconds,
      summary: route.summary || '',
      waypoints: decodedWaypoints,
    };
  }
}

/**
 * Decode a Google-encoded polyline string into an array of LatLng points.
 * Implementation of the Google Polyline Algorithm:
 * https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */
export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;

    // Decode latitude
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += dlat;

    // Decode longitude
    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += dlng;

    points.push({
      lat: lat / 1e5,
      lng: lng / 1e5,
    });
  }

  return points;
}

/**
 * Encode an array of LatLng points into a Google-encoded polyline string.
 */
export function encodePolyline(points: LatLng[]): string {
  let encoded = '';
  let prevLat = 0;
  let prevLng = 0;

  for (const point of points) {
    const lat = Math.round(point.lat * 1e5);
    const lng = Math.round(point.lng * 1e5);

    encoded += encodeValue(lat - prevLat);
    encoded += encodeValue(lng - prevLng);

    prevLat = lat;
    prevLng = lng;
  }

  return encoded;
}

function encodeValue(value: number): string {
  let v = value < 0 ? ~(value << 1) : (value << 1);
  let encoded = '';

  while (v >= 0x20) {
    encoded += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
    v >>= 5;
  }
  encoded += String.fromCharCode(v + 63);

  return encoded;
}
