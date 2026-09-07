/**
 * WMS dashboard counts (#220).
 *
 * Module: wms. These twelve counts sat inline in routes/wmsDashboard.ts filtered on a
 * client-supplied locationId alone, so the dashboard reported another tenant's warehouse to
 * anyone who supplied their location id. Every count here carries orgId.
 */

import { PrismaClient } from '@prisma/client';

export interface WmsDashboardCounts {
  zones: number;
  bins: number;
  activeBins: number;
  totalSkus: number;
  receivingPending: number;
  receivingInProgress: number;
  putawayTasks: number;
  pickPending: number;
  pickInProgress: number;
  packPending: number;
  packInProgress: number;
  stagedCount: number;
}

export interface IWmsDashboardRepository {
  countsForLocation(orgId: string, locationId: string): Promise<WmsDashboardCounts>;
}

export class WmsDashboardRepository implements IWmsDashboardRepository {
  constructor(private prisma: PrismaClient) {}

  async countsForLocation(orgId: string, locationId: string): Promise<WmsDashboardCounts> {
    const scope = { orgId, locationId };

    const [
      zones, bins, activeBins, skus,
      receivingPending, receivingInProgress,
      putawayTasks,
      pickPending, pickInProgress,
      packPending, packInProgress,
      stagedCount,
    ] = await Promise.all([
      this.prisma.warehouseZone.count({ where: { ...scope, active: true } }),
      this.prisma.warehouseBin.count({ where: scope }),
      this.prisma.warehouseBin.count({ where: { ...scope, active: true } }),
      this.prisma.inventoryRecord
        .groupBy({ by: ['sku'], where: { ...scope, quantityOnHand: { gt: 0 } } })
        .then(rows => rows.length),
      this.prisma.receivingTask.count({ where: { ...scope, status: 'pending' } }),
      this.prisma.receivingTask.count({ where: { ...scope, status: 'in_progress' } }),
      this.prisma.putawayTask.count({ where: { ...scope, status: { in: ['pending', 'assigned'] } } }),
      this.prisma.pickTask.count({ where: { ...scope, status: 'pending' } }),
      this.prisma.pickTask.count({ where: { ...scope, status: { in: ['assigned', 'in_progress'] } } }),
      this.prisma.packTask.count({ where: { ...scope, status: 'pending' } }),
      this.prisma.packTask.count({ where: { ...scope, status: 'in_progress' } }),
      this.prisma.stagingAssignment.count({ where: { ...scope, status: 'staged' } }),
    ]);

    return {
      zones, bins, activeBins, totalSkus: skus,
      receivingPending, receivingInProgress,
      putawayTasks,
      pickPending, pickInProgress,
      packPending, packInProgress,
      stagedCount,
    };
  }
}
