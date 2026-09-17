import { PrismaClient, Prisma } from '@prisma/client';

export type ShipmentWithRelations = any;

export type ShipmentWithFullRelations = any;

export interface CreateShipmentDTO {
  /** Multi-tenancy scope. Required post phase-2 tightening. */
  orgId: string;
  reference: string;
  customerId: string;
  laneId?: string;
  originId: string;
  destinationId: string;
  pickupDate?: string;
  deliveryDate?: string;
  items?: any[];
  status?: string;
  proNumber?: string;
}

export interface UpdateShipmentDTO {
  reference?: string;
  status?: string;
  proNumber?: string;
  pickupDate?: string;
  deliveryDate?: string;
  customerId?: string;
  laneId?: string;
  originId?: string;
  destinationId?: string;
  items?: any[];
}

export interface IShipmentsRepository {
  all(orgId: string): Promise<ShipmentWithRelations[]>;
  findById(id: string, orgId: string): Promise<ShipmentWithFullRelations | null>;
  create(data: CreateShipmentDTO, includeLane?: boolean): Promise<ShipmentWithRelations>;
  update(id: string, orgId: string, data: UpdateShipmentDTO, includeLane?: boolean): Promise<ShipmentWithRelations>;
  archive(id: string, orgId: string): Promise<any>;
  createMany(data: CreateShipmentDTO[]): Promise<void>;
  deleteMany(orgId: string): Promise<void>;
}

export class ShipmentsRepository implements IShipmentsRepository {
  constructor(private prisma: PrismaClient) {}

  async all(orgId: string): Promise<ShipmentWithRelations[]> {
    const where: any = { archived: false, orgId };
    return this.prisma.shipment.findMany({
      where,
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

  async findById(id: string, orgId: string): Promise<ShipmentWithFullRelations | null> {
    const where: any = { id, archived: false, orgId };
    return this.prisma.shipment.findFirst({
      where,
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

  async update(id: string, orgId: string, data: UpdateShipmentDTO, includeLane: boolean = false): Promise<ShipmentWithRelations> {
    return this.prisma.shipment.update({
      where: { id, orgId },
      data,
      include: {
        customer: true,
        origin: true,
        destination: true,
        lane: includeLane ? { include: { origin: true, destination: true } } : false
      }
    }) as Promise<ShipmentWithRelations>;
  }

  async archive(id: string, orgId: string): Promise<any> {
    return this.prisma.shipment.update({
      where: { id, orgId },
      data: {
        archived: true,
        archivedAt: new Date()
      }
    });
  }

  async createMany(data: CreateShipmentDTO[]): Promise<void> {
    await this.prisma.shipment.createMany({ data });
  }

  async deleteMany(orgId: string): Promise<void> {
    await this.prisma.shipment.deleteMany({ where: { orgId } });
  }
}
