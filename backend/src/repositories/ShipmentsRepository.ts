import { PrismaClient, Shipment, Prisma } from '@prisma/client';

export type ShipmentWithRelations = Prisma.ShipmentGetPayload<{
  include: {
    customer: true;
    origin: true;
    destination: true;
    lane: {
      include: {
        origin: true;
        destination: true;
      };
    };
  };
}>;

export type ShipmentWithFullRelations = Prisma.ShipmentGetPayload<{
  include: {
    customer: true;
    origin: true;
    destination: true;
    lane: {
      include: {
        origin: true;
        destination: true;
        stops: {
          include: {
            location: true;
          };
        };
      };
    };
    loads: {
      include: {
        vehicle: true;
        driver: true;
      };
    };
  };
}>;

export interface CreateShipmentDTO {
  reference: string;
  customerId: string;
  laneId?: string;
  originId: string;
  destinationId: string;
  pickupDate?: string;
  deliveryDate?: string;
  items?: any[];
  status?: string;
}

export interface UpdateShipmentDTO {
  reference?: string;
  status?: string;
  pickupDate?: string;
  deliveryDate?: string;
  customerId?: string;
  laneId?: string;
  originId?: string;
  destinationId?: string;
  items?: any[];
}

export interface IShipmentsRepository {
  all(): Promise<ShipmentWithRelations[]>;
  findById(id: string): Promise<ShipmentWithFullRelations | null>;
  create(data: CreateShipmentDTO, includeLane?: boolean): Promise<ShipmentWithRelations>;
  update(id: string, data: UpdateShipmentDTO, includeLane?: boolean): Promise<ShipmentWithRelations>;
  archive(id: string): Promise<Shipment>;
  createMany(data: CreateShipmentDTO[]): Promise<void>;
  deleteMany(): Promise<void>;
}

export class ShipmentsRepository implements IShipmentsRepository {
  constructor(private prisma: PrismaClient) {}

  async all(): Promise<ShipmentWithRelations[]> {
    return this.prisma.shipment.findMany({
      where: { archived: false },
      include: {
        customer: true,
        origin: true,
        destination: true,
        lane: {
          include: {
            origin: true,
            destination: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findById(id: string): Promise<ShipmentWithFullRelations | null> {
    return this.prisma.shipment.findFirst({
      where: { id, archived: false },
      include: {
        customer: true,
        origin: true,
        destination: true,
        lane: {
          include: {
            origin: true,
            destination: true,
            stops: {
              include: {
                location: true
              },
              orderBy: {
                order: 'asc'
              }
            }
          }
        },
        loads: {
          include: {
            vehicle: true,
            driver: true
          }
        }
      }
    });
  }

  async create(data: CreateShipmentDTO, includeLane: boolean = false): Promise<ShipmentWithRelations> {
    return this.prisma.shipment.create({
      data: {
        ...data,
        status: data.status || 'draft'
      },
      include: {
        customer: true,
        origin: true,
        destination: true,
        lane: includeLane ? { include: { origin: true, destination: true } } : false
      }
    }) as Promise<ShipmentWithRelations>;
  }

  async update(id: string, data: UpdateShipmentDTO, includeLane: boolean = false): Promise<ShipmentWithRelations> {
    return this.prisma.shipment.update({
      where: { id },
      data,
      include: {
        customer: true,
        origin: true,
        destination: true,
        lane: includeLane ? { include: { origin: true, destination: true } } : false
      }
    }) as Promise<ShipmentWithRelations>;
  }

  async archive(id: string): Promise<Shipment> {
    return this.prisma.shipment.update({
      where: { id },
      data: {
        archived: true,
        archivedAt: new Date()
      }
    });
  }

  async createMany(data: CreateShipmentDTO[]): Promise<void> {
    await this.prisma.shipment.createMany({ data });
  }

  async deleteMany(): Promise<void> {
    await this.prisma.shipment.deleteMany();
  }
}
