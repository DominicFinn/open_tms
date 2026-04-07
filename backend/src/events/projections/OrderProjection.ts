/**
 * OrderProjection — builds and maintains the OrderReadModel from domain events.
 *
 * Subscribes to order.* events and denormalizes order data into a flat read
 * model table optimized for list queries (no joins needed).
 *
 * On order.created: looks up related entities (customer, origin, destination)
 * and inserts a full denormalized row.
 *
 * On order.updated / status changes: patches the relevant fields.
 */

import { PrismaClient } from '@prisma/client';
import { DomainEvent } from '../DomainEvent.js';
import { IEventHandler } from '../IEventHandler.js';
import { SubscribeOptions } from '../IEventBus.js';
import { EVENT_TYPES } from '../eventTypes.js';

export class OrderProjection implements IEventHandler {
  readonly name = 'projection.order';
  readonly eventPatterns = ['order.*'];
  readonly options: SubscribeOptions = {
    concurrency: 3,
    priority: 5,
    retryLimit: 5,
    expireInSeconds: 600,
  };

  constructor(private prisma: PrismaClient) {}

  async handle(event: DomainEvent): Promise<void> {
    switch (event.type) {
      case EVENT_TYPES.ORDER_CREATED:
        return this.onOrderCreated(event);
      case EVENT_TYPES.ORDER_UPDATED:
        return this.onOrderUpdated(event);
      case EVENT_TYPES.ORDER_STATUS_CHANGED:
        return this.onOrderStatusChanged(event);
      case EVENT_TYPES.ORDER_DELIVERY_STATUS_CHANGED:
        return this.onDeliveryStatusChanged(event);
      case EVENT_TYPES.ORDER_ASSIGNED_TO_SHIPMENT:
        return this.onAssignedToShipment(event);
      case EVENT_TYPES.ORDER_DELIVERED:
        return this.onOrderDelivered(event);
      case EVENT_TYPES.ORDER_EXCEPTION:
        return this.onOrderException(event);
      case EVENT_TYPES.ORDER_EXCEPTION_RESOLVED:
        return this.onExceptionResolved(event);
      default:
        // Unknown order event — skip
        break;
    }
  }

  private async onOrderCreated(event: DomainEvent): Promise<void> {
    // Fetch the full order with relations to denormalize
    const order = await this.prisma.order.findUnique({
      where: { id: event.entityId },
      include: {
        customer: { select: { id: true, name: true } },
        origin: { select: { name: true, city: true, state: true } },
        destination: { select: { name: true, city: true, state: true } },
        trackableUnits: { select: { id: true } },
        lineItems: { select: { id: true, weight: true } },
      },
    });

    if (!order) {
      console.warn(`[OrderProjection] Order ${event.entityId} not found for created event`);
      return;
    }

    // Calculate total weight from line items and trackable units
    const totalWeight = await this.calculateTotalWeight(event.entityId);

    await this.prisma.orderReadModel.upsert({
      where: { id: order.id },
      create: {
        id: order.id,
        orgId: event.orgId,
        orderNumber: order.orderNumber,
        poNumber: order.poNumber,
        status: order.status,
        deliveryStatus: order.deliveryStatus || 'unassigned',
        customerName: order.customer.name,
        customerId: order.customerId,
        originName: order.origin?.name ?? null,
        originCity: order.origin?.city ?? null,
        originState: order.origin?.state ?? null,
        destinationName: order.destination?.name ?? null,
        destinationCity: order.destination?.city ?? null,
        destinationState: order.destination?.state ?? null,
        serviceLevel: order.serviceLevel,
        temperatureRequired: order.temperatureControl !== 'ambient',
        hazmat: order.requiresHazmat || false,
        trackableUnitCount: order.trackableUnits?.length ?? 0,
        lineItemCount: order.lineItems?.length ?? 0,
        totalWeight,
        requestedDeliveryDate: order.requestedDeliveryDate,
        importSource: order.importSource,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      },
      update: {
        status: order.status,
        deliveryStatus: order.deliveryStatus || 'unassigned',
        customerName: order.customer.name,
        updatedAt: order.updatedAt,
      },
    });
  }

  private async onOrderUpdated(event: DomainEvent): Promise<void> {
    // Re-fetch and update the read model
    const order = await this.prisma.order.findUnique({
      where: { id: event.entityId },
      include: {
        customer: { select: { name: true } },
        origin: { select: { name: true, city: true, state: true } },
        destination: { select: { name: true, city: true, state: true } },
      },
    });

    if (!order) return;

    await this.prisma.orderReadModel.update({
      where: { id: order.id },
      data: {
        orderNumber: order.orderNumber,
        poNumber: order.poNumber,
        status: order.status,
        customerName: order.customer.name,
        originName: order.origin?.name ?? null,
        originCity: order.origin?.city ?? null,
        originState: order.origin?.state ?? null,
        destinationName: order.destination?.name ?? null,
        destinationCity: order.destination?.city ?? null,
        destinationState: order.destination?.state ?? null,
        serviceLevel: order.serviceLevel,
        temperatureRequired: order.temperatureControl !== 'ambient',
        hazmat: order.requiresHazmat || false,
        requestedDeliveryDate: order.requestedDeliveryDate,
        updatedAt: new Date(),
      },
    }).catch(() => {
      // Read model row may not exist yet if backfill hasn't run
      console.warn(`[OrderProjection] OrderReadModel ${order.id} not found for update`);
    });
  }

  private async onOrderStatusChanged(event: DomainEvent): Promise<void> {
    const payload = event.payload as { newStatus: string };
    await this.prisma.orderReadModel.update({
      where: { id: event.entityId },
      data: { status: payload.newStatus, updatedAt: new Date() },
    }).catch(() => {});
  }

  private async onDeliveryStatusChanged(event: DomainEvent): Promise<void> {
    const payload = event.payload as { newStatus: string };
    await this.prisma.orderReadModel.update({
      where: { id: event.entityId },
      data: {
        deliveryStatus: payload.newStatus,
        deliveredAt: payload.newStatus === 'delivered' ? new Date() : undefined,
        exceptionType: payload.newStatus === 'exception' ? undefined : null,
        updatedAt: new Date(),
      },
    }).catch(() => {});
  }

  private async onAssignedToShipment(event: DomainEvent): Promise<void> {
    const payload = event.payload as { shipmentId: string; shipmentReference: string };
    await this.prisma.orderReadModel.update({
      where: { id: event.entityId },
      data: {
        shipmentId: payload.shipmentId,
        shipmentReference: payload.shipmentReference,
        deliveryStatus: 'assigned',
        updatedAt: new Date(),
      },
    }).catch(() => {});
  }

  private async onOrderDelivered(event: DomainEvent): Promise<void> {
    await this.prisma.orderReadModel.update({
      where: { id: event.entityId },
      data: {
        deliveryStatus: 'delivered',
        deliveredAt: new Date(),
        exceptionType: null,
        updatedAt: new Date(),
      },
    }).catch(() => {});
  }

  private async onOrderException(event: DomainEvent): Promise<void> {
    const payload = event.payload as { exceptionType?: string };
    await this.prisma.orderReadModel.update({
      where: { id: event.entityId },
      data: {
        deliveryStatus: 'exception',
        exceptionType: payload.exceptionType ?? 'unknown',
        updatedAt: new Date(),
      },
    }).catch(() => {});
  }

  private async onExceptionResolved(event: DomainEvent): Promise<void> {
    await this.prisma.orderReadModel.update({
      where: { id: event.entityId },
      data: {
        deliveryStatus: 'in_transit',
        exceptionType: null,
        updatedAt: new Date(),
      },
    }).catch(() => {});
  }

  private async calculateTotalWeight(orderId: string): Promise<number | null> {
    const items = await this.prisma.orderLineItem.findMany({
      where: { orderId },
      select: { weight: true },
    });
    if (items.length === 0) return null;
    const total = items.reduce((sum, item) => sum + (item.weight ?? 0), 0);
    return total > 0 ? total : null;
  }
}
