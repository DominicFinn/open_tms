import { PrismaClient } from '@prisma/client';

export interface DeliveryStatusUpdate {
  orderId: string;
  deliveryStatus: 'unassigned' | 'assigned' | 'in_transit' | 'delivered' | 'exception' | 'cancelled';
  deliveryMethod?: 'manual' | 'geofence' | 'geofence_iot' | 'auto' | 'driver_app';
  deliveryConfirmedBy?: string; // User ID or system identifier
  deliveryNotes?: string;
  exceptionType?: 'delay' | 'damage' | 'refused' | 'address_issue' | 'weather' | 'other';
  exceptionNotes?: string;
}

export interface DeliveryException {
  orderId: string;
  exceptionType: 'delay' | 'damage' | 'refused' | 'address_issue' | 'weather' | 'other';
  exceptionNotes: string;
  reportedBy?: string;
}

export interface IOrderDeliveryService {
  updateOrderDeliveryStatus(update: DeliveryStatusUpdate): Promise<any>;
  markOrderDelivered(orderId: string, method: string, confirmedBy?: string, notes?: string): Promise<any>;
  createDeliveryException(exception: DeliveryException): Promise<any>;
  resolveDeliveryException(orderId: string, resolvedBy?: string, notes?: string): Promise<any>;
  updateOrdersForStop(shipmentStopId: string, status: string, method: string): Promise<number>;
  checkGeofenceAndUpdateOrders(shipmentId: string, currentLat: number, currentLng: number): Promise<number>;
}

export class OrderDeliveryService implements IOrderDeliveryService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Update order delivery status
   */
  async updateOrderDeliveryStatus(update: DeliveryStatusUpdate): Promise<any> {
    const order = await this.prisma.order.findUnique({
      where: { id: update.orderId },
      include: {
        deliveryStop: {
          include: {
            location: true,
            shipment: true
          }
        }
      }
    });

    if (!order) {
      throw new Error('Order not found');
    }

    // Build update data
    const updateData: any = {
      deliveryStatus: update.deliveryStatus,
      deliveryMethod: update.deliveryMethod,
      deliveryConfirmedBy: update.deliveryConfirmedBy,
      deliveryNotes: update.deliveryNotes,
      updatedAt: new Date()
    };

    // If marking as delivered, set timestamp
    if (update.deliveryStatus === 'delivered') {
      updateData.deliveredAt = new Date();
    }

    // If exception, set exception fields
    if (update.deliveryStatus === 'exception') {
      updateData.exceptionType = update.exceptionType;
      updateData.exceptionNotes = update.exceptionNotes;
    }

    // Update order
    const updatedOrder = await this.prisma.order.update({
      where: { id: update.orderId },
      data: updateData,
      include: {
        customer: true,
        origin: true,
        destination: true,
        deliveryStop: {
          include: {
            location: true,
            shipment: true
          }
        }
      }
    });

    // Write audit log for delivery status change
    await this.prisma.auditLog.create({
      data: {
        entityType: 'order',
        entityId: update.orderId,
        orderId: update.orderId,
        action: 'delivery_status_changed',
        description: `Delivery status changed from ${order.deliveryStatus} to ${update.deliveryStatus}${update.deliveryMethod ? ` via ${update.deliveryMethod}` : ''}`,
        changes: {
          before: { deliveryStatus: order.deliveryStatus },
          after: {
            deliveryStatus: update.deliveryStatus,
            ...(update.deliveryMethod && { deliveryMethod: update.deliveryMethod }),
            ...(update.exceptionType && { exceptionType: update.exceptionType }),
          }
        },
        userId: update.deliveryConfirmedBy || undefined,
      }
    });

    return updatedOrder;
  }

  /**
   * Mark order as delivered (convenience method)
   */
  async markOrderDelivered(
    orderId: string,
    method: string = 'manual',
    confirmedBy?: string,
    notes?: string
  ): Promise<any> {
    return this.updateOrderDeliveryStatus({
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
  async resolveDeliveryException(
    orderId: string,
    resolvedBy?: string,
    notes?: string
  ): Promise<any> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.deliveryStatus !== 'exception') {
      throw new Error('Order is not in exception status');
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        deliveryStatus: 'in_transit',
        exceptionResolvedAt: new Date(),
        deliveryNotes: notes ? `${order.deliveryNotes || ''}\n\nException resolved: ${notes}` : order.deliveryNotes,
        updatedAt: new Date()
      },
      include: {
        customer: true,
        origin: true,
        destination: true,
        deliveryStop: true
      }
    });

    await this.prisma.auditLog.create({
      data: {
        entityType: 'order',
        entityId: orderId,
        orderId,
        action: 'exception_resolved',
        description: `Exception resolved, status changed from exception to in_transit${notes ? `: ${notes}` : ''}`,
        changes: {
          before: { deliveryStatus: 'exception', exceptionType: order.exceptionType },
          after: { deliveryStatus: 'in_transit' }
        },
        userId: resolvedBy || undefined,
      }
    });

    return updated;
  }

  /**
   * Update all orders for a specific shipment stop
   * Used when a stop is reached/completed
   */
  async updateOrdersForStop(
    shipmentStopId: string,
    status: string,
    method: string = 'auto'
  ): Promise<number> {
    const stop = await this.prisma.shipmentStop.findUnique({
      where: { id: shipmentStopId },
      include: {
        orders: {
          where: {
            deliveryStatus: {
              notIn: ['delivered', 'cancelled']
            }
          }
        },
        location: true
      }
    });

    if (!stop) {
      throw new Error('Shipment stop not found');
    }

    // Update stop status
    await this.prisma.shipmentStop.update({
      where: { id: shipmentStopId },
      data: {
        status,
        actualArrival: status === 'arrived' || status === 'in_progress' || status === 'completed' ? new Date() : stop.actualArrival,
        actualDeparture: status === 'completed' ? new Date() : stop.actualDeparture,
        updatedAt: new Date()
      }
    });

    // If stop is completed, mark all orders at this stop as delivered
    if (status === 'completed') {
      const affectedOrders = stop.orders;
      const updateResult = await this.prisma.order.updateMany({
        where: {
          deliveryStopId: shipmentStopId,
          deliveryStatus: {
            notIn: ['delivered', 'cancelled']
          }
        },
        data: {
          deliveryStatus: 'delivered',
          deliveredAt: new Date(),
          deliveryMethod: method,
          deliveryConfirmedBy: 'system:shipment_stop_completed',
          updatedAt: new Date()
        }
      });

      // Audit log for each affected order
      for (const o of affectedOrders) {
        await this.prisma.auditLog.create({
          data: {
            entityType: 'order',
            entityId: o.id,
            orderId: o.id,
            action: 'delivery_status_changed',
            description: `Order delivered at stop (${stop.location?.name || 'unknown'}) via ${method}`,
            changes: {
              before: { deliveryStatus: o.deliveryStatus },
              after: { deliveryStatus: 'delivered' }
            },
          }
        });
      }

      return updateResult.count;
    }

    // If stop is in_progress or arrived, mark orders as in_transit
    if (status === 'arrived' || status === 'in_progress') {
      const affectedOrders = stop.orders.filter(
        (o: any) => o.deliveryStatus === 'assigned' || o.deliveryStatus === 'unassigned'
      );
      const updateResult = await this.prisma.order.updateMany({
        where: {
          deliveryStopId: shipmentStopId,
          deliveryStatus: {
            in: ['assigned', 'unassigned']
          }
        },
        data: {
          deliveryStatus: 'in_transit',
          deliveryMethod: method,
          updatedAt: new Date()
        }
      });

      for (const o of affectedOrders) {
        await this.prisma.auditLog.create({
          data: {
            entityType: 'order',
            entityId: o.id,
            orderId: o.id,
            action: 'delivery_status_changed',
            description: `Order in transit — stop ${status} (${stop.location?.name || 'unknown'}) via ${method}`,
            changes: {
              before: { deliveryStatus: o.deliveryStatus },
              after: { deliveryStatus: 'in_transit' }
            },
          }
        });
      }

      return updateResult.count;
    }

    return 0;
  }

  /**
   * Check if shipment is within geofence of any stops and update orders
   * This would be called by a geofencing service/webhook
   */
  async checkGeofenceAndUpdateOrders(
    shipmentId: string,
    currentLat: number,
    currentLng: number
  ): Promise<number> {
    // Get all stops for this shipment with geofencing enabled
    const stops = await this.prisma.shipmentStop.findMany({
      where: {
        shipmentId,
        geofenceEnabled: true,
        status: {
          in: ['pending', 'arrived']
        }
      },
      include: {
        location: true,
        orders: {
          where: {
            deliveryStatus: {
              notIn: ['delivered', 'cancelled']
            }
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

      // If within geofence radius
      if (distance <= stop.geofenceRadius) {
        // Mark stop as arrived if it was pending
        if (stop.status === 'pending') {
          await this.prisma.shipmentStop.update({
            where: { id: stop.id },
            data: {
              status: 'arrived',
              actualArrival: new Date(),
              updatedAt: new Date()
            }
          });
        }

        // Update orders for this stop
        const ordersUpdated = await this.updateOrdersForStop(
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
