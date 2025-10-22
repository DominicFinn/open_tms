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
  all(): Promise<PendingLaneRequestWithRelations[]>;
  findById(id: string): Promise<PendingLaneRequestWithRelations | null>;
  findByStatus(status: string): Promise<PendingLaneRequestWithRelations[]>;
  approve(id: string, resolvedById: string, notes?: string): Promise<PendingLaneRequestWithRelations>;
  reject(id: string, resolvedById: string, notes?: string): Promise<PendingLaneRequestWithRelations>;
  markAsLaneCreated(id: string, laneId: string): Promise<PendingLaneRequestWithRelations>;
}

export class PendingLaneRequestsRepository implements IPendingLaneRequestsRepository {
  constructor(private prisma: PrismaClient) {}

  async all(): Promise<PendingLaneRequestWithRelations[]> {
    return this.prisma.pendingLaneRequest.findMany({
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
    }) as PendingLaneRequestWithRelations[];
  }

  async findById(id: string): Promise<PendingLaneRequestWithRelations | null> {
    return this.prisma.pendingLaneRequest.findUnique({
      where: { id },
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
    }) as PendingLaneRequestWithRelations | null;
  }

  async findByStatus(status: string): Promise<PendingLaneRequestWithRelations[]> {
    return this.prisma.pendingLaneRequest.findMany({
      where: { status },
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
    }) as PendingLaneRequestWithRelations[];
  }

  async approve(id: string, resolvedById: string, notes?: string): Promise<PendingLaneRequestWithRelations> {
    const updated = await this.prisma.pendingLaneRequest.update({
      where: { id },
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

  async reject(id: string, resolvedById: string, notes?: string): Promise<PendingLaneRequestWithRelations> {
    const updated = await this.prisma.pendingLaneRequest.update({
      where: { id },
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

  async markAsLaneCreated(id: string, laneId: string): Promise<PendingLaneRequestWithRelations> {
    const updated = await this.prisma.pendingLaneRequest.update({
      where: { id },
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
