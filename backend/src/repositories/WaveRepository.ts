/**
 * Wave and pick task reads (#220).
 *
 * Module: wms. These queries used to sit inline in routes/waves.ts filtered only by a
 * client-supplied locationId, or by bare id. Every method here takes orgId first.
 */

import { PrismaClient, PickTask, Wave } from '@prisma/client';
import { WarehouseScope, scopedWhere } from './warehouseScope.js';

// Carried over from the inline queries these replaced. Neither list paginates yet; the ceiling
// stops one busy location returning an unbounded result.
const MAX_ROWS = 500;

export interface IWaveRepository {
  findWaves(orgId: string, scope: WarehouseScope, status?: string): Promise<Wave[]>;
  findWaveById(orgId: string, id: string): Promise<Wave | null>;
  findPickTasks(orgId: string, scope: WarehouseScope, filters?: { status?: string; waveId?: string }): Promise<PickTask[]>;
  findPickTaskById(orgId: string, id: string): Promise<PickTask | null>;
}

export class WaveRepository implements IWaveRepository {
  constructor(private prisma: PrismaClient) {}

  async findWaves(orgId: string, scope: WarehouseScope, status?: string): Promise<Wave[]> {
    const where: any = scopedWhere(orgId, scope);
    if (status) where.status = status;
    return this.prisma.wave.findMany({
      where,
      include: { _count: { select: { pickTasks: true, waveOrders: true } } },
      orderBy: { createdAt: 'desc' },
      take: MAX_ROWS,
    });
  }

  async findWaveById(orgId: string, id: string): Promise<Wave | null> {
    return this.prisma.wave.findFirst({
      where: { id, orgId },
      include: {
        waveOrders: { select: { orderId: true, priority: true } },
        pickTasks: {
          include: { _count: { select: { pickLines: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  async findPickTasks(
    orgId: string,
    scope: WarehouseScope,
    filters: { status?: string; waveId?: string } = {}
  ): Promise<PickTask[]> {
    const where: any = scopedWhere(orgId, scope);
    if (filters.status) where.status = filters.status;
    if (filters.waveId) where.waveId = filters.waveId;
    return this.prisma.pickTask.findMany({
      where,
      include: { wave: { select: { waveNumber: true } } },
      orderBy: { createdAt: 'desc' },
      take: MAX_ROWS,
    });
  }

  async findPickTaskById(orgId: string, id: string): Promise<PickTask | null> {
    return this.prisma.pickTask.findFirst({
      where: { id, orgId },
      include: {
        wave: { select: { waveNumber: true, pickStrategy: true } },
        pickLines: {
          include: { bin: { select: { label: true, zone: { select: { name: true } } } } },
          orderBy: { walkSequence: 'asc' },
        },
      },
    });
  }
}
