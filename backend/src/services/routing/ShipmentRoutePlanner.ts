/**
 * Plans the road route for a shipment on a custom route (#328).
 *
 * BUSINESS RULES:
 * - A shipment on a lane uses the lane's route; any route of its own is removed.
 * - A custom-route shipment's route runs through its stops in sequence, and is only planned while
 *   the shipment is draft or ready: once it's moving, the plan it left with is what it's measured
 *   against.
 * - The routing provider is only called when the stops have changed since the last plan.
 *
 * The provider call happens here, outside any transaction; the result is stored by
 * SetShipmentRouteCommand.
 */

import { randomUUID } from 'crypto';
import { ICommandBus } from '../../commands/CommandBus.js';
import { SET_SHIPMENT_ROUTE, SetShipmentRoutePayload } from '../../commands/shipments/SetShipmentRouteCommand.js';
import { IShipmentRouteRepository, PlanningStop } from '../../repositories/ShipmentRouteRepository.js';
import { IOrganizationRepository } from '../../repositories/OrganizationRepository.js';
import { IGoogleMapsDirectionsService } from './GoogleMapsDirectionsService.js';

export type PlanOutcome =
  | 'planned' | 'unchanged' | 'cleared' | 'uses_lane' | 'not_plannable_status'
  | 'not_enough_stops' | 'no_server_key' | 'not_found';

const PLANNABLE_STATUSES = new Set(['draft', 'ready']);

export interface IShipmentRoutePlanner {
  plan(orgId: string, shipmentId: string): Promise<PlanOutcome>;
}

export class ShipmentRoutePlanner implements IShipmentRoutePlanner {
  constructor(
    private routes: IShipmentRouteRepository,
    private organizations: IOrganizationRepository,
    private directions: IGoogleMapsDirectionsService,
    private commandBus: ICommandBus,
  ) {}

  async plan(orgId: string, shipmentId: string): Promise<PlanOutcome> {
    const shipment = await this.routes.findForPlanning(orgId, shipmentId);
    if (!shipment) return 'not_found';

    if (shipment.laneId) {
      if (shipment.currentStopsKey === null) return 'uses_lane';
      await this.store(orgId, { shipmentId, route: null });
      return 'cleared';
    }
    if (!PLANNABLE_STATUSES.has(shipment.status)) return 'not_plannable_status';

    const located = shipment.stops.filter((s): s is PlanningStop & { lat: number; lng: number } => s.lat != null && s.lng != null);
    if (located.length < 2) return 'not_enough_stops';
    const stopsKey = located.map((s) => s.locationId).join(',');
    if (stopsKey === shipment.currentStopsKey) return 'unchanged';

    const apiKey = (await this.organizations.getSettings(orgId))?.googleMapsServerKey;
    if (!apiKey) return 'no_server_key';

    const points = located.map((s) => ({ lat: s.lat, lng: s.lng }));
    const result = await this.directions.computeDirections(apiKey, {
      origin: points[0],
      destination: points[points.length - 1],
      waypoints: points.length > 2 ? points.slice(1, -1) : undefined,
    });

    await this.store(orgId, {
      shipmentId,
      route: {
        encodedPolyline: result.encodedPolyline,
        waypoints: result.waypoints,
        distanceMeters: result.distanceMeters,
        durationSeconds: result.durationSeconds,
        summary: result.summary,
        provider: 'google',
        stopsKey,
      },
    });
    return 'planned';
  }

  private async store(orgId: string, payload: SetShipmentRoutePayload): Promise<void> {
    const result = await this.commandBus.dispatch({
      type: SET_SHIPMENT_ROUTE,
      orgId,
      actorId: null,
      payload,
      metadata: { correlationId: randomUUID(), source: 'route_planner' },
    });
    if (!result.success) throw new Error(result.error || 'Failed to store the shipment route');
  }
}
