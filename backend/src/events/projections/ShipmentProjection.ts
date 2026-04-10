/**
 * ShipmentProjection — builds and maintains the ShipmentReadModel from domain events.
 *
 * Subscribes to shipment.* and tracking.* events, denormalizing shipment data
 * into a flat read model table optimized for list queries.
 */

import { PrismaClient } from '@prisma/client';
import { DomainEvent } from '../DomainEvent.js';
import { IEventHandler } from '../IEventHandler.js';
import { SubscribeOptions } from '../IEventBus.js';
import { EVENT_TYPES } from '../eventTypes.js';

export class ShipmentProjection implements IEventHandler {
  readonly name = 'projection.shipment';
  readonly eventPatterns = ['shipment.*', 'tracking.*'];
  readonly options: SubscribeOptions = {
    concurrency: 3,
    priority: 5,
    retryLimit: 5,
    expireInSeconds: 600,
  };

  constructor(private prisma: PrismaClient) {}

  async handle(event: DomainEvent): Promise<void> {
    switch (event.type) {
      case EVENT_TYPES.SHIPMENT_CREATED:
        return this.onShipmentCreated(event);
      case EVENT_TYPES.SHIPMENT_UPDATED:
        return this.onShipmentUpdated(event);
      case EVENT_TYPES.SHIPMENT_STATUS_CHANGED:
        return this.onStatusChanged(event);
      case EVENT_TYPES.SHIPMENT_CARRIER_ASSIGNED:
        return this.onCarrierAssigned(event);
      case EVENT_TYPES.SHIPMENT_DELIVERED:
        return this.onShipmentDelivered(event);
      case EVENT_TYPES.SHIPMENT_STOP_ARRIVED:
      case EVENT_TYPES.SHIPMENT_STOP_COMPLETED:
        return this.onStopUpdate(event);
      case EVENT_TYPES.TRACKING_LOCATION_RECEIVED:
        return this.onLocationReceived(event);
      default:
        break;
    }
  }

  private async onShipmentCreated(event: DomainEvent): Promise<void> {
    // Fetch full shipment with relations to denormalize
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: event.entityId },
      include: {
        customer: { select: { id: true, name: true } },
        origin: { select: { name: true, city: true, state: true } },
        destination: { select: { name: true, city: true, state: true } },
        carrier: { select: { id: true, name: true } },
        lane: { select: { id: true, name: true } },
        stops: { select: { id: true } },
        orderShipments: { select: { id: true } },
      },
    });

    if (!shipment) {
      console.warn(`[ShipmentProjection] Shipment ${event.entityId} not found for created event`);
      return;
    }

    await this.prisma.shipmentReadModel.upsert({
      where: { id: shipment.id },
      create: {
        id: shipment.id,
        orgId: event.orgId,
        reference: shipment.reference,
        status: shipment.status,
        customerName: shipment.customer.name,
        customerId: shipment.customerId,
        originName: shipment.origin?.name ?? null,
        originCity: shipment.origin?.city ?? null,
        originState: shipment.origin?.state ?? null,
        destinationName: shipment.destination?.name ?? null,
        destinationCity: shipment.destination?.city ?? null,
        destinationState: shipment.destination?.state ?? null,
        carrierName: shipment.carrier?.name ?? null,
        carrierId: shipment.carrierId,
        laneName: shipment.lane?.name ?? null,
        laneId: shipment.laneId,
        proNumber: shipment.proNumber,
        pickupDate: shipment.pickupDate,
        deliveryDate: shipment.deliveryDate,
        orderCount: shipment.orderShipments?.length ?? 0,
        stopCount: shipment.stops?.length ?? 0,
        createdAt: shipment.createdAt,
        updatedAt: shipment.updatedAt,
      },
      update: {
        status: shipment.status,
        customerName: shipment.customer.name,
        updatedAt: shipment.updatedAt,
      },
    });
  }

  private async onShipmentUpdated(event: DomainEvent): Promise<void> {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: event.entityId },
      include: {
        customer: { select: { name: true } },
        origin: { select: { name: true, city: true, state: true } },
        destination: { select: { name: true, city: true, state: true } },
        carrier: { select: { id: true, name: true } },
        lane: { select: { id: true, name: true } },
        stops: { select: { id: true } },
        orderShipments: { select: { id: true } },
      },
    });

    if (!shipment) return;

    await this.prisma.shipmentReadModel.update({
      where: { id: shipment.id },
      data: {
        reference: shipment.reference,
        status: shipment.status,
        customerName: shipment.customer.name,
        originName: shipment.origin?.name ?? null,
        originCity: shipment.origin?.city ?? null,
        originState: shipment.origin?.state ?? null,
        destinationName: shipment.destination?.name ?? null,
        destinationCity: shipment.destination?.city ?? null,
        destinationState: shipment.destination?.state ?? null,
        carrierName: shipment.carrier?.name ?? null,
        carrierId: shipment.carrierId,
        laneName: shipment.lane?.name ?? null,
        laneId: shipment.laneId,
        proNumber: shipment.proNumber,
        pickupDate: shipment.pickupDate,
        deliveryDate: shipment.deliveryDate,
        orderCount: shipment.orderShipments?.length ?? 0,
        stopCount: shipment.stops?.length ?? 0,
        updatedAt: new Date(),
      },
    }).catch((err: Error) => {
      console.error(`[ShipmentProjection] Failed to update ShipmentReadModel ${shipment.id}: ${err.message}`);
    });
  }

  private async onStatusChanged(event: DomainEvent): Promise<void> {
    const payload = event.payload as { newStatus: string };
    await this.prisma.shipmentReadModel.update({
      where: { id: event.entityId },
      data: { status: payload.newStatus, updatedAt: new Date() },
    }).catch((err: Error) => {
      console.error(`[ShipmentProjection] Failed to update read model for ${event.entityId}: ${err.message}`);
    });
  }

  private async onCarrierAssigned(event: DomainEvent): Promise<void> {
    const payload = event.payload as { carrierId: string; carrierName?: string };

    let carrierName = payload.carrierName;
    if (!carrierName && payload.carrierId) {
      const carrier = await this.prisma.carrier.findUnique({
        where: { id: payload.carrierId },
        select: { name: true },
      });
      carrierName = carrier?.name ?? undefined;
    }

    await this.prisma.shipmentReadModel.update({
      where: { id: event.entityId },
      data: {
        carrierId: payload.carrierId,
        carrierName: carrierName ?? undefined,
        updatedAt: new Date(),
      },
    }).catch((err: Error) => {
      console.error(`[ShipmentProjection] Failed to update read model for ${event.entityId}: ${err.message}`);
    });
  }

  private async onShipmentDelivered(event: DomainEvent): Promise<void> {
    await this.prisma.shipmentReadModel.update({
      where: { id: event.entityId },
      data: { status: 'delivered', updatedAt: new Date() },
    }).catch((err: Error) => {
      console.error(`[ShipmentProjection] Failed to update read model for ${event.entityId}: ${err.message}`);
    });
  }

  private async onStopUpdate(event: DomainEvent): Promise<void> {
    // Re-count stops and update
    const shipmentId = event.entityId;
    const stopCount = await this.prisma.shipmentStop.count({
      where: { shipmentId },
    });
    await this.prisma.shipmentReadModel.update({
      where: { id: shipmentId },
      data: { stopCount, updatedAt: new Date() },
    }).catch((err: Error) => {
      console.error(`[ShipmentProjection] Failed to update read model for ${event.entityId}: ${err.message}`);
    });
  }

  private async onLocationReceived(event: DomainEvent): Promise<void> {
    const payload = event.payload as { shipmentId: string; lat: number; lng: number; eventTime: string };
    await this.prisma.shipmentReadModel.update({
      where: { id: payload.shipmentId },
      data: {
        currentLat: payload.lat,
        currentLng: payload.lng,
        lastLocationAt: new Date(payload.eventTime),
        updatedAt: new Date(),
      },
    }).catch((err: Error) => {
      console.error(`[ShipmentProjection] Failed to update read model for ${event.entityId}: ${err.message}`);
    });
  }
}
