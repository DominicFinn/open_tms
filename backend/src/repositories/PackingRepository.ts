/**
 * Pack task and staging reads (#220).
 *
 * Module: wms. Same story as WaveRepository: these filtered on a client-supplied locationId with
 * no tenant check. Every method takes orgId first.
 */

import { PrismaClient, PackLine, PackTask, StagingAssignment } from '@prisma/client';
import { WarehouseScope, scopedWhere } from './warehouseScope.js';

export interface PackTaskWithLines extends PackTask {
  packLines: Pick<PackLine, 'id' | 'status'>[];
  packStationBin: { label: string } | null;
}

export interface IPackingRepository {
  findPackTasks(orgId: string, scope: WarehouseScope, status?: string): Promise<PackTaskWithLines[]>;
  findPackTaskById(orgId: string, id: string): Promise<PackTask | null>;
  findStagingAssignments(orgId: string, scope: WarehouseScope, status?: string): Promise<StagingAssignment[]>;
}

export class PackingRepository implements IPackingRepository {
  constructor(private prisma: PrismaClient) {}

  async findPackTasks(orgId: string, scope: WarehouseScope, status?: string): Promise<PackTaskWithLines[]> {
    const where: any = scopedWhere(orgId, scope);
    if (status) where.status = status;
    return this.prisma.packTask.findMany({
      where,
      include: {
        packLines: { select: { id: true, status: true } },
        packStationBin: { select: { label: true } },
      },
      orderBy: { createdAt: 'desc' },
    }) as Promise<PackTaskWithLines[]>;
  }

  async findPackTaskById(orgId: string, id: string): Promise<PackTask | null> {
    return this.prisma.packTask.findFirst({
      where: { id, orgId },
      include: {
        packLines: { orderBy: { createdAt: 'asc' } },
        packStationBin: { select: { label: true } },
        pickTask: { select: { id: true, wave: { select: { waveNumber: true } } } },
      },
    });
  }

  async findStagingAssignments(orgId: string, scope: WarehouseScope, status?: string): Promise<StagingAssignment[]> {
    const where: any = scopedWhere(orgId, scope);
    if (status) where.status = status;
    return this.prisma.stagingAssignment.findMany({
      where,
      include: {
        stagingBin: { select: { label: true } },
        trackableUnit: { select: { identifier: true, unitType: true } },
      },
      orderBy: [{ loadSequence: 'asc' }, { createdAt: 'desc' }],
    });
  }
}
