import { PrismaClient } from '@prisma/client';

export interface AssignmentResult {
  success: boolean;
  shipmentId?: string;
  pendingLaneRequestId?: string;
  message: string;
}

export interface IShipmentAssignmentService {
  assignOrderToShipment(orderId: string): Promise<AssignmentResult>;
}

export class ShipmentAssignmentService implements IShipmentAssignmentService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Attempt to assign an order to a shipment based on matching lanes.
   * If no matching lane exists, create a pending lane request.
   */
  async assignOrderToShipment(orderId: string): Promise<AssignmentResult> {
    // Fetch order with all details
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        trackableUnits: {
          include: {
            lineItems: true
          }
        },
        lineItems: true
      }
    });

    if (!order) {
      return {
        success: false,
        message: 'Order not found'
      };
    }

    // Check if order has valid locations
    if (!order.originId || !order.destinationId) {
      return {
        success: false,
        message: 'Order must have valid origin and destination locations'
      };
    }

    // Check if order is already assigned or converted
    if (order.status === 'converted' || order.status === 'assigned') {
      return {
        success: false,
        message: `Order is already ${order.status}`
      };
    }

    // Find matching lanes
    const matchingLane = await this.findMatchingLane(
      order.originId,
      order.destinationId,
      order.serviceLevel,
      order.temperatureControl,
      order.requiresHazmat
    );

    if (!matchingLane) {
      // No matching lane - create pending lane request
      const pendingRequest = await this.createPendingLaneRequest(order);

      // Update order status
      await this.prisma.order.update({
        where: { id: orderId },
        data: { status: 'pending_lane' }
      });

      return {
        success: true,
        pendingLaneRequestId: pendingRequest.id,
        message: 'No matching lane found. Pending lane request created.'
      };
    }

    // Check capacity constraints for LTL
    if (order.serviceLevel === 'LTL' && matchingLane.maxWeight) {
      const orderWeight = this.calculateOrderWeight(order);
      if (orderWeight > matchingLane.maxWeight) {
        return {
          success: false,
          message: `Order weight (${orderWeight}kg) exceeds lane capacity (${matchingLane.maxWeight}kg)`
        };
      }
    }

    // Find or create shipment for this lane
    const shipment = await this.findOrCreateShipment(
      matchingLane.id,
      order.customerId,
      order.originId,
      order.destinationId,
      order.serviceLevel
    );

    // Convert order to shipment format and update shipment items
    await this.addOrderToShipment(shipment.id, order);

    // Create junction record
    await this.prisma.orderShipment.create({
      data: {
        orderId: order.id,
        shipmentId: shipment.id
      }
    });

    // Update order status
    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'assigned' }
    });

    return {
      success: true,
      shipmentId: shipment.id,
      message: `Order assigned to shipment ${shipment.reference}`
    };
  }

  /**
   * Find a lane that matches the order requirements
   */
  private async findMatchingLane(
    originId: string,
    destinationId: string,
    serviceLevel: string,
    temperatureControl: string,
    requiresHazmat: boolean
  ) {
    const lanes = await this.prisma.lane.findMany({
      where: {
        originId,
        destinationId,
        archived: false,
        status: 'active',
        // Match service level (lane must support the order's service level)
        OR: [
          { serviceLevel: serviceLevel },
          { serviceLevel: 'Both' }
        ]
      }
    });

    // Filter lanes by additional requirements
    const matchingLane = lanes.find((lane: any) => {
      // Check temperature control
      if ((temperatureControl === 'refrigerated' || temperatureControl === 'frozen')
          && !lane.supportsTemperatureControl) {
        return false;
      }

      // Check hazmat
      if (requiresHazmat && !lane.supportsHazmat) {
        return false;
      }

      return true;
    });

    return matchingLane || null;
  }

  /**
   * Create a pending lane request for an order that has no matching lane
   */
  private async createPendingLaneRequest(order: any) {
    return this.prisma.pendingLaneRequest.create({
      data: {
        orderId: order.id,
        originId: order.originId!,
        destinationId: order.destinationId!,
        serviceLevel: order.serviceLevel,
        requiresTemperatureControl:
          order.temperatureControl === 'refrigerated' ||
          order.temperatureControl === 'frozen',
        requiresHazmat: order.requiresHazmat,
        notes: `Order ${order.orderNumber} requires a new lane`
      }
    });
  }

  /**
   * Find an existing shipment for the lane or create a new one
   */
  private async findOrCreateShipment(
    laneId: string,
    customerId: string,
    originId: string,
    destinationId: string,
    serviceLevel: string
  ) {
    // For FTL, always create a new shipment (dedicated)
    if (serviceLevel === 'FTL') {
      return this.createShipment(laneId, customerId, originId, destinationId, serviceLevel);
    }

    // For LTL, try to find an existing draft shipment
    const existingShipment = await this.prisma.shipment.findFirst({
      where: {
        laneId,
        status: 'draft', // Only consolidate into draft shipments
        archived: false
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (existingShipment) {
      return existingShipment;
    }

    // No existing shipment - create new one
    return this.createShipment(laneId, customerId, originId, destinationId, serviceLevel);
  }

  /**
   * Create a new shipment
   */
  private async createShipment(
    laneId: string,
    customerId: string,
    originId: string,
    destinationId: string,
    serviceLevel: string
  ) {
    const timestamp = Date.now().toString(36).toUpperCase().slice(-6);
    const reference = `SH-${serviceLevel}-${timestamp}`;

    return this.prisma.shipment.create({
      data: {
        reference,
        customerId,
        originId,
        destinationId,
        laneId,
        status: 'draft',
        items: [] // Will be populated as orders are added
      }
    });
  }

  /**
   * Add order data to shipment's items JSON
   */
  private async addOrderToShipment(shipmentId: string, order: any) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId }
    });

    if (!shipment) {
      throw new Error('Shipment not found');
    }

    const existingItems = (shipment.items as any[]) || [];

    // Build order item structure
    const orderItems: any = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      trackableUnits: order.trackableUnits.map((unit: any) => ({
        unitId: unit.id,
        identifier: unit.identifier,
        unitType: unit.unitType,
        items: unit.lineItems.map((item: any) => ({
          sku: item.sku,
          description: item.description,
          quantity: item.quantity,
          weight: item.weight,
          weightUnit: item.weightUnit
        }))
      })),
      legacyItems: order.lineItems.filter((item: any) => !item.trackableUnitId).map((item: any) => ({
        sku: item.sku,
        description: item.description,
        quantity: item.quantity,
        weight: item.weight,
        weightUnit: item.weightUnit
      }))
    };

    // Append to items array
    const updatedItems = [...existingItems, orderItems];

    // Update shipment
    await this.prisma.shipment.update({
      where: { id: shipmentId },
      data: { items: updatedItems }
    });
  }

  /**
   * Calculate total weight of an order
   */
  private calculateOrderWeight(order: any): number {
    let totalWeight = 0;

    // Weight from trackable units
    order.trackableUnits.forEach((unit: any) => {
      unit.lineItems.forEach((item: any) => {
        if (item.weight) {
          // Convert to kg if needed
          const weightInKg = item.weightUnit === 'kg' ? item.weight : item.weight * 0.453592; // lb to kg
          totalWeight += weightInKg * item.quantity;
        }
      });
    });

    // Weight from legacy items
    order.lineItems.forEach((item: any) => {
      if (item.weight && !item.trackableUnitId) {
        const weightInKg = item.weightUnit === 'kg' ? item.weight : item.weight * 0.453592;
        totalWeight += weightInKg * item.quantity;
      }
    });

    return totalWeight;
  }
}
