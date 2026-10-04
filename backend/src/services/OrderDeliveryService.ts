import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { ICargoReconciliationService } from './CargoReconciliationService.js';
import { ICommandBus } from '../commands/CommandBus.js';
import {
  CHANGE_ORDER_DELIVERY_STATUS, ChangeOrderDeliveryStatusPayload,
  RESOLVE_ORDER_DELIVERY_EXCEPTION, ResolveOrderDeliveryExceptionPayload,
} from '../commands/orders/ChangeOrderDeliveryStatusCommand.js';
import { RECORD_STOP_ORDERS_DELIVERY, RecordStopOrdersDeliveryPayload } from '../commands/orders/RecordStopOrdersDeliveryCommand.js';

export interface DeliveryStatusUpdate {
  orgId: string;
  orderId: string;
  deliveryStatus: 'in_transit' | 'delivered' | 'exception';
  deliveryMethod?: 'manual' | 'geofence' | 'geofence_iot' | 'auto' | 'driver_app';
  deliveryConfirmedBy?: string; // User ID or system identifier
  deliveryNotes?: string;
  exceptionType?: 'delay' | 'damage' | 'refused' | 'address_issue' | 'weather' | 'other';
  exceptionNotes?: string;
}

export interface DeliveryException {
  orgId: string;
  orderId: string;
  exceptionType: 'delay' | 'damage' | 'refused' | 'address_issue' | 'weather' | 'other';
  exceptionNotes: string;
  reportedBy?: string;
}

export interface IOrderDeliveryService {
  updateOrderDeliveryStatus(update: DeliveryStatusUpdate): Promise<any>;
  markOrderDelivered(orgId: string, orderId: string, method: string, confirmedBy?: string, notes?: string): Promise<any>;
  createDeliveryException(exception: DeliveryException): Promise<any>;
  resolveDeliveryException(orgId: string, orderId: string, resolvedBy?: string, notes?: string): Promise<any>;
  /** `occurredAt` is when the stop event actually happened (device time); defaults to now. */
  updateOrdersForStop(orgId: string, shipmentStopId: string, status: string, method: string, occurredAt?: Date): Promise<number>;
  checkGeofenceAndUpdateOrders(orgId: string, shipmentId: string, currentLat: number, currentLng: number): Promise<number>;
}

const ORDER_DETAIL_INCLUDE = {
  customer: true,
  origin: true,
  destination: true,
  deliveryStop: { include: { location: true, shipment: true } },
} as const;

/** A failed delivery command, carrying the handler's message (routes surface it as-is). */
export class OrderDeliveryCommandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrderDeliveryCommandError';
  }
}

/**
 * Order delivery status. Every write goes through a command so it runs in a transaction and emits
 * order.* events after commit (#325); this service keeps the call shape the routes and the
 * tracking pipeline already use, and owns the cargo-reconciliation side effect.
 */
export class OrderDeliveryService implements IOrderDeliveryService {
  private cargoReconciliation: ICargoReconciliationService | null = null;

  constructor(private prisma: PrismaClient, private commandBus: ICommandBus) {}

  /**
   * Set the cargo reconciliation service (injected after construction to avoid circular deps)
   */
  setCargoReconciliationService(service: ICargoReconciliationService): void {
    this.cargoReconciliation = service;
  }

  async updateOrderDeliveryStatus(update: DeliveryStatusUpdate): Promise<any> {
    await this.dispatch<ChangeOrderDeliveryStatusPayload>(update.orgId, CHANGE_ORDER_DELIVERY_STATUS, {
      orderId: update.orderId,
      deliveryStatus: update.deliveryStatus,
      deliveryMethod: update.deliveryMethod,
      deliveryConfirmedBy: update.deliveryConfirmedBy,
      deliveryNotes: update.deliveryNotes,
      exceptionType: update.exceptionType,
      exceptionNotes: update.exceptionNotes,
    });
    return this.loadOrder(update.orgId, update.orderId);
  }

  /**
   * Mark order as delivered (convenience method)
   */
  async markOrderDelivered(
    orgId: string,
    orderId: string,
    method: string = 'manual',
    confirmedBy?: string,
    notes?: string
  ): Promise<any> {
    return this.updateOrderDeliveryStatus({
      orgId,
      orderId,
      deliveryStatus: 'delivered',
      deliveryMethod: method as any,
      deliveryConfirmedBy: confirmedBy,
      deliveryNotes: notes
    });
  }

  /**
   * Create delivery exception
   */
  async createDeliveryException(exception: DeliveryException): Promise<any> {
    return this.updateOrderDeliveryStatus({
      orgId: exception.orgId,
      orderId: exception.orderId,
      deliveryStatus: 'exception',
      exceptionType: exception.exceptionType,
      exceptionNotes: exception.exceptionNotes,
      deliveryConfirmedBy: exception.reportedBy,
      deliveryMethod: 'manual'
    });
  }

  /**
   * Resolve delivery exception and move order back to in_transit
   */
  async resolveDeliveryException(orgId: string, orderId: string, resolvedBy?: string, notes?: string): Promise<any> {
    await this.dispatch<ResolveOrderDeliveryExceptionPayload>(orgId, RESOLVE_ORDER_DELIVERY_EXCEPTION, { orderId, resolvedBy, notes });
    return this.loadOrder(orgId, orderId);
  }

  private loadOrder(orgId: string, orderId: string) {
    return this.prisma.order.findFirst({ where: { id: orderId, orgId }, include: ORDER_DETAIL_INCLUDE });
  }

  private async dispatch<TPayload, TResult = unknown>(orgId: string, type: string, payload: TPayload): Promise<TResult> {
    const result = await this.commandBus.dispatch<TPayload, TResult>({
      type,
      orgId,
      actorId: null,
      payload,
      metadata: { correlationId: randomUUID(), source: 'order_delivery' },
    });
    if (!result.success) throw new OrderDeliveryCommandError(result.error || 'Order delivery update failed');
    return result.data as TResult;
  }

  /**
   * Update all orders for a specific shipment stop
   * Used when a stop is reached/completed
   */
  async updateOrdersForStop(
    orgId: string,
    shipmentStopId: string,
    status: string,
    method: string = 'auto',
    occurredAt: Date = new Date(),
  ): Promise<number> {
    const result = await this.dispatch<RecordStopOrdersDeliveryPayload, { ordersUpdated: number; shipmentId: string }>(
      orgId, RECORD_STOP_ORDERS_DELIVERY, { stopId: shipmentStopId, status, method, occurredAt: occurredAt.toISOString() },
    );
    const stop = { shipmentId: result.shipmentId };

    // Cargo reconciliation runs outside the transaction (non-blocking side effect)
    if (status === 'completed' && this.cargoReconciliation) {
      try {
        await this.cargoReconciliation.reconcileCompletedStop(orgId, shipmentStopId, method);

        // If this was the last stop, check for cargo left on vehicle
        const allStops = await this.prisma.shipmentStop.findMany({
          where: { shipmentId: stop.shipmentId, shipment: { orgId } },
        });
        const allCompleted = allStops.every(
          (s) => s.id === shipmentStopId || s.status === 'completed' || s.status === 'skipped'
        );
        if (allCompleted) {
          await this.cargoReconciliation.checkLeftOnVehicle(orgId, stop.shipmentId);
        }
      } catch (err) {
        console.error('[OrderDeliveryService] Cargo reconciliation failed (non-blocking):', err);
      }
    }

    return result.ordersUpdated;
  }

  /**
   * Check if shipment is within geofence of any stops and update orders
   * This would be called by a geofencing service/webhook
   */
  async checkGeofenceAndUpdateOrders(
    orgId: string,
    shipmentId: string,
    currentLat: number,
    currentLng: number
  ): Promise<number> {
    // Get all stops for this shipment with geofencing enabled
    const stops = await this.prisma.shipmentStop.findMany({
      where: {
        shipmentId,
        shipment: { orgId },
        geofenceEnabled: true,
        status: {
          in: ['pending', 'arrived']
        }
      },
      include: {
        location: true,
        orders: {
          where: {
            OR: [
              { deliveryStatus: null },
              { deliveryStatus: 'in_transit' },
              { deliveryStatus: 'exception' },
            ],
          }
        }
      },
      orderBy: {
        sequenceNumber: 'asc'
      }
    });

    let totalOrdersUpdated = 0;

    for (const stop of stops) {
      if (!stop.location.lat || !stop.location.lng || !stop.geofenceRadius) {
        continue;
      }

      // Calculate distance using Haversine formula
      const distance = this.calculateDistance(
        currentLat,
        currentLng,
        stop.location.lat,
        stop.location.lng
      );

      // If within geofence radius and this stop hasn't already been processed —
      // updateOrdersForStop unconditionally overwrites ShipmentStop.status and
      // actualArrival on every call, so without this guard a repeat ping that
      // still matches the geofence re-stamps an already-arrived (or, via the
      // event-driven path added in #283, already-completed) stop back to
      // 'arrived' with a fresh timestamp on every subsequent ping.
      if (distance <= stop.geofenceRadius && stop.status === 'pending') {
        await this.prisma.shipmentStop.update({
          where: { id: stop.id, shipment: { orgId } },
          data: {
            status: 'arrived',
            actualArrival: new Date(),
            updatedAt: new Date()
          }
        });

        // Update orders for this stop
        const ordersUpdated = await this.updateOrdersForStop(
          orgId,
          stop.id,
          'arrived',
          'geofence'
        );
        totalOrdersUpdated += ordersUpdated;
      }
    }

    return totalOrdersUpdated;
  }

  /**
   * Calculate distance between two GPS coordinates using Haversine formula
   * Returns distance in meters
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  /**
   * Process IoT event (e.g., light sensor triggered at destination)
   * This would be called by IoT webhook/integration
   */
  async processIoTDeliveryEvent(
    orgId: string,
    shipmentId: string,
    eventType: 'light' | 'door_open' | 'temperature' | 'shock',
    location: { lat: number; lng: number },
    timestamp: Date
  ): Promise<number> {
    // For light sensor / door open events, check if we're at a delivery location
    if (eventType === 'light' || eventType === 'door_open') {
      // Find nearest stop
      const stops = await this.prisma.shipmentStop.findMany({
        where: {
          shipmentId,
          shipment: { orgId },
          status: {
            in: ['arrived', 'in_progress']
          }
        },
        include: {
          location: true
        }
      });

      // Find closest stop within 500m
      for (const stop of stops) {
        if (!stop.location.lat || !stop.location.lng) continue;

        const distance = this.calculateDistance(
          location.lat,
          location.lng,
          stop.location.lat,
          stop.location.lng
        );

        // If within 500m of stop and door opened, mark orders delivered
        if (distance <= 500) {
          const ordersUpdated = await this.updateOrdersForStop(
            orgId,
            stop.id,
            'completed',
            'geofence_iot'
          );
          return ordersUpdated;
        }
      }
    }

    return 0;
  }
}
