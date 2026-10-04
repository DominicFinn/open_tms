import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface PlannedRoute {
  encodedPolyline: string;
  waypoints: Array<{ lat: number; lng: number }>;
  distanceMeters: number;
  durationSeconds: number;
  summary?: string | null;
  provider: string;
  stopsKey: string;
}

export interface SetShipmentRoutePayload {
  shipmentId: string;
  /** The calculated route, or null to remove the shipment's own route (it now rides a lane). */
  route: PlannedRoute | null;
}

export const SET_SHIPMENT_ROUTE = 'shipment.set_route';

export class ShipmentNotFoundError extends Error {
  constructor() {
    super('Shipment not found');
    this.name = 'ShipmentNotFoundError';
  }
}

/**
 * Stores or clears a shipment's own planned route (#328). The route is calculated by
 * ShipmentRoutePlanner before dispatch: the call to the routing provider never happens inside this
 * transaction.
 */
export class SetShipmentRouteCommandHandler extends BaseCommandHandler<SetShipmentRoutePayload, { changed: boolean }> {
  readonly commandType = SET_SHIPMENT_ROUTE;
  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) { super(prisma, eventBus); }

  protected async handle(command: Command<SetShipmentRoutePayload>, tx: TransactionClient, emit: EmitFn) {
    const { shipmentId, route } = command.payload;
    const shipment = await tx.shipment.findFirst({ where: { id: shipmentId, orgId: command.orgId }, select: { id: true } });
    if (!shipment) throw new ShipmentNotFoundError();

    if (!route) {
      const { count } = await tx.shipmentRoute.deleteMany({ where: { shipmentId, orgId: command.orgId } });
      return { changed: count > 0 };
    }

    const data = {
      encodedPolyline: route.encodedPolyline,
      waypoints: route.waypoints,
      distanceMeters: route.distanceMeters,
      durationSeconds: route.durationSeconds,
      summary: route.summary ?? null,
      provider: route.provider,
      stopsKey: route.stopsKey,
    };
    await tx.shipmentRoute.upsert({
      where: { shipmentId, orgId: command.orgId },
      create: { shipmentId, orgId: command.orgId, ...data },
      update: data,
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.SHIPMENT_ROUTE_PLANNED,
      entityType: 'shipment',
      entityId: shipmentId,
      payload: {
        shipmentId,
        distanceMeters: route.distanceMeters,
        durationSeconds: route.durationSeconds,
        provider: route.provider,
        stopCount: route.stopsKey.split(',').length,
      },
    }));
    return { changed: true };
  }
}
