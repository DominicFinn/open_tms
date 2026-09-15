/**
 * Wave template reads (#220).
 *
 * Module: wms. Same shape as ReplenishmentRuleRepository: the list took a client-supplied
 * locationId and the update and delete handlers reached rows by bare id.
 */

import { PrismaClient, WaveTemplate } from '@prisma/client';
import { WarehouseScope, scopedWhere } from './warehouseScope.js';

const RECENT_WAVES = 10;

export interface IWaveTemplateRepository {
  find(orgId: string, scope: WarehouseScope): Promise<WaveTemplate[]>;
  findById(orgId: string, id: string): Promise<WaveTemplate | null>;
}

export class WaveTemplateRepository implements IWaveTemplateRepository {
  constructor(private prisma: PrismaClient) {}

  async find(orgId: string, scope: WarehouseScope): Promise<WaveTemplate[]> {
    return this.prisma.waveTemplate.findMany({
      where: scopedWhere(orgId, scope),
      include: { _count: { select: { waves: true } } },
      orderBy: { priority: 'asc' },
    });
  }

  async findById(orgId: string, id: string): Promise<WaveTemplate | null> {
    return this.prisma.waveTemplate.findFirst({
      where: { id, orgId },
      include: {
        waves: {
          orderBy: { createdAt: 'desc' },
          take: RECENT_WAVES,
          select: { id: true, waveNumber: true, status: true, orderCount: true, createdAt: true },
        },
      },
    });
  }
}
