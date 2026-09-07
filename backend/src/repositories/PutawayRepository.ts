/**
 * Putaway reads (#220).
 *
 * Module: wms. These queries used to live inline in routes/putaway.ts filtered only by a
 * client-supplied locationId, which meant any authenticated caller could read another tenant's
 * putaway tasks and rules. Every method here takes orgId first and there is no unscoped variant.
 */

import { PrismaClient, PutawayRule, PutawayTask } from '@prisma/client';

const TASK_LIST_INCLUDE = {
  trackableUnit: { select: { id: true, identifier: true, unitType: true, barcode: true } },
  sourceBin: { select: { id: true, label: true } },
  targetBin: { select: { id: true, label: true } },
} as const;

const TASK_DETAIL_INCLUDE = {
  trackableUnit: {
    select: {
      id: true, identifier: true, unitType: true, barcode: true,
      lotNumber: true, expiryDate: true, qualityStatus: true,
      lineItems: { select: { sku: true, description: true, quantity: true, weight: true, temperature: true, hazmat: true } },
    },
  },
  sourceBin: { select: { id: true, label: true, binType: true } },
  targetBin: {
    select: {
      id: true, label: true, binType: true,
      temperatureZone: true, hazmatCertified: true,
      zone: { select: { name: true, zoneType: true, temperatureZone: true, hazmatCertified: true } },
    },
  },
  receivingTask: { select: { id: true, receivingType: true } },
} as const;

export interface IPutawayRepository {
  findTasksByLocation(orgId: string, locationId: string, status?: string): Promise<PutawayTask[]>;
  findTaskById(orgId: string, id: string): Promise<PutawayTask | null>;
  findRulesByLocation(orgId: string, locationId: string): Promise<PutawayRule[]>;
  findRuleById(orgId: string, id: string): Promise<PutawayRule | null>;
}

export class PutawayRepository implements IPutawayRepository {
  constructor(private prisma: PrismaClient) {}

  async findTasksByLocation(orgId: string, locationId: string, status?: string): Promise<PutawayTask[]> {
    const where: any = { orgId, locationId };
    if (status) where.status = status;
    return this.prisma.putawayTask.findMany({
      where,
      include: TASK_LIST_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findTaskById(orgId: string, id: string): Promise<PutawayTask | null> {
    return this.prisma.putawayTask.findFirst({
      where: { id, orgId },
      include: TASK_DETAIL_INCLUDE,
    });
  }

  async findRulesByLocation(orgId: string, locationId: string): Promise<PutawayRule[]> {
    return this.prisma.putawayRule.findMany({
      where: { orgId, locationId },
      orderBy: { priority: 'asc' },
    });
  }

  async findRuleById(orgId: string, id: string): Promise<PutawayRule | null> {
    return this.prisma.putawayRule.findFirst({ where: { id, orgId } });
  }
}
