import { PrismaClient, Order, OrderLineItem } from '@prisma/client';

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

  // Line items
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
  lineItems: OrderLineItem[];
}

export interface IOrdersRepository {
  all(): Promise<OrderWithRelations[]>;
  findById(id: string): Promise<OrderWithRelations | null>;
  findByOrderNumber(orderNumber: string): Promise<OrderWithRelations | null>;
  create(data: CreateOrderDTO): Promise<OrderWithRelations>;
  update(id: string, data: UpdateOrderDTO): Promise<Order>;
  archive(id: string): Promise<Order>;
  validateLocation(id: string, locationType: 'origin' | 'destination', locationId: string): Promise<Order>;
  addLineItem(orderId: string, item: CreateOrderLineItemDTO): Promise<OrderLineItem>;
  removeLineItem(itemId: string): Promise<void>;
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
        lineItems: true
      },
      orderBy: { createdAt: 'desc' }
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
        lineItems: true
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
        lineItems: true
      }
    }) as Promise<OrderWithRelations | null>;
  }

  async create(data: CreateOrderDTO): Promise<OrderWithRelations> {
    const { lineItems, ...orderData } = data;

    return this.prisma.order.create({
      data: {
        ...orderData,
        lineItems: lineItems ? {
          create: lineItems
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
        lineItems: true
      }
    }) as Promise<OrderWithRelations>;
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
}
