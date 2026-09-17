/**
 * RouteProgressService — locates a GPS position along a planned route polyline.
 *
 * Used to bucket a shipment's in-transit position into one of 10 equal-length
 * segments of its LaneRoute, for journey-checkpoint reporting. Reuses the
 * nearest-point-on-segment math from RouteDeviationService.
 */

import { LatLng } from './IRoutingProvider.js';
import { decodePolyline } from './GoogleMapsDirectionsService.js';
import { nearestPointOnSegment, haversineDistance } from './RouteDeviationService.js';

export interface RouteProgress {
  distanceAlongRouteMeters: number;
  totalRouteMeters: number;
  /** 0 (at the start of the route) to 1 (at the end) */
  fraction: number;
}

/** Number of equal-length segments a journey is divided into for checkpoint reporting. */
export const JOURNEY_CHECKPOINT_SEGMENTS = 10;

/**
 * Find how far along an encoded route polyline a position is, by locating the
 * nearest point on the polyline and summing the segment lengths up to it.
 */
export function locateOnRoute(position: LatLng, encodedPolyline: string): RouteProgress | null {
  const routePoints = decodePolyline(encodedPolyline);
  if (routePoints.length < 2) return null;

  const segmentLengths: number[] = [];
  let totalRouteMeters = 0;
  for (let i = 0; i < routePoints.length - 1; i++) {
    const len = haversineDistance(routePoints[i], routePoints[i + 1]);
    segmentLengths.push(len);
    totalRouteMeters += len;
  }
  if (totalRouteMeters === 0) return null;

  let minDistance = Infinity;
  let distanceAlongRouteMeters = 0;
  let cumulative = 0;

  for (let i = 0; i < routePoints.length - 1; i++) {
    const segStart = routePoints[i];
    const segEnd = routePoints[i + 1];
    const nearest = nearestPointOnSegment(position, segStart, segEnd);
    const distToSegment = haversineDistance(position, nearest);

    if (distToSegment < minDistance) {
      minDistance = distToSegment;
      distanceAlongRouteMeters = cumulative + haversineDistance(segStart, nearest);
    }
    cumulative += segmentLengths[i];
  }

  return {
    distanceAlongRouteMeters: Math.round(distanceAlongRouteMeters),
    totalRouteMeters: Math.round(totalRouteMeters),
    fraction: Math.min(1, Math.max(0, distanceAlongRouteMeters / totalRouteMeters)),
  };
}

/** Bucket a route fraction into a checkpoint index 1-9 (10 is reserved for arrival). */
export function checkpointIndexForFraction(fraction: number): number {
  return Math.min(JOURNEY_CHECKPOINT_SEGMENTS - 1, Math.max(1, Math.floor(fraction * JOURNEY_CHECKPOINT_SEGMENTS)));
}
