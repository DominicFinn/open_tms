/**
 * Planned routes for shipments (#328).
 *
 * A shipment's route is its own `ShipmentRoute` when it's on a custom route, otherwise its lane's
 * `LaneRoute`. Everything that measures a shipment against a route (checkpoints, deviation, the map)
 * reads it through `findEffectiveRoute`, so the two cases never need handling separately.
 */

import { PrismaClient } from '@prisma/client';

export interface EffectiveRoute {
  source: 'shipment' | 'lane';
  encodedPolyline: string;
  waypoints: unknown;
  distanceMeters: number;
  durationSeconds: number;
  summary: string | null;
  corridorMeters: number;
}

export interface PlanningStop {
  locationId: string;
  lat: number | null;
  lng: number | null;
}

export interface ShipmentForPlanning {
  status: string;
  laneId: string | null;
  /** In sequence order. */
  stops: PlanningStop[];
  /** stopsKey of the route already stored for the shipment, if any. */
  currentStopsKey: string | null;
}

export interface JourneyRecordStop {
  id: string;
  locationId: string;
  locationName: string;
  sequenceNumber: number;
  stopType: string;
  purpose: string | null;
  label: string | null;
  status: string;
  actualArrival: Date | null;
  actualDeparture: Date | null;
}

export interface JourneyCheckpointRecord {
  checkpointIndex: number;
  lat: number;
  lng: number;
  distanceAlongRouteMeters: number;
  fractionComplete: number;
  eventTime: Date;
}

export interface ShipmentJourneyRecord {
  originId: string | null;
  destinationId: string | null;
  /** In sequence order. */
  stops: JourneyRecordStop[];
  /** In checkpoint order. */
  checkpoints: JourneyCheckpointRecord[];
}

export interface IShipmentRouteRepository {
  /** `undefined` when the shipment isn't in the org; `null` when it has no route. */
  findEffectiveRoute(orgId: string, shipmentId: string): Promise<EffectiveRoute | null | undefined>;
  findForPlanning(orgId: string, shipmentId: string): Promise<ShipmentForPlanning | null>;
  /** What was recorded along a shipment's journey (#283, #348); `null` when it isn't in the org or is deleted. */
  findJourney(orgId: string, shipmentId: string): Promise<ShipmentJourneyRecord | null>;
}

const routeFields = {
  encodedPolyline: true, waypoints: true, distanceMeters: true, durationSeconds: true, summary: true, corridorMeters: true,
} as const;

export class ShipmentRouteRepository implements IShipmentRouteRepository {
  constructor(private prisma: PrismaClient) {}

  async findEffectiveRoute(orgId: string, shipmentId: string) {
    const shipment = await this.prisma.shipment.findFirst({
      where: { id: shipmentId, orgId },
      select: { route: { select: routeFields }, lane: { select: { route: { select: routeFields } } } },
    });
    if (!shipment) return undefined;
    if (shipment.route) return { source: 'shipment' as const, ...shipment.route };
    if (shipment.lane?.route) return { source: 'lane' as const, ...shipment.lane.route };
    return null;
  }

  async findForPlanning(orgId: string, shipmentId: string): Promise<ShipmentForPlanning | null> {
    const shipment = await this.prisma.shipment.findFirst({
      where: { id: shipmentId, orgId },
      select: {
        status: true,
        laneId: true,
        route: { select: { stopsKey: true } },
        stops: {
          orderBy: { sequenceNumber: 'asc' },
          select: { locationId: true, location: { select: { lat: true, lng: true } } },
        },
      },
    });
    if (!shipment) return null;
    return {
      status: shipment.status,
      laneId: shipment.laneId,
      currentStopsKey: shipment.route?.stopsKey ?? null,
      stops: shipment.stops.map((s) => ({ locationId: s.locationId, lat: s.location.lat, lng: s.location.lng })),
    };
  }

  async findJourney(orgId: string, shipmentId: string): Promise<ShipmentJourneyRecord | null> {
    const shipment = await this.prisma.shipment.findFirst({
      where: { id: shipmentId, orgId, deletedAt: null },
      select: {
        originId: true,
        destinationId: true,
        stops: {
          orderBy: { sequenceNumber: 'asc' },
          select: {
            id: true, locationId: true, sequenceNumber: true, stopType: true, purpose: true, label: true,
            status: true, actualArrival: true, actualDeparture: true, location: { select: { name: true } },
          },
        },
      },
    });
    if (!shipment) return null;
    const checkpoints = await this.prisma.shipmentJourneyCheckpoint.findMany({
      where: { shipmentId, orgId },
      orderBy: { checkpointIndex: 'asc' },
      select: { checkpointIndex: true, lat: true, lng: true, distanceAlongRouteMeters: true, fractionComplete: true, eventTime: true },
    });
    return {
      originId: shipment.originId,
      destinationId: shipment.destinationId,
      stops: shipment.stops.map(({ location, ...stop }) => ({ ...stop, locationName: location.name })),
      checkpoints,
    };
  }
}
