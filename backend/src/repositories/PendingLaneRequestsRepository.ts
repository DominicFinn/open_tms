import { PrismaClient } from '@prisma/client';

export interface PendingLaneRequestWithRelations {
  id: string;
  orderId: string;
  originId: string;
  destinationId: string;
  serviceLevel: string;
  requiresTemperatureControl: boolean;
  requiresHazmat: boolean;
  status: string;
  resolvedAt: Date | null;
  resolvedById: string | null;
  createdLaneId: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  order: {
    id: string;
    orderNumber: string;
    customer: {
      id: string;
      name: string;
    };
  };
  origin: {
    id: string;
    name: string;
    city: string;
    state?: string;
    country: string;
  };
  destination: {
    id: string;
    name: string;
    city: string;
    state?: string;
    country: string;
  };
}

export interface IPendingLaneRequestsRepository {
  all(orgId: string): Promise<PendingLaneRequestWithRelations[]>;
  findById(id: string, orgId: string): Promise<PendingLaneRequestWithRelations | null>;
  findByStatus(status: string, orgId: string): Promise<PendingLaneRequestWithRelations[]>;
  approve(id: string, orgId: string, resolvedById: string, notes?: string): Promise<PendingLaneRequestWithRelations>;
  reject(id: string, orgId: string, resolvedById: string, notes?: string): Promise<PendingLaneRequestWithRelations>;
  markAsLaneCreated(id: string, orgId: string, laneId: string): Promise<PendingLaneRequestWithRelations>;
}

export class PendingLaneRequestsRepository implements IPendingLaneRequestsRepository {
  constructor(private prisma: PrismaClient) {}

  async all(orgId: string): Promise<PendingLaneRequestWithRelations[]> {
    return (this.prisma.pendingLaneRequest.findMany({
      where: { order: { orgId } },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            customer: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        origin: {
          select: {
            id: true,
            name: true,
            city: true,
            state: true,
            country: true
          }
        },
        destination: {
          select: {
            id: true,
            name: true,
            city: true,
            state: true,
            country: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    }) as Promise<PendingLaneRequestWithRelations[]>);
  }

  async findById(id: string, orgId: string): Promise<PendingLaneRequestWithRelations | null> {
    return (this.prisma.pendingLaneRequest.findUnique({
      where: { id, order: { orgId } },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            customer: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        origin: {
          select: {
            id: true,
            name: true,
            city: true,
            state: true,
            country: true
          }
        },
        destination: {
          select: {
            id: true,
            name: true,
            city: true,
            state: true,
            country: true
          }
        }
      }
    }) as Promise<PendingLaneRequestWithRelations | null>);
  }

  async findByStatus(status: string, orgId: string): Promise<PendingLaneRequestWithRelations[]> {
    return (this.prisma.pendingLaneRequest.findMany({
      where: { status, order: { orgId } },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            customer: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        origin: {
          select: {
            id: true,
            name: true,
            city: true,
            state: true,
            country: true
          }
        },
        destination: {
          select: {
            id: true,
            name: true,
            city: true,
            state: true,
            country: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    }) as Promise<PendingLaneRequestWithRelations[]>);
  }

  async approve(id: string, orgId: string, resolvedById: string, notes?: string): Promise<PendingLaneRequestWithRelations> {
    const updated = await this.prisma.pendingLaneRequest.update({
      where: { id, order: { orgId } },
      data: {
        status: 'approved',
        resolvedAt: new Date(),
        resolvedById,
        notes: notes || undefined
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            customer: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        origin: {
          select: {
            id: true,
            name: true,
            city: true,
            state: true,
            country: true
          }
        },
        destination: {
          select: {
            id: true,
            name: true,
            city: true,
            state: true,
            country: true
          }
        }
      }
    });

    return updated as PendingLaneRequestWithRelations;
  }

  async reject(id: string, orgId: string, resolvedById: string, notes?: string): Promise<PendingLaneRequestWithRelations> {
    const updated = await this.prisma.pendingLaneRequest.update({
      where: { id, order: { orgId } },
      data: {
        status: 'rejected',
        resolvedAt: new Date(),
        resolvedById,
        notes: notes || undefined
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            customer: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        origin: {
          select: {
            id: true,
            name: true,
            city: true,
            state: true,
            country: true
          }
        },
        destination: {
          select: {
            id: true,
            name: true,
            city: true,
            state: true,
            country: true
          }
        }
      }
    });

    return updated as PendingLaneRequestWithRelations;
  }

  async markAsLaneCreated(id: string, orgId: string, laneId: string): Promise<PendingLaneRequestWithRelations> {
    const updated = await this.prisma.pendingLaneRequest.update({
      where: { id, order: { orgId } },
      data: {
        status: 'lane_created',
        createdLaneId: laneId,
        resolvedAt: new Date()
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            customer: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        origin: {
          select: {
            id: true,
            name: true,
            city: true,
            state: true,
            country: true
          }
        },
        destination: {
          select: {
            id: true,
            name: true,
            city: true,
            state: true,
            country: true
          }
        }
      }
    });

    return updated as PendingLaneRequestWithRelations;
  }
}
