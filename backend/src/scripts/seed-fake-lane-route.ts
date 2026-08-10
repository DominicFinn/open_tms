/**
 * Additive script: fabricates a plausible "planned route" (LaneRoute) for a
 * lane, so the route overlay on the shipments map / lane detail page can be
 * visually verified without a Google Maps API key configured.
 *
 * Usage:
 *   npx tsx backend/src/scripts/seed-fake-lane-route.ts [laneId]
 *
 * With no laneId, picks the lane with the most shipments currently assigned
 * to it (so the route shows up immediately without changing map filters).
 */

import { PrismaClient } from '@prisma/client';
import { encodePolyline } from '../services/routing/GoogleMapsDirectionsService.js';

const prisma = new PrismaClient();

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Interpolates origin -> destination with a lateral sine bulge so the fake
// route visibly diverges from the straight lane line instead of overlapping it.
function fabricateWaypoints(origin: { lat: number; lng: number }, destination: { lat: number; lng: number }): { lat: number; lng: number }[] {
  const points: { lat: number; lng: number }[] = [];
  const steps = 12;
  const dLat = destination.lat - origin.lat;
  const dLng = destination.lng - origin.lng;
  // Perpendicular unit vector to the origin->destination line, scaled to ~8% of the leg length.
  const perpLat = -dLng;
  const perpLng = dLat;
  const perpLen = Math.hypot(perpLat, perpLng) || 1;
  const bulge = 0.08 * Math.hypot(dLat, dLng);

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const bulgeFactor = Math.sin(t * Math.PI); // 0 at both ends, peaks mid-route
    points.push({
      lat: origin.lat + dLat * t + (perpLat / perpLen) * bulge * bulgeFactor,
      lng: origin.lng + dLng * t + (perpLng / perpLen) * bulge * bulgeFactor,
    });
  }
  return points;
}

async function main() {
  const requestedLaneId = process.argv[2];

  const lane = requestedLaneId
    ? await prisma.lane.findUnique({ where: { id: requestedLaneId }, include: { origin: true, destination: true } })
    : await (async () => {
        const top = await prisma.shipment.groupBy({
          by: ['laneId'],
          where: { laneId: { not: null } },
          _count: { laneId: true },
          orderBy: { _count: { laneId: 'desc' } },
          take: 1,
        });
        const laneId = top[0]?.laneId;
        if (!laneId) return null;
        return prisma.lane.findUnique({ where: { id: laneId }, include: { origin: true, destination: true } });
      })();

  if (!lane) {
    console.log('No lane found (with shipments assigned) to attach a fake route to.');
    return;
  }
  if (lane.origin.lat == null || lane.origin.lng == null || lane.destination.lat == null || lane.destination.lng == null) {
    console.log(`Lane "${lane.name}" is missing origin/destination coordinates.`);
    return;
  }

  const origin = { lat: lane.origin.lat, lng: lane.origin.lng };
  const destination = { lat: lane.destination.lat, lng: lane.destination.lng };
  const waypoints = fabricateWaypoints(origin, destination);

  let distanceMeters = 0;
  for (let i = 1; i < waypoints.length; i++) {
    distanceMeters += haversineMeters(waypoints[i - 1], waypoints[i]);
  }
  const AVG_TRUCK_SPEED_MPS = 88_000 / 3600; // ~55 mph
  const durationSeconds = Math.round(distanceMeters / AVG_TRUCK_SPEED_MPS);

  const route = await prisma.laneRoute.upsert({
    where: { laneId: lane.id },
    update: {
      encodedPolyline: encodePolyline(waypoints),
      waypoints,
      distanceMeters: Math.round(distanceMeters),
      durationSeconds,
      summary: 'Fabricated demo route (not a real Google Directions result)',
      provider: 'manual',
    },
    create: {
      laneId: lane.id,
      orgId: lane.orgId,
      encodedPolyline: encodePolyline(waypoints),
      waypoints,
      distanceMeters: Math.round(distanceMeters),
      durationSeconds,
      summary: 'Fabricated demo route (not a real Google Directions result)',
      provider: 'manual',
    },
  });

  console.log(`Fake planned route attached to lane "${lane.name}" (${lane.id}): ${waypoints.length} waypoints, ~${(distanceMeters / 1000).toFixed(0)}km, route id ${route.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
