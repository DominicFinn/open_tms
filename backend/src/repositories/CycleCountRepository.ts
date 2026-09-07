/**
 * Cycle count reads (#220).
 *
 * Module: wms. The list filtered on a client-supplied locationId and the detail fetch went by
 * bare id. Every method here takes orgId first.
 */

import { CycleCount, PrismaClient } from '@prisma/client';

const MAX_ROWS = 500;

export interface ICycleCountRepository {
  findByLocation(orgId: string, locationId: string, status?: string): Promise<CycleCount[]>;
  findById(orgId: string, id: string): Promise<CycleCount | null>;
}

export class CycleCountRepository implements ICycleCountRepository {
  constructor(private prisma: PrismaClient) {}

  async findByLocation(orgId: string, locationId: string, status?: string): Promise<CycleCount[]> {
    const where: any = { orgId, locationId };
    if (status) where.status = status;
    return this.prisma.cycleCount.findMany({
      where,
      include: { _count: { select: { lines: true } } },
      orderBy: { createdAt: 'desc' },
      take: MAX_ROWS,
    });
  }

  async findById(orgId: string, id: string): Promise<CycleCount | null> {
    return this.prisma.cycleCount.findFirst({
      where: { id, orgId },
      include: { lines: { orderBy: { createdAt: 'asc' } } },
    });
  }
}
