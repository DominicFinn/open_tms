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

/**
 * The part of the route checkpoints are measured over: everything between leaving the origin's
 * geofence and entering the destination's (#307). Without it, a checkpoint can fall inside a
 * geofence, where the vehicle is arriving or departing rather than travelling. If the radii would
 * swallow the whole route, the full route is used.
 */
export interface RouteSpan {
  startOffsetMeters: number;
  endOffsetMeters: number;
}

const FULL_ROUTE: RouteSpan = { startOffsetMeters: 0, endOffsetMeters: 0 };

function usableSpan(totalRouteMeters: number, span: RouteSpan): RouteSpan {
  const usable = totalRouteMeters - span.startOffsetMeters - span.endOffsetMeters;
  return usable > 0 ? span : FULL_ROUTE;
}

/** Fraction of the usable span covered, 0 at the origin geofence edge, 1 at the destination's. */
export function fractionOfSpan(progress: RouteProgress, span: RouteSpan = FULL_ROUTE): number {
  const { startOffsetMeters, endOffsetMeters } = usableSpan(progress.totalRouteMeters, span);
  const usable = progress.totalRouteMeters - startOffsetMeters - endOffsetMeters;
  return Math.min(1, Math.max(0, (progress.distanceAlongRouteMeters - startOffsetMeters) / usable));
}

/** Bucket a route fraction into a checkpoint index 1-9 (10 is reserved for arrival). */
export function checkpointIndexForFraction(fraction: number): number {
  return Math.min(JOURNEY_CHECKPOINT_SEGMENTS - 1, Math.max(1, Math.floor(fraction * JOURNEY_CHECKPOINT_SEGMENTS)));
}

/** A checkpoint the vehicle passed between two pings, placed on the planned route. */
export interface PassedCheckpoint {
  checkpointIndex: number;
  lat: number;
  lng: number;
  distanceAlongRouteMeters: number;
  fractionComplete: number;
}

/**
 * Planned-route positions of checkpoints 1..(upToIndex - 1). Used to fill in the checkpoints a
 * shipment passed between sparse pings: the ping proves it got past them, the route says where.
 */
export function passedCheckpoints(encodedPolyline: string, upToIndex: number, span: RouteSpan = FULL_ROUTE): PassedCheckpoint[] {
  const routePoints = decodePolyline(encodedPolyline);
  if (routePoints.length < 2) return [];

  const segmentLengths = routePoints.slice(1).map((p, i) => haversineDistance(routePoints[i], p));
  const totalRouteMeters = segmentLengths.reduce((sum, len) => sum + len, 0);
  if (totalRouteMeters === 0) return [];

  const { startOffsetMeters, endOffsetMeters } = usableSpan(totalRouteMeters, span);
  const usable = totalRouteMeters - startOffsetMeters - endOffsetMeters;
  const result: PassedCheckpoint[] = [];
  for (let index = 1; index < upToIndex; index++) {
    const fractionComplete = index / JOURNEY_CHECKPOINT_SEGMENTS;
    const target = startOffsetMeters + usable * fractionComplete;
    const point = pointAtDistance(routePoints, segmentLengths, target);
    result.push({
      checkpointIndex: index,
      lat: point.lat,
      lng: point.lng,
      distanceAlongRouteMeters: Math.round(target),
      fractionComplete,
    });
  }
  return result;
}

function pointAtDistance(routePoints: LatLng[], segmentLengths: number[], target: number): LatLng {
  let cumulative = 0;
  for (let i = 0; i < segmentLengths.length; i++) {
    const len = segmentLengths[i];
    if (cumulative + len >= target && len > 0) {
      const t = (target - cumulative) / len;
      const a = routePoints[i];
      const b = routePoints[i + 1];
      return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
    }
    cumulative += len;
  }
  return routePoints[routePoints.length - 1];
}
