/**
 * LaneProjection — builds and maintains the LaneReadModel from domain events.
 */

import { PrismaClient } from '@prisma/client';
import { DomainEvent } from '../DomainEvent.js';
import { IEventHandler } from '../IEventHandler.js';
import { SubscribeOptions } from '../IEventBus.js';
import { EVENT_TYPES } from '../eventTypes.js';

export class LaneProjection implements IEventHandler {
  readonly name = 'projection.lane';
  readonly eventPatterns = ['lane.*'];
  readonly options: SubscribeOptions = {
    concurrency: 3,
    priority: 5,
    retryLimit: 5,
    expireInSeconds: 600,
    pollingIntervalSeconds: 0.5,
  };

  constructor(private prisma: PrismaClient) {}

  async handle(event: DomainEvent): Promise<void> {
    switch (event.type) {
      case EVENT_TYPES.LANE_CREATED:
        return this.onLaneCreated(event);
      case EVENT_TYPES.LANE_UPDATED:
        return this.onLaneUpdated(event);
      case EVENT_TYPES.LANE_ARCHIVED:
        return this.onLaneArchived(event);
      default:
        break;
    }
  }

  private async onLaneCreated(event: DomainEvent): Promise<void> {
    const lane = await this.prisma.lane.findUnique({
      where: { id: event.entityId },
      include: {
        origin: { select: { name: true, city: true } },
        destination: { select: { name: true, city: true } },
        laneCarriers: { select: { id: true } },
        shipments: { where: { archived: false }, select: { id: true } },
      },
    });

    if (!lane) {
      console.error(`[LaneProjection] Lane ${event.entityId} not found for created event`);
      return;
    }

    await this.prisma.laneReadModel.upsert({
      where: { id: lane.id },
      create: {
        id: lane.id,
        orgId: event.orgId,
        name: lane.name,
        originName: lane.origin.name,
        originCity: lane.origin.city,
        destinationName: lane.destination.name,
        destinationCity: lane.destination.city,
        serviceLevel: lane.serviceLevel,
        distance: lane.distance,
        carrierCount: lane.laneCarriers.length,
        activeShipmentCount: lane.shipments.length,
        status: lane.status,
        createdAt: lane.createdAt,
        updatedAt: lane.updatedAt,
      },
      update: {
        name: lane.name,
        status: lane.status,
        updatedAt: lane.updatedAt,
      },
    });
  }

  private async onLaneUpdated(event: DomainEvent): Promise<void> {
    const lane = await this.prisma.lane.findUnique({
      where: { id: event.entityId },
      include: {
        origin: { select: { name: true, city: true } },
        destination: { select: { name: true, city: true } },
        laneCarriers: { select: { id: true } },
        shipments: { where: { archived: false }, select: { id: true } },
      },
    });

    if (!lane) return;

    await this.prisma.laneReadModel.update({
      where: { id: lane.id },
      data: {
        name: lane.name,
        originName: lane.origin.name,
        originCity: lane.origin.city,
        destinationName: lane.destination.name,
        destinationCity: lane.destination.city,
        serviceLevel: lane.serviceLevel,
        distance: lane.distance,
        carrierCount: lane.laneCarriers.length,
        activeShipmentCount: lane.shipments.length,
        status: lane.status,
        updatedAt: new Date(),
      },
    }).catch((err: Error) => {
      console.error(`[LaneProjection] Failed to update read model for ${event.entityId}: ${err.message}`);
    });
  }

  private async onLaneArchived(event: DomainEvent): Promise<void> {
    await this.prisma.laneReadModel.update({
      where: { id: event.entityId },
      data: { status: 'archived', updatedAt: new Date() },
    }).catch((err: Error) => {
      console.error(`[LaneProjection] Failed to archive read model for ${event.entityId}: ${err.message}`);
    });
  }
}
