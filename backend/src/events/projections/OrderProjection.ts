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
  readonly eventPatterns = ['order.*', 'trackable_unit.*', 'order_line_item.*'];
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
      case EVENT_TYPES.ORDER_ARCHIVED:
        return this.onOrderArchived(event);
      case EVENT_TYPES.ORDER_DELETED:
        return this.onOrderDeleted(event);
      case EVENT_TYPES.ORDER_UNARCHIVED:
        return this.onOrderCreated(event);
      case EVENT_TYPES.TRACKABLE_UNIT_CREATED:
      case EVENT_TYPES.TRACKABLE_UNIT_UPDATED:
      case EVENT_TYPES.TRACKABLE_UNIT_DELETED:
      case EVENT_TYPES.TRACKABLE_UNIT_LINE_ITEM_ADDED:
      case EVENT_TYPES.TRACKABLE_UNIT_LINE_ITEM_MOVED:
      case EVENT_TYPES.TRACKABLE_UNITS_MERGED:
      case EVENT_TYPES.TRACKABLE_UNIT_SPLIT:
        return this.onTrackableUnitChanged(event);
      case EVENT_TYPES.TRACKABLE_UNIT_BARCODE_GENERATED:
        // No read-model impact — barcode is a per-unit attribute only.
        break;
      case EVENT_TYPES.ORDER_LINE_ITEM_CREATED:
      case EVENT_TYPES.ORDER_LINE_ITEM_UPDATED:
      case EVENT_TYPES.ORDER_LINE_ITEM_DELETED:
        return this.onLineItemChanged(event);
      default:
        // Unknown order event — skip
        break;
    }
  }

  /**
   * Trackable-unit mutations affect the order's denormalised counts +
   * aggregate weight. All trackable_unit.* events carry `orderId` in the
   * payload so we can recompute targeted at the right order.
   */
  private async onTrackableUnitChanged(event: DomainEvent): Promise<void> {
    const orderId = (event.payload as { orderId?: string })?.orderId;
    if (!orderId) return;
    await this.refreshAggregates(orderId, event.orgId);
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
    }).catch((err: Error) => {
      console.error(`[OrderProjection] Failed to update OrderReadModel ${order.id}: ${err.message}`);
    });
  }

  private async onOrderStatusChanged(event: DomainEvent): Promise<void> {
    const payload = event.payload as { newStatus: string };
    await this.prisma.orderReadModel.update({
      where: { id: event.entityId },
      data: { status: payload.newStatus, updatedAt: new Date() },
    }).catch((err: Error) => {
      console.error(`[OrderProjection] Failed to update read model for ${event.entityId}: ${err.message}`);
    });
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
    }).catch((err: Error) => {
      console.error(`[OrderProjection] Failed to update read model for ${event.entityId}: ${err.message}`);
    });
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
    }).catch((err: Error) => {
      console.error(`[OrderProjection] Failed to update read model for ${event.entityId}: ${err.message}`);
    });
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
    }).catch((err: Error) => {
      console.error(`[OrderProjection] Failed to update read model for ${event.entityId}: ${err.message}`);
    });
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
    }).catch((err: Error) => {
      console.error(`[OrderProjection] Failed to update read model for ${event.entityId}: ${err.message}`);
    });
  }

  private async onExceptionResolved(event: DomainEvent): Promise<void> {
    await this.prisma.orderReadModel.update({
      where: { id: event.entityId },
      data: {
        deliveryStatus: 'in_transit',
        exceptionType: null,
        updatedAt: new Date(),
      },
    }).catch((err: Error) => {
      console.error(`[OrderProjection] Failed to update read model for ${event.entityId}: ${err.message}`);
    });
  }

  private async onOrderArchived(event: DomainEvent): Promise<void> {
    // Remove archived orders from the read model so they don't appear in list views
    await this.prisma.orderReadModel.delete({
      where: { id: event.entityId },
    }).catch((err: Error) => {
      console.error(`[OrderProjection] Failed to delete archived order ${event.entityId}: ${err.message}`);
    });
  }

  private async onOrderDeleted(event: DomainEvent): Promise<void> {
    // Soft-deleted orders are hidden from every view, same read-model removal
    // as archive.
    await this.prisma.orderReadModel.delete({
      where: { id: event.entityId },
    }).catch((err: Error) => {
      console.error(`[OrderProjection] Failed to delete order ${event.entityId}: ${err.message}`);
    });
  }

  /**
   * Line-item mutations affect the order's `lineItemCount` + `totalWeight` in
   * the read model. All order_line_item.* events carry `orderId` in the
   * payload so we can target the recompute precisely.
   */
  private async onLineItemChanged(event: DomainEvent): Promise<void> {
    const orderId = (event.payload as { orderId?: string })?.orderId;
    if (!orderId) return;
    await this.refreshAggregates(orderId, event.orgId);
  }

  /**
   * Recompute trackableUnitCount/lineItemCount/totalWeight on the read model.
   *
   * Race-safe: pg-boss may deliver `trackable_unit.created` before
   * `order.created` is fully projected, in which case the `.update` would
   * fail with P2025 and the row would permanently drift. When that happens we
   * fall back to materialising the row from the live `Order` (same code path
   * as `onOrderCreated`), then re-apply the count update.
   */
  private async refreshAggregates(orderId: string, orgId: string): Promise<void> {
    const [unitCount, lineItemCount, totalWeight] = await Promise.all([
      this.prisma.trackableUnit.count({ where: { orderId } }),
      this.prisma.orderLineItem.count({ where: { orderId } }),
      this.calculateTotalWeight(orderId),
    ]);
    const data = { trackableUnitCount: unitCount, lineItemCount, totalWeight, updatedAt: new Date() };

    try {
      await this.prisma.orderReadModel.update({ where: { id: orderId }, data });
    } catch (err: any) {
      if (err?.code !== 'P2025') {
        console.error(`[OrderProjection] Failed to refresh aggregates for order ${orderId}: ${err?.message ?? err}`);
        return;
      }
      // Read-model row doesn't exist yet — recover by materialising from the
      // live Order. Then re-apply the aggregates so the upsert's "update" path
      // also reflects the latest counts.
      await this.materialiseFromOrder(orderId, orgId);
      await this.prisma.orderReadModel.update({ where: { id: orderId }, data }).catch((e: Error) => {
        console.error(`[OrderProjection] Recovery upsert succeeded but follow-up aggregate update failed for ${orderId}: ${e.message}`);
      });
    }
  }

  /**
   * Idempotent upsert of OrderReadModel from the live Order row. Same logic as
   * `onOrderCreated` but reusable from the race-recovery path.
   */
  private async materialiseFromOrder(orderId: string, orgId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: { select: { id: true, name: true } },
        origin: { select: { name: true, city: true, state: true } },
        destination: { select: { name: true, city: true, state: true } },
        trackableUnits: { select: { id: true } },
        lineItems: { select: { id: true, weight: true } },
      },
    });
    if (!order) return;
    const totalWeight = await this.calculateTotalWeight(orderId);
    await this.prisma.orderReadModel.upsert({
      where: { id: order.id },
      create: {
        id: order.id,
        orgId,
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
      update: { updatedAt: order.updatedAt },
    }).catch((err: Error) => {
      console.error(`[OrderProjection] Materialise failed for order ${orderId}: ${err.message}`);
    });
  }

  /**
   * Order weight aggregation. Line weight is treated as PER-PIECE: total =
   * sum(weight × quantity). Cartonization treats it the same way (per-piece),
   * so this keeps the two layers consistent.
   *
   * Phase 2 override: if any TrackableUnit has an explicit weight set
   * (sophisticated shipper built mixed-SKU pallets), trust the unit totals
   * rather than re-deriving from lines.
   */
  private async calculateTotalWeight(orderId: string): Promise<number | null> {
    const units = await this.prisma.trackableUnit.findMany({
      where: { orderId },
      select: { weight: true },
    });
    const hasUnitOverride = units.some(u => u.weight != null && u.weight > 0);
    if (hasUnitOverride) {
      const total = units.reduce((sum, u) => sum + (u.weight ?? 0), 0);
      return total > 0 ? total : null;
    }

    const items = await this.prisma.orderLineItem.findMany({
      where: { orderId },
      select: { weight: true, quantity: true },
    });
    if (items.length === 0) return null;
    const total = items.reduce((sum, item) => sum + ((item.weight ?? 0) * (item.quantity ?? 1)), 0);
    return total > 0 ? total : null;
  }
}
