/**
 * Plans a custom-route shipment's road route when it's created or changed (#328). Runs off the
 * request path because it calls the routing provider; a provider failure is rethrown so pg-boss
 * retries it.
 */

import { DomainEvent } from '../DomainEvent.js';
import { IEventHandler } from '../IEventHandler.js';
import { EVENT_TYPES } from '../eventTypes.js';
import { IShipmentRoutePlanner } from '../../services/routing/ShipmentRoutePlanner.js';

export class ShipmentRoutePlanningHandler implements IEventHandler {
  readonly name = 'shipment.route_planning';
  readonly eventPatterns = [EVENT_TYPES.SHIPMENT_CREATED, EVENT_TYPES.SHIPMENT_UPDATED];
  readonly options = { concurrency: 2, retryLimit: 3, expireInSeconds: 60 };

  constructor(private planner: IShipmentRoutePlanner) {}

  async handle(event: DomainEvent): Promise<void> {
    try {
      const outcome = await this.planner.plan(event.orgId, event.entityId);
      if (outcome === 'planned' || outcome === 'cleared' || outcome === 'no_server_key') {
        console.log('[ShipmentRoutePlanning] Route', { outcome, shipmentId: event.entityId, orgId: event.orgId });
      }
    } catch (err) {
      console.error('[ShipmentRoutePlanning] Planning failed', { shipmentId: event.entityId, orgId: event.orgId, err: (err as Error).message });
      throw err;
    }
  }
}
