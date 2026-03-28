import { PrismaClient, Order, OrderLineItem, TrackableUnit } from '@prisma/client';

export interface CreateOrderLineItemDTO {
  sku: string;
  description?: string;
  quantity: number;
  weight?: number;
  weightUnit?: string;
  length?: number;
  width?: number;
  height?: number;
  dimUnit?: string;
  hazmat?: boolean;
  temperature?: string;
}

export interface CreateTrackableUnitDTO {
  identifier: string;
  unitType: string;
  customTypeName?: string;
  barcode?: string;
  notes?: string;
  lineItems: CreateOrderLineItemDTO[];
}

export interface CreateOrderDTO {
  orderNumber: string;
  poNumber?: string;
  customerId: string;
  importSource?: string;
  ediData?: any;

  // Location IDs (if they exist)
  originId?: string;
  destinationId?: string;

  // Raw location data (if location doesn't exist)
  originData?: any;
  destinationData?: any;

  // Dates
  orderDate?: Date;
  requestedPickupDate?: Date;
  requestedDeliveryDate?: Date;

  // Trackable units (new preferred way)
  trackableUnits?: CreateTrackableUnitDTO[];

  // Line items (legacy - for backward compatibility)
  lineItems?: CreateOrderLineItemDTO[];

  // Additional info
  specialInstructions?: string;
  notes?: string;
}

export interface UpdateOrderDTO {
  orderNumber?: string;
  poNumber?: string;
  status?: string;

  originId?: string;
  destinationId?: string;
  originData?: any;
  destinationData?: any;
  originValidated?: boolean;
  destinationValidated?: boolean;

  requestedPickupDate?: Date;
  requestedDeliveryDate?: Date;

  specialInstructions?: string;
  notes?: string;
}

export interface TrackableUnitWithItems extends TrackableUnit {
  lineItems: OrderLineItem[];
}

export interface OrderWithRelations extends Order {
  customer: {
    id: string;
    name: string;
    contactEmail: string | null;
  };
  origin?: {
    id: string;
    name: string;
    address1: string;
    city: string;
    state: string | null;
    country: string;
  } | null;
  destination?: {
    id: string;
    name: string;
    address1: string;
    city: string;
    state: string | null;
    country: string;
  } | null;
  trackableUnits: TrackableUnitWithItems[];
  lineItems: OrderLineItem[]; // Legacy line items not in trackable units
}

export interface IOrdersRepository {
  all(): Promise<OrderWithRelations[]>;
  findById(id: string): Promise<OrderWithRelations | null>;
  findByOrderNumber(orderNumber: string): Promise<OrderWithRelations | null>;
  findByCustomerId(customerId: string, options?: { status?: string; limit?: number; offset?: number }): Promise<OrderWithRelations[]>;
  create(data: CreateOrderDTO): Promise<OrderWithRelations>;
  update(id: string, data: UpdateOrderDTO): Promise<Order>;
  archive(id: string): Promise<Order>;
  validateLocation(id: string, locationType: 'origin' | 'destination', locationId: string): Promise<Order>;

  // Line items (legacy)
  addLineItem(orderId: string, item: CreateOrderLineItemDTO): Promise<OrderLineItem>;
  removeLineItem(itemId: string): Promise<void>;

  // Trackable units management
  addTrackableUnit(orderId: string, unit: CreateTrackableUnitDTO): Promise<TrackableUnit>;
  updateTrackableUnit(unitId: string, data: { identifier?: string; notes?: string; barcode?: string }): Promise<TrackableUnit>;
  removeTrackableUnit(unitId: string): Promise<void>;
  addLineItemToUnit(unitId: string, item: CreateOrderLineItemDTO): Promise<OrderLineItem>;
  moveLineItemToUnit(itemId: string, targetUnitId: string): Promise<OrderLineItem>;
  generateBarcode(unitId: string): Promise<TrackableUnit>;

  // Order-to-Shipment conversion
  convertToShipment(orderId: string): Promise<{ shipmentId: string }>;

  // Batch operations
  mergeUnits(sourceUnitId: string, targetUnitId: string): Promise<void>;
  splitUnit(unitId: string, itemIdsToMove: string[], newUnitData: { identifier: string; notes?: string }): Promise<TrackableUnit>;
}

export class OrdersRepository implements IOrdersRepository {
  constructor(private prisma: PrismaClient) {}

  async all(): Promise<OrderWithRelations[]> {
    return this.prisma.order.findMany({
      where: { archived: false },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            contactEmail: true
          }
        },
        origin: {
          select: {
            id: true,
            name: true,
            address1: true,
            city: true,
            state: true,
            country: true
          }
        },
        destination: {
          select: {
            id: true,
            name: true,
            address1: true,
            city: true,
            state: true,
            country: true
          }
        },
        trackableUnits: {
          include: {
            lineItems: true
          },
          orderBy: { sequenceNumber: 'asc' }
        },
        lineItems: {
          where: {
            trackableUnitId: null // Only get legacy line items not in trackable units
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    }) as Promise<OrderWithRelations[]>;
  }

  async findByCustomerId(customerId: string, options?: { status?: string; limit?: number; offset?: number }): Promise<OrderWithRelations[]> {
    const where: any = { customerId, archived: false };
    if (options?.status) {
      where.status = options.status;
    }
    return this.prisma.order.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            contactEmail: true
          }
        },
        origin: {
          select: {
            id: true,
            name: true,
            address1: true,
            city: true,
            state: true,
            country: true
          }
        },
        destination: {
          select: {
            id: true,
            name: true,
            address1: true,
            city: true,
            state: true,
            country: true
          }
        },
        trackableUnits: {
          include: {
            lineItems: true
          },
          orderBy: { sequenceNumber: 'asc' }
        },
        lineItems: {
          where: {
            trackableUnitId: null
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 50,
      skip: options?.offset || 0
    }) as Promise<OrderWithRelations[]>;
  }

  async findById(id: string): Promise<OrderWithRelations | null> {
    return this.prisma.order.findFirst({
      where: { id, archived: false },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            contactEmail: true
          }
        },
        origin: {
          select: {
            id: true,
            name: true,
            address1: true,
            city: true,
            state: true,
            country: true
          }
        },
        destination: {
          select: {
            id: true,
            name: true,
            address1: true,
            city: true,
            state: true,
            country: true
          }
        },
        trackableUnits: {
          include: {
            lineItems: true
          },
          orderBy: { sequenceNumber: 'asc' }
        },
        lineItems: {
          where: {
            trackableUnitId: null
          }
        }
      }
    }) as Promise<OrderWithRelations | null>;
  }

  async findByOrderNumber(orderNumber: string): Promise<OrderWithRelations | null> {
    return this.prisma.order.findFirst({
      where: { orderNumber, archived: false },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            contactEmail: true
          }
        },
        origin: {
          select: {
            id: true,
            name: true,
            address1: true,
            city: true,
            state: true,
            country: true
          }
        },
        destination: {
          select: {
            id: true,
            name: true,
            address1: true,
            city: true,
            state: true,
            country: true
          }
        },
        trackableUnits: {
          include: {
            lineItems: true
          },
          orderBy: { sequenceNumber: 'asc' }
        },
        lineItems: {
          where: {
            trackableUnitId: null
          }
        }
      }
    }) as Promise<OrderWithRelations | null>;
  }

  async create(data: CreateOrderDTO): Promise<OrderWithRelations> {
    const { lineItems, trackableUnits, ...orderData } = data;

    // Prepare trackable units with sequence numbers
    const trackableUnitsData = trackableUnits?.map((unit, index) => ({
      identifier: unit.identifier,
      unitType: unit.unitType,
      customTypeName: unit.customTypeName,
      barcode: unit.barcode,
      notes: unit.notes,
      sequenceNumber: index + 1,
      lineItems: {
        create: unit.lineItems
      }
    }));

    return (this.prisma.order.create({
      data: {
        ...orderData,
        // Create trackable units with their line items
        trackableUnits: trackableUnitsData ? {
          create: trackableUnitsData as any
        } : undefined,
        // Legacy line items (not in trackable units)
        lineItems: lineItems ? {
          create: lineItems as any
        } : undefined
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            contactEmail: true
          }
        },
        origin: {
          select: {
            id: true,
            name: true,
            address1: true,
            city: true,
            state: true,
            country: true
          }
        },
        destination: {
          select: {
            id: true,
            name: true,
            address1: true,
            city: true,
            state: true,
            country: true
          }
        },
        trackableUnits: {
          include: {
            lineItems: true
          },
          orderBy: { sequenceNumber: 'asc' }
        },
        lineItems: {
          where: {
            trackableUnitId: null
          }
        }
      }
    }) as Promise<OrderWithRelations>);
  }

  async update(id: string, data: UpdateOrderDTO): Promise<Order> {
    return this.prisma.order.update({
      where: { id },
      data
    });
  }

  async archive(id: string): Promise<Order> {
    return this.prisma.order.update({
      where: { id },
      data: {
        archived: true,
        archivedAt: new Date(),
        status: 'archived'
      }
    });
  }

  async validateLocation(
    id: string,
    locationType: 'origin' | 'destination',
    locationId: string
  ): Promise<Order> {
    const updateData: any = {};

    if (locationType === 'origin') {
      updateData.originId = locationId;
      updateData.originValidated = true;
      updateData.originData = null; // Clear the raw data once validated
    } else {
      updateData.destinationId = locationId;
      updateData.destinationValidated = true;
      updateData.destinationData = null; // Clear the raw data once validated
    }

    return this.prisma.order.update({
      where: { id },
      data: updateData
    });
  }

  async addLineItem(orderId: string, item: CreateOrderLineItemDTO): Promise<OrderLineItem> {
    return this.prisma.orderLineItem.create({
      data: {
        orderId,
        ...item
      }
    });
  }

  async removeLineItem(itemId: string): Promise<void> {
    await this.prisma.orderLineItem.delete({
      where: { id: itemId }
    });
  }

  async addTrackableUnit(orderId: string, unit: CreateTrackableUnitDTO): Promise<TrackableUnit> {
    // Get the next sequence number
    const existingUnits = await this.prisma.trackableUnit.findMany({
      where: { orderId },
      orderBy: { sequenceNumber: 'desc' },
      take: 1
    });

    const nextSequence = existingUnits.length > 0 ? existingUnits[0].sequenceNumber + 1 : 1;

    return this.prisma.trackableUnit.create({
      data: {
        orderId,
        identifier: unit.identifier,
        unitType: unit.unitType,
        customTypeName: unit.customTypeName,
        barcode: unit.barcode,
        notes: unit.notes,
        sequenceNumber: nextSequence,
        lineItems: {
          create: unit.lineItems as any
        }
      },
      include: {
        lineItems: true
      }
    });
  }

  async updateTrackableUnit(
    unitId: string,
    data: { identifier?: string; notes?: string; barcode?: string }
  ): Promise<TrackableUnit> {
    return this.prisma.trackableUnit.update({
      where: { id: unitId },
      data
    });
  }

  async removeTrackableUnit(unitId: string): Promise<void> {
    // Cascade delete will handle line items
    await this.prisma.trackableUnit.delete({
      where: { id: unitId }
    });
  }

  async addLineItemToUnit(unitId: string, item: CreateOrderLineItemDTO): Promise<OrderLineItem> {
    // Get the order ID from the unit
    const unit = await this.prisma.trackableUnit.findUnique({
      where: { id: unitId },
      select: { orderId: true }
    });

    if (!unit) {
      throw new Error('Trackable unit not found');
    }

    return this.prisma.orderLineItem.create({
      data: {
        orderId: unit.orderId,
        trackableUnitId: unitId,
        ...item
      }
    });
  }

  async moveLineItemToUnit(itemId: string, targetUnitId: string): Promise<OrderLineItem> {
    return this.prisma.orderLineItem.update({
      where: { id: itemId },
      data: { trackableUnitId: targetUnitId }
    });
  }

  async generateBarcode(unitId: string): Promise<TrackableUnit> {
    // Generate a unique barcode using unit ID and timestamp
    const timestamp = Date.now().toString(36).toUpperCase();
    const uniquePart = unitId.slice(0, 8).toUpperCase();
    const barcode = `TU-${uniquePart}-${timestamp}`;

    return this.prisma.trackableUnit.update({
      where: { id: unitId },
      data: { barcode }
    });
  }

  async convertToShipment(orderId: string): Promise<{ shipmentId: string }> {
    // Fetch the order with all relations
    const order = await this.findById(orderId);

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.status === 'converted') {
      throw new Error('Order has already been converted to a shipment');
    }

    if (!order.originId || !order.destinationId) {
      throw new Error('Order must have valid origin and destination locations before conversion');
    }

    // Collect all line items (from trackable units and legacy)
    const allItems: any[] = [];

    // Add trackable units structure
    order.trackableUnits.forEach(unit => {
      allItems.push({
        type: 'trackable_unit',
        unitId: unit.id,
        identifier: unit.identifier,
        unitType: unit.unitType,
        customTypeName: unit.customTypeName,
        barcode: unit.barcode,
        sequenceNumber: unit.sequenceNumber,
        items: unit.lineItems.map(item => ({
          sku: item.sku,
          description: item.description,
          quantity: item.quantity,
          weight: item.weight,
          weightUnit: item.weightUnit,
          dimensions: item.length && item.width && item.height ? {
            length: item.length,
            width: item.width,
            height: item.height,
            unit: item.dimUnit
          } : undefined,
          hazmat: item.hazmat,
          temperature: item.temperature
        }))
      });
    });

    // Add legacy line items
    if (order.lineItems.length > 0) {
      allItems.push({
        type: 'legacy_items',
        items: order.lineItems.map(item => ({
          sku: item.sku,
          description: item.description,
          quantity: item.quantity,
          weight: item.weight,
          weightUnit: item.weightUnit,
          dimensions: item.length && item.width && item.height ? {
            length: item.length,
            width: item.width,
            height: item.height,
            unit: item.dimUnit
          } : undefined,
          hazmat: item.hazmat,
          temperature: item.temperature
        }))
      });
    }

    // Generate shipment reference from order number
    const shipmentReference = `SH-${order.orderNumber}`;

    // Create shipment and link order in a transaction
    const result = await this.prisma.$transaction(async (tx: any) => {
      // Create the shipment
      const shipment = await tx.shipment.create({
        data: {
          reference: shipmentReference,
          customerId: order.customer.id,
          originId: order.originId!,
          destinationId: order.destinationId!,
          pickupDate: (order as any).requestedPickupDate ? new Date((order as any).requestedPickupDate) : undefined,
          deliveryDate: (order as any).requestedDeliveryDate ? new Date((order as any).requestedDeliveryDate) : undefined,
          items: allItems,
          status: 'draft'
        }
      });

      // Link order to shipment
      await tx.orderShipment.create({
        data: {
          orderId: (order as any).id,
          shipmentId: shipment.id
        }
      });

      // Create delivery stop for destination
      const deliveryStop = await tx.shipmentStop.create({
        data: {
          shipmentId: shipment.id,
          locationId: order.destinationId!,
          sequenceNumber: 1,
          stopType: 'delivery',
          status: 'pending'
        }
      });

      // Update order status and delivery status
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'converted',
          deliveryStatus: 'assigned',
          deliveryStopId: deliveryStop.id
        }
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          entityType: 'order',
          entityId: orderId,
          orderId,
          action: 'delivery_status_changed',
          description: 'Order converted to shipment, delivery status set to assigned',
          changes: {
            before: { deliveryStatus: 'unassigned', status: order.status },
            after: { deliveryStatus: 'assigned', status: 'converted' }
          },
        }
      });

      return { shipmentId: shipment.id };
    });

    return result;
  }

  async mergeUnits(sourceUnitId: string, targetUnitId: string): Promise<void> {
    // Move all line items from source unit to target unit
    await this.prisma.orderLineItem.updateMany({
      where: { trackableUnitId: sourceUnitId },
      data: { trackableUnitId: targetUnitId }
    });

    // Delete the source unit (now empty)
    await this.prisma.trackableUnit.delete({
      where: { id: sourceUnitId }
    });
  }

  async splitUnit(
    unitId: string,
    itemIdsToMove: string[],
    newUnitData: { identifier: string; notes?: string }
  ): Promise<TrackableUnit> {
    // Get the original unit to copy its properties
    const originalUnit = await this.prisma.trackableUnit.findUnique({
      where: { id: unitId },
      include: { order: true }
    });

    if (!originalUnit) {
      throw new Error('Unit not found');
    }

    // Get the next sequence number for the new unit
    const existingUnits = await this.prisma.trackableUnit.findMany({
      where: { orderId: originalUnit.orderId },
      orderBy: { sequenceNumber: 'desc' },
      take: 1
    });

    const nextSequence = existingUnits.length > 0 ? existingUnits[0].sequenceNumber + 1 : 1;

    // Create new unit with the same type as the original
    const newUnit = await this.prisma.trackableUnit.create({
      data: {
        orderId: originalUnit.orderId,
        identifier: newUnitData.identifier,
        unitType: originalUnit.unitType,
        customTypeName: originalUnit.customTypeName,
        notes: newUnitData.notes,
        sequenceNumber: nextSequence
      },
      include: {
        lineItems: true
      }
    });

    // Move specified items to the new unit
    if (itemIdsToMove.length > 0) {
      await this.prisma.orderLineItem.updateMany({
        where: {
          id: { in: itemIdsToMove }
        },
        data: {
          trackableUnitId: newUnit.id
        }
      });
    }

    return newUnit;
  }
}
