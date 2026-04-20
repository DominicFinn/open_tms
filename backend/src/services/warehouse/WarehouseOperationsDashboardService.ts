import { PrismaClient } from '@prisma/client';

export interface ThroughputKpis {
  today: { receipts: number; putaways: number; picks: number; packs: number; shipmentsDispatched: number };
  last7Days: { receipts: number; putaways: number; picks: number; packs: number; shipmentsDispatched: number };
}

export interface CycleTimeKpis {
  pickCycleMinutes: number | null;        // avg over last 30 days, completed picks
  dockToStockMinutes: number | null;      // avg receive-to-putaway over last 30 days
  orderToShipHours: number | null;        // avg order creation to first dispatch over last 30 days
  samples: { pickCycle: number; dockToStock: number; orderToShip: number };
}

export interface QualityKpis {
  pickAccuracyPercent: number | null;     // 100 × (completed - short_pick) / completed over last 30 days
  packAuditPassRatePercent: number | null;// pass / total over last 30 days
  inventoryAccuracyPercent: number | null;// based on recent cycle counts
  pickAccuracySamples: number;
  packAuditSamples: number;
  cycleCountSamples: number;
}

export interface LiveWorkKpis {
  pendingPickTasks: number;
  pendingPutawayTasks: number;
  pendingPackTasks: number;
  activeWaves: number;
  receivingInProgress: number;
}

export interface ExceptionKpis {
  openIssues: number;
  criticalIssues: number;
  cutoffAtRisk: { critical: number; warning: number };
  pendingReturns: number;
  packAuditFailuresOpen: number;
}

export interface CapacityKpis {
  totalBins: number;
  binsWithInventory: number;
  utilizationPercent: number | null;
}

export interface DashboardPayload {
  generatedAt: string;
  throughput: ThroughputKpis;
  cycleTimes: CycleTimeKpis;
  quality: QualityKpis;
  liveWork: LiveWorkKpis;
  exceptions: ExceptionKpis;
  capacity: CapacityKpis;
}

export class WarehouseOperationsDashboardService {
  constructor(private prisma: PrismaClient) {}

  async buildSnapshot(orgId: string, now: Date = new Date()): Promise<DashboardPayload> {
    const [throughput, cycleTimes, quality, liveWork, exceptions, capacity] = await Promise.all([
      this.buildThroughput(orgId, now),
      this.buildCycleTimes(orgId, now),
      this.buildQuality(orgId, now),
      this.buildLiveWork(orgId),
      this.buildExceptions(orgId),
      this.buildCapacity(orgId),
    ]);

    return {
      generatedAt: now.toISOString(),
      throughput,
      cycleTimes,
      quality,
      liveWork,
      exceptions,
      capacity,
    };
  }

  private async buildThroughput(orgId: string, now: Date): Promise<ThroughputKpis> {
    const startOfToday = new Date(now);
    startOfToday.setUTCHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);

    const countCompleted = (since: Date) => Promise.all([
      this.prisma.receivingTask.count({ where: { orgId, status: 'completed', updatedAt: { gte: since } } }),
      this.prisma.putawayTask.count({ where: { orgId, status: 'completed', updatedAt: { gte: since } } }),
      this.prisma.pickTask.count({ where: { orgId, status: 'completed', completedAt: { gte: since } } }),
      this.prisma.packTask.count({ where: { orgId, status: 'completed', updatedAt: { gte: since } } }),
      this.prisma.shipment.count({ where: { status: { in: ['in_transit', 'delivered'] }, updatedAt: { gte: since } } }),
    ]);

    const [r1, p1, pick1, pack1, ship1] = await countCompleted(startOfToday);
    const [r7, p7, pick7, pack7, ship7] = await countCompleted(sevenDaysAgo);

    return {
      today: { receipts: r1, putaways: p1, picks: pick1, packs: pack1, shipmentsDispatched: ship1 },
      last7Days: { receipts: r7, putaways: p7, picks: pick7, packs: pack7, shipmentsDispatched: ship7 },
    };
  }

  private async buildCycleTimes(orgId: string, now: Date): Promise<CycleTimeKpis> {
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000);

    // Pick cycle: avg completedAt - startedAt on completed picks
    const picks = await this.prisma.pickTask.findMany({
      where: { orgId, status: 'completed', completedAt: { gte: thirtyDaysAgo }, startedAt: { not: null } },
      select: { startedAt: true, completedAt: true },
      take: 1000,
    });
    const pickCycleMinutes = avgMinutes(picks.map(p => p.completedAt!.getTime() - p.startedAt!.getTime()));

    // Dock-to-stock: avg completed putaway.updatedAt - related receivingTask.createdAt
    const putaways = await this.prisma.putawayTask.findMany({
      where: { orgId, status: 'completed', updatedAt: { gte: thirtyDaysAgo }, receivingTaskId: { not: null } },
      select: { updatedAt: true, receivingTask: { select: { createdAt: true } } },
      take: 1000,
    });
    const dockToStockMinutes = avgMinutes(
      putaways
        .filter(p => p.receivingTask)
        .map(p => p.updatedAt.getTime() - p.receivingTask!.createdAt.getTime())
    );

    // Order to ship: Order.createdAt vs earliest shipment dispatchedAt/updatedAt
    // Simple v1: sample shipments dispatched in window, join back to order created time via OrderShipment
    const recentDispatched = await this.prisma.shipment.findMany({
      where: {
        status: { in: ['in_transit', 'delivered'] },
        updatedAt: { gte: thirtyDaysAgo },
      },
      select: {
        updatedAt: true,
        orderShipments: { select: { order: { select: { createdAt: true } } } },
      },
      take: 500,
    });
    const orderToShipMs: number[] = [];
    for (const s of recentDispatched) {
      for (const os of s.orderShipments) {
        if (os.order) orderToShipMs.push(s.updatedAt.getTime() - os.order.createdAt.getTime());
      }
    }
    const orderToShipHours = orderToShipMs.length > 0
      ? Math.round((orderToShipMs.reduce((a, b) => a + b, 0) / orderToShipMs.length / 3_600_000) * 10) / 10
      : null;

    return {
      pickCycleMinutes,
      dockToStockMinutes,
      orderToShipHours,
      samples: {
        pickCycle: picks.length,
        dockToStock: putaways.filter(p => p.receivingTask).length,
        orderToShip: orderToShipMs.length,
      },
    };
  }

  private async buildQuality(orgId: string, now: Date): Promise<QualityKpis> {
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000);

    const [pickCompleted, pickShort, packTotal, packPass, cycleCountLines] = await Promise.all([
      this.prisma.pickTask.count({ where: { orgId, status: 'completed', completedAt: { gte: thirtyDaysAgo } } }),
      this.prisma.pickTask.count({ where: { orgId, status: 'short_pick', completedAt: { gte: thirtyDaysAgo } } }),
      this.prisma.packAudit.count({ where: { orgId, createdAt: { gte: thirtyDaysAgo } } }),
      this.prisma.packAudit.count({ where: { orgId, verdict: 'pass', createdAt: { gte: thirtyDaysAgo } } }),
      this.prisma.cycleCountLine.findMany({
        where: { cycleCount: { orgId, createdAt: { gte: thirtyDaysAgo } } },
        select: { expectedQuantity: true, countedQuantity: true, status: true },
        take: 1000,
      }),
    ]);

    const pickTotal = pickCompleted + pickShort;
    const pickAccuracyPercent = pickTotal > 0
      ? Number(((pickCompleted / pickTotal) * 100).toFixed(1))
      : null;
    const packAuditPassRatePercent = packTotal > 0
      ? Number(((packPass / packTotal) * 100).toFixed(1))
      : null;

    // Inventory accuracy: 1 - sum(|variance|) / sum(expected)
    let totalExpected = 0;
    let totalVariance = 0;
    for (const line of cycleCountLines) {
      if (line.countedQuantity == null) continue;
      totalExpected += line.expectedQuantity;
      totalVariance += Math.abs(line.countedQuantity - line.expectedQuantity);
    }
    const inventoryAccuracyPercent = totalExpected > 0
      ? Number(((1 - totalVariance / totalExpected) * 100).toFixed(1))
      : null;

    return {
      pickAccuracyPercent,
      packAuditPassRatePercent,
      inventoryAccuracyPercent,
      pickAccuracySamples: pickTotal,
      packAuditSamples: packTotal,
      cycleCountSamples: cycleCountLines.filter(l => l.countedQuantity != null).length,
    };
  }

  private async buildLiveWork(orgId: string): Promise<LiveWorkKpis> {
    const [pending, putawayPending, packPending, waves, receiving] = await Promise.all([
      this.prisma.pickTask.count({ where: { orgId, status: { in: ['pending', 'assigned', 'in_progress'] } } }),
      this.prisma.putawayTask.count({ where: { orgId, status: { in: ['pending', 'assigned', 'in_progress'] } } }),
      this.prisma.packTask.count({ where: { orgId, status: { in: ['pending', 'in_progress'] } } }),
      this.prisma.wave.count({ where: { orgId, status: { in: ['released', 'in_progress'] } } }),
      this.prisma.receivingTask.count({ where: { orgId, status: { in: ['in_progress', 'inspection'] } } }),
    ]);

    return {
      pendingPickTasks: pending,
      pendingPutawayTasks: putawayPending,
      pendingPackTasks: packPending,
      activeWaves: waves,
      receivingInProgress: receiving,
    };
  }

  private async buildExceptions(orgId: string): Promise<ExceptionKpis> {
    const [openIssues, criticalIssues, cutoffCritical, cutoffWarning, pendingRmas, packFailures] = await Promise.all([
      this.prisma.issue.count({ where: { orgId, status: { in: ['open', 'in_progress'] } } }),
      this.prisma.issue.count({ where: { orgId, status: { in: ['open', 'in_progress'] }, priority: 'critical' } }),
      this.prisma.shipment.count({ where: { lastCutoffRiskSeverity: 'critical' } }),
      this.prisma.shipment.count({ where: { lastCutoffRiskSeverity: 'warning' } }),
      this.prisma.rma.count({ where: { orgId, status: { in: ['authorized', 'in_transit', 'received', 'inspecting'] } } }),
      this.prisma.packAudit.count({
        where: {
          orgId, verdict: 'fail',
          issueId: { not: null },
        },
      }),
    ]);

    return {
      openIssues,
      criticalIssues,
      cutoffAtRisk: { critical: cutoffCritical, warning: cutoffWarning },
      pendingReturns: pendingRmas,
      packAuditFailuresOpen: packFailures,
    };
  }

  private async buildCapacity(orgId: string): Promise<CapacityKpis> {
    const [totalBins, occupiedBins] = await Promise.all([
      this.prisma.warehouseBin.count({ where: { orgId } }),
      this.prisma.warehouseBin.count({
        where: {
          orgId,
          inventoryRecords: { some: { quantityOnHand: { gt: 0 } } },
        },
      }),
    ]);

    const utilizationPercent = totalBins > 0
      ? Number(((occupiedBins / totalBins) * 100).toFixed(1))
      : null;

    return { totalBins, binsWithInventory: occupiedBins, utilizationPercent };
  }
}

function avgMinutes(msValues: number[]): number | null {
  if (msValues.length === 0) return null;
  const avgMs = msValues.reduce((a, b) => a + b, 0) / msValues.length;
  return Math.round(avgMs / 60_000);
}
