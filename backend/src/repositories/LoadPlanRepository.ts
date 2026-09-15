/**
 * Load plan reads (#220).
 *
 * Module: wms. Same shape as CycleCountRepository. The list had no ceiling either, so one busy
 * location could return the whole table.
 */

import { LoadPlan, PrismaClient } from '@prisma/client';
import { WarehouseScope, scopedWhere } from './warehouseScope.js';

const MAX_ROWS = 500;

export interface ILoadPlanRepository {
  find(orgId: string, scope: WarehouseScope, status?: string): Promise<LoadPlan[]>;
  findById(orgId: string, id: string): Promise<LoadPlan | null>;
}

export class LoadPlanRepository implements ILoadPlanRepository {
  constructor(private prisma: PrismaClient) {}

  async find(orgId: string, scope: WarehouseScope, status?: string): Promise<LoadPlan[]> {
    const where: any = scopedWhere(orgId, scope);
    if (status) where.status = status;
    return this.prisma.loadPlan.findMany({
      where,
      include: { _count: { select: { lines: true } } },
      orderBy: { createdAt: 'desc' },
      take: MAX_ROWS,
    });
  }

  async findById(orgId: string, id: string): Promise<LoadPlan | null> {
    return this.prisma.loadPlan.findFirst({
      where: { id, orgId },
      include: { lines: { orderBy: { loadSequence: 'asc' } } },
    });
  }
}
