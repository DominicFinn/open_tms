/**
 * RouteDeviationService - Detects when a shipment's current GPS position
 * deviates from the planned lane route beyond a configured corridor.
 *
 * Uses the point-to-polyline distance algorithm: for each GPS position,
 * find the nearest point on the planned route polyline and check if the
 * distance exceeds the lane's corridor threshold.
 */

import { LatLng } from './IRoutingProvider.js';
import { decodePolyline } from './GoogleMapsDirectionsService.js';

export interface DeviationCheckResult {
  isDeviated: boolean;
  deviationMeters: number;
  nearestPointOnRoute: LatLng;
  currentPosition: LatLng;
  corridorMeters: number;
  severity: 'none' | 'warning' | 'critical';
}

export interface DeviationConfig {
  /** Distance in meters for a warning-level deviation. Default: corridor / 1 (at corridor boundary) */
  warningMultiplier: number;
  /** Distance in meters for a critical deviation. Default: corridor * 2 */
  criticalMultiplier: number;
}

const DEFAULT_DEVIATION_CONFIG: DeviationConfig = {
  warningMultiplier: 1.0,
  criticalMultiplier: 2.0,
};

export interface IRouteDeviationService {
  /**
   * Check if a position deviates from a planned route.
   * @param currentPosition - The shipment's current GPS coordinates
   * @param encodedPolyline - Google-encoded polyline of the planned route
   * @param corridorMeters - Maximum allowed distance from route before alerting
   * @returns DeviationCheckResult with distance and severity
   */
  checkDeviation(
    currentPosition: LatLng,
    encodedPolyline: string,
    corridorMeters: number,
  ): DeviationCheckResult;
}

export class RouteDeviationService implements IRouteDeviationService {
  private config: DeviationConfig;

  constructor(config?: Partial<DeviationConfig>) {
    this.config = { ...DEFAULT_DEVIATION_CONFIG, ...config };
  }

  checkDeviation(
    currentPosition: LatLng,
    encodedPolyline: string,
    corridorMeters: number,
  ): DeviationCheckResult {
    const routePoints = decodePolyline(encodedPolyline);

    if (routePoints.length === 0) {
      return {
        isDeviated: false,
        deviationMeters: 0,
        nearestPointOnRoute: currentPosition,
        currentPosition,
        corridorMeters,
        severity: 'none',
      };
    }

    // Find the nearest point on the polyline to the current position
    let minDistance = Infinity;
    let nearestPoint: LatLng = routePoints[0];

    for (let i = 0; i < routePoints.length - 1; i++) {
      const segmentNearest = nearestPointOnSegment(
        currentPosition,
        routePoints[i],
        routePoints[i + 1],
      );
      const dist = haversineDistance(currentPosition, segmentNearest);

      if (dist < minDistance) {
        minDistance = dist;
        nearestPoint = segmentNearest;
      }
    }

    // Also check distance to last point (for end-of-route)
    if (routePoints.length === 1) {
      minDistance = haversineDistance(currentPosition, routePoints[0]);
      nearestPoint = routePoints[0];
    }

    const isDeviated = minDistance > corridorMeters;

    let severity: DeviationCheckResult['severity'] = 'none';
    if (minDistance > corridorMeters * this.config.criticalMultiplier) {
      severity = 'critical';
    } else if (minDistance > corridorMeters * this.config.warningMultiplier) {
      severity = 'warning';
    }

    return {
      isDeviated,
      deviationMeters: Math.round(minDistance),
      nearestPointOnRoute: nearestPoint,
      currentPosition,
      corridorMeters,
      severity,
    };
  }
}

/**
 * Find the nearest point on a line segment to a given point.
 * Projects the point onto the segment and clamps to segment endpoints.
 */
function nearestPointOnSegment(point: LatLng, segStart: LatLng, segEnd: LatLng): LatLng {
  const dx = segEnd.lng - segStart.lng;
  const dy = segEnd.lat - segStart.lat;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    return segStart; // Segment is a point
  }

  // Parameter t of the projection onto the line
  let t = ((point.lng - segStart.lng) * dx + (point.lat - segStart.lat) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t)); // Clamp to segment

  return {
    lat: segStart.lat + t * dy,
    lng: segStart.lng + t * dx,
  };
}

/**
 * Haversine distance in meters between two LatLng points.
 */
export function haversineDistance(a: LatLng, b: LatLng): number {
  const R = 6371000; // Earth radius in meters
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);

  const sinHalfDLat = Math.sin(dLat / 2);
  const sinHalfDLng = Math.sin(dLng / 2);

  const h =
    sinHalfDLat * sinHalfDLat +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * sinHalfDLng * sinHalfDLng;

  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}
