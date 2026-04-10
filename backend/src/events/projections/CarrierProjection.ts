/**
 * CarrierProjection — builds and maintains the CarrierReadModel from domain events.
 */

import { PrismaClient } from '@prisma/client';
import { DomainEvent } from '../DomainEvent.js';
import { IEventHandler } from '../IEventHandler.js';
import { SubscribeOptions } from '../IEventBus.js';
import { EVENT_TYPES } from '../eventTypes.js';

export class CarrierProjection implements IEventHandler {
  readonly name = 'projection.carrier';
  readonly eventPatterns = ['carrier.*'];
  readonly options: SubscribeOptions = {
    concurrency: 3,
    priority: 5,
    retryLimit: 5,
    expireInSeconds: 600,
  };

  constructor(private prisma: PrismaClient) {}

  async handle(event: DomainEvent): Promise<void> {
    switch (event.type) {
      case EVENT_TYPES.CARRIER_CREATED:
        return this.onCarrierCreated(event);
      case EVENT_TYPES.CARRIER_UPDATED:
        return this.onCarrierUpdated(event);
      case EVENT_TYPES.CARRIER_ARCHIVED:
        return this.onCarrierArchived(event);
      default:
        break;
    }
  }

  private async onCarrierCreated(event: DomainEvent): Promise<void> {
    const carrier = await this.prisma.carrier.findUnique({
      where: { id: event.entityId },
      include: {
        vehicles: { select: { id: true } },
        drivers: { select: { id: true } },
        laneCarriers: { where: { assigned: true }, select: { id: true } },
      },
    });

    if (!carrier) {
      console.error(`[CarrierProjection] Carrier ${event.entityId} not found for created event`);
      return;
    }

    await this.prisma.carrierReadModel.upsert({
      where: { id: carrier.id },
      create: {
        id: carrier.id,
        orgId: event.orgId,
        name: carrier.name,
        mcNumber: carrier.mcNumber,
        dotNumber: carrier.dotNumber,
        contactEmail: carrier.contactEmail,
        status: carrier.archived ? 'archived' : 'active',
        validationTier: carrier.validationTier,
        vehicleCount: carrier.vehicles.length,
        driverCount: carrier.drivers.length,
        activeLaneCount: carrier.laneCarriers.length,
        createdAt: carrier.createdAt,
        updatedAt: carrier.updatedAt,
      },
      update: {
        name: carrier.name,
        status: carrier.archived ? 'archived' : 'active',
        updatedAt: carrier.updatedAt,
      },
    });
  }

  private async onCarrierUpdated(event: DomainEvent): Promise<void> {
    const carrier = await this.prisma.carrier.findUnique({
      where: { id: event.entityId },
      include: {
        vehicles: { select: { id: true } },
        drivers: { select: { id: true } },
        laneCarriers: { where: { assigned: true }, select: { id: true } },
      },
    });

    if (!carrier) return;

    await this.prisma.carrierReadModel.update({
      where: { id: carrier.id },
      data: {
        name: carrier.name,
        mcNumber: carrier.mcNumber,
        dotNumber: carrier.dotNumber,
        contactEmail: carrier.contactEmail,
        validationTier: carrier.validationTier,
        vehicleCount: carrier.vehicles.length,
        driverCount: carrier.drivers.length,
        activeLaneCount: carrier.laneCarriers.length,
        updatedAt: new Date(),
      },
    }).catch((err: Error) => {
      console.error(`[CarrierProjection] Failed to update read model for ${event.entityId}: ${err.message}`);
    });
  }

  private async onCarrierArchived(event: DomainEvent): Promise<void> {
    await this.prisma.carrierReadModel.update({
      where: { id: event.entityId },
      data: { status: 'archived', updatedAt: new Date() },
    }).catch((err: Error) => {
      console.error(`[CarrierProjection] Failed to archive read model for ${event.entityId}: ${err.message}`);
    });
  }
}
