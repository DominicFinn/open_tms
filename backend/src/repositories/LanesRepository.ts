import { PrismaClient, Lane, Prisma, CustomerLane, LaneCarrier } from '@prisma/client';

export type LaneWithRelations = Prisma.LaneGetPayload<{
  include: {
    origin: true;
    destination: true;
    stops: {
      include: { location: true };
    };
    customerLanes: {
      include: { customer: true };
    };
    laneCarriers: {
      include: { carrier: true };
    };
  };
}>;

export type LaneWithBasicRelations = Prisma.LaneGetPayload<{
  include: {
    origin: true;
    destination: true;
    stops: {
      include: { location: true };
    };
  };
}>;

export interface CreateLaneDTO {
  /** Multi-tenancy scope. Optional during phase-3 transition. */
  orgId?: string | null;
  name: string;
  originId: string;
  destinationId: string;
  distance?: number;
  notes?: string;
}

export interface CreateLaneStopDTO {
  laneId: string;
  locationId: string;
  order: number;
  notes?: string;
}

export interface UpdateLaneDTO {
  originId?: string;
  destinationId?: string;
  distance?: number;
  notes?: string;
  status?: string;
  name?: string;
}

export interface CreateLaneCarrierDTO {
  laneId: string;
  carrierId: string;
  price?: number;
  currency?: string;
  serviceLevel?: string;
  notes?: string;
}

export interface UpdateLaneCarrierDTO {
  price?: number;
  currency?: string;
  serviceLevel?: string;
  notes?: string;
}

export interface ILanesRepository {
  all(orgId?: string | null): Promise<LaneWithRelations[]>;
  findById(id: string, orgId?: string | null): Promise<LaneWithRelations | null>;
  findByIdSimple(id: string, orgId?: string | null): Promise<Lane | null>;
  findByIdWithOriginDestination(id: string, orgId?: string | null): Promise<any>;
  createWithTransaction(laneData: CreateLaneDTO, stops: CreateLaneStopDTO[]): Promise<LaneWithBasicRelations>;
  updateWithTransaction(id: string, laneData: UpdateLaneDTO, stops?: CreateLaneStopDTO[]): Promise<LaneWithRelations>;
  archive(id: string): Promise<Lane>;
  createCustomerLane(laneId: string, customerId: string): Promise<any>;
  findCustomerLane(laneId: string, customerId: string): Promise<CustomerLane | null>;
  deleteCustomerLane(customerLaneId: string): Promise<void>;
  createLaneCarrier(data: CreateLaneCarrierDTO): Promise<any>;
  findLaneCarrier(laneId: string, carrierId: string): Promise<LaneCarrier | null>;
  updateLaneCarrier(laneCarrierId: string, data: UpdateLaneCarrierDTO): Promise<any>;
  deleteLaneCarrier(laneCarrierId: string): Promise<void>;
  createMany(data: CreateLaneDTO[]): Promise<void>;
  count(): Promise<number>;
}

export class LanesRepository implements ILanesRepository {
  constructor(private prisma: PrismaClient) {}

  async all(orgId?: string | null): Promise<LaneWithRelations[]> {
    const where: any = { archived: false };
    if (orgId) where.orgId = orgId;
    return this.prisma.lane.findMany({
      where,
      include: {
        origin: true,
        destination: true,
        stops: {
          include: { location: true },
          orderBy: { order: 'asc' }
        },
        customerLanes: {
          include: { customer: true }
        },
        laneCarriers: {
          include: { carrier: true }
        }
      },
      orderBy: { name: 'asc' }
    });
  }

  async findById(id: string, orgId?: string | null): Promise<LaneWithRelations | null> {
    const where: any = { id, archived: false };
    if (orgId) where.orgId = orgId;
    return this.prisma.lane.findFirst({
      where,
      include: {
        origin: true,
        destination: true,
        stops: {
          include: { location: true },
          orderBy: { order: 'asc' }
        },
        customerLanes: {
          include: { customer: true }
        },
        laneCarriers: {
          include: { carrier: true }
        }
      }
    });
  }

  async findByIdSimple(id: string, orgId?: string | null): Promise<Lane | null> {
    const where: any = { id, archived: false };
    if (orgId) where.orgId = orgId;
    return this.prisma.lane.findFirst({ where });
  }

  async findByIdWithOriginDestination(id: string, orgId?: string | null) {
    const where: any = { id, archived: false };
    if (orgId) where.orgId = orgId;
    return this.prisma.lane.findFirst({
      where,
      include: { origin: true, destination: true }
    });
  }

  async createWithTransaction(
    laneData: CreateLaneDTO,
    stops: CreateLaneStopDTO[]
  ): Promise<LaneWithBasicRelations> {
    return this.prisma.$transaction(async (tx: any) => {
      // Create the lane. orgId stays optional in the DTO during phase-3
      // transition; the NOT NULL migration will enforce it at the DB.
      const lane = await tx.lane.create({
        data: { ...laneData, orgId: laneData.orgId ?? null }
      });

      // Create stops if any
      if (stops.length > 0) {
        await tx.laneStop.createMany({
          data: stops.map(stop => ({
            ...stop,
            laneId: lane.id
          }))
        });
      }

      // Return the complete lane with relationships
      return tx.lane.findUnique({
        where: { id: lane.id },
        include: {
          origin: true,
          destination: true,
          stops: {
            include: { location: true },
            orderBy: { order: 'asc' }
          }
        }
      }) as Promise<LaneWithBasicRelations>;
    });
  }

  async updateWithTransaction(
    id: string,
    laneData: UpdateLaneDTO,
    stops?: CreateLaneStopDTO[]
  ): Promise<LaneWithRelations> {
    return this.prisma.$transaction(async (tx: any) => {
      // Remove undefined values
      const cleanedData = Object.fromEntries(
        Object.entries(laneData).filter(([_, v]) => v !== undefined)
      );

      // Update the lane
      await tx.lane.update({
        where: { id },
        data: cleanedData
      });

      // Update stops if provided
      if (stops !== undefined) {
        // Delete existing stops
        await tx.laneStop.deleteMany({
          where: { laneId: id }
        });

        // Create new stops if any
        if (stops.length > 0) {
          await tx.laneStop.createMany({
            data: stops.map(stop => ({
              ...stop,
              laneId: id
            }))
          });
        }
      }

      // Return the complete updated lane
      return tx.lane.findUnique({
        where: { id },
        include: {
          origin: true,
          destination: true,
          stops: {
            include: { location: true },
            orderBy: { order: 'asc' }
          },
          customerLanes: {
            include: { customer: true }
          },
          laneCarriers: {
            include: { carrier: true }
          }
        }
      }) as Promise<LaneWithRelations>;
    });
  }

  async archive(id: string): Promise<Lane> {
    return this.prisma.lane.update({
      where: { id },
      data: {
        archived: true,
        archivedAt: new Date()
      }
    });
  }

  async createCustomerLane(laneId: string, customerId: string) {
    return this.prisma.customerLane.create({
      data: { laneId, customerId },
      include: {
        customer: true,
        lane: {
          include: { origin: true, destination: true }
        }
      }
    });
  }

  async findCustomerLane(laneId: string, customerId: string): Promise<CustomerLane | null> {
    return this.prisma.customerLane.findFirst({
      where: { laneId, customerId }
    });
  }

  async deleteCustomerLane(customerLaneId: string): Promise<void> {
    await this.prisma.customerLane.delete({
      where: { id: customerLaneId }
    });
  }

  async createLaneCarrier(data: CreateLaneCarrierDTO) {
    return this.prisma.laneCarrier.create({
      data: {
        ...data,
        currency: data.currency || 'USD'
      },
      include: {
        carrier: true,
        lane: {
          include: { origin: true, destination: true }
        }
      }
    });
  }

  async findLaneCarrier(laneId: string, carrierId: string): Promise<LaneCarrier | null> {
    return this.prisma.laneCarrier.findFirst({
      where: { laneId, carrierId }
    });
  }

  async updateLaneCarrier(laneCarrierId: string, data: UpdateLaneCarrierDTO) {
    return this.prisma.laneCarrier.update({
      where: { id: laneCarrierId },
      data,
      include: {
        carrier: true,
        lane: {
          include: { origin: true, destination: true }
        }
      }
    });
  }

  async deleteLaneCarrier(laneCarrierId: string): Promise<void> {
    await this.prisma.laneCarrier.delete({
      where: { id: laneCarrierId }
    });
  }

  async createMany(data: CreateLaneDTO[]): Promise<void> {
    await this.prisma.lane.createMany({
      data: data.map(d => ({ ...d, orgId: d.orgId ?? null })) as any
    });
  }

  async count(): Promise<number> {
    return this.prisma.lane.count();
  }
}
