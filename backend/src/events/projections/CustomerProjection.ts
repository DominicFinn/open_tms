/**
 * CustomerProjection — builds and maintains the CustomerReadModel from domain events.
 *
 * Subscribes to customer.* and order.created (to update order counts).
 */

import { PrismaClient } from '@prisma/client';
import { DomainEvent } from '../DomainEvent.js';
import { IEventHandler } from '../IEventHandler.js';
import { SubscribeOptions } from '../IEventBus.js';
import { EVENT_TYPES } from '../eventTypes.js';

export class CustomerProjection implements IEventHandler {
  readonly name = 'projection.customer';
  readonly eventPatterns = ['customer.*', 'order.created', 'order.delivered', 'order.archived', 'order.status_changed'];
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
      case EVENT_TYPES.CUSTOMER_CREATED:
        return this.onCustomerCreated(event);
      case EVENT_TYPES.CUSTOMER_UPDATED:
        return this.onCustomerUpdated(event);
      case EVENT_TYPES.CUSTOMER_ARCHIVED:
        return this.onCustomerArchived(event);
      case EVENT_TYPES.ORDER_CREATED:
        return this.onOrderCreated(event);
      case EVENT_TYPES.ORDER_DELIVERED:
      case EVENT_TYPES.ORDER_ARCHIVED:
        return this.onOrderNoLongerActive(event);
      case EVENT_TYPES.ORDER_STATUS_CHANGED:
        return this.onOrderStatusChanged(event);
      default:
        break;
    }
  }

  private async onCustomerCreated(event: DomainEvent): Promise<void> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: event.entityId },
      include: {
        orders: { where: { archived: false }, select: { id: true, status: true } },
      },
    });

    if (!customer) {
      console.error(`[CustomerProjection] Customer ${event.entityId} not found for created event`);
      return;
    }

    const activeOrders = customer.orders.filter((o) => !['archived', 'cancelled'].includes(o.status)).length;

    await this.prisma.customerReadModel.upsert({
      where: { id: customer.id },
      create: {
        id: customer.id,
        orgId: event.orgId,
        name: customer.name,
        contactEmail: customer.contactEmail,
        activeOrderCount: activeOrders,
        totalOrderCount: customer.orders.length,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
      },
      update: {
        name: customer.name,
        contactEmail: customer.contactEmail,
        updatedAt: customer.updatedAt,
      },
    });
  }

  private async onCustomerUpdated(event: DomainEvent): Promise<void> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: event.entityId },
    });

    if (!customer) return;

    await this.prisma.customerReadModel.update({
      where: { id: customer.id },
      data: {
        name: customer.name,
        contactEmail: customer.contactEmail,
        updatedAt: new Date(),
      },
    }).catch((err: Error) => {
      console.error(`[CustomerProjection] Failed to update read model for ${event.entityId}: ${err.message}`);
    });
  }

  private async onCustomerArchived(event: DomainEvent): Promise<void> {
    await this.prisma.customerReadModel.delete({
      where: { id: event.entityId },
    }).catch((err: Error) => {
      console.error(`[CustomerProjection] Failed to delete read model for ${event.entityId}: ${err.message}`);
    });
  }

  private async onOrderCreated(event: DomainEvent): Promise<void> {
    const payload = event.payload as { customerId?: string };
    if (!payload.customerId) return;

    // Increment order counts
    await this.prisma.customerReadModel.update({
      where: { id: payload.customerId },
      data: {
        activeOrderCount: { increment: 1 },
        totalOrderCount: { increment: 1 },
        updatedAt: new Date(),
      },
    }).catch((err: Error) => {
      console.error(`[CustomerProjection] Failed to increment order count for ${payload.customerId}: ${err.message}`);
    });
  }

  private async onOrderNoLongerActive(event: DomainEvent): Promise<void> {
    // Decrement activeOrderCount when an order is delivered or archived
    const payload = event.payload as { customerId?: string };
    const customerId = payload.customerId || await this.getCustomerIdForOrder(event.entityId);
    if (!customerId) return;

    await this.prisma.customerReadModel.update({
      where: { id: customerId },
      data: {
        activeOrderCount: { decrement: 1 },
        updatedAt: new Date(),
      },
    }).catch((err: Error) => {
      console.error(`[CustomerProjection] Failed to decrement order count for ${customerId}: ${err.message}`);
    });
  }

  private async onOrderStatusChanged(event: DomainEvent): Promise<void> {
    // Handle status transitions that affect active order count
    const payload = event.payload as { oldStatus?: string; newStatus: string; customerId?: string };
    const wasActive = !['cancelled', 'archived', 'delivered'].includes(payload.oldStatus ?? '');
    const isActive = !['cancelled', 'archived', 'delivered'].includes(payload.newStatus);

    if (wasActive === isActive) return; // No change in active-ness

    const customerId = payload.customerId || await this.getCustomerIdForOrder(event.entityId);
    if (!customerId) return;

    await this.prisma.customerReadModel.update({
      where: { id: customerId },
      data: {
        activeOrderCount: isActive ? { increment: 1 } : { decrement: 1 },
        updatedAt: new Date(),
      },
    }).catch((err: Error) => {
      console.error(`[CustomerProjection] Failed to update order count for ${customerId}: ${err.message}`);
    });
  }

  private async getCustomerIdForOrder(orderId: string): Promise<string | null> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { customerId: true },
    });
    return order?.customerId ?? null;
  }
}
