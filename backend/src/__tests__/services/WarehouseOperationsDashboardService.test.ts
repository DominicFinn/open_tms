import { WarehouseOperationsDashboardService } from '../../services/warehouse/WarehouseOperationsDashboardService';

function makePrisma(overrides: any = {}) {
  const defaults = {
    receivingTask: { count: jest.fn().mockResolvedValue(0) },
    putawayTask: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
    pickTask: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
    packTask: { count: jest.fn().mockResolvedValue(0) },
    packAudit: { count: jest.fn().mockResolvedValue(0) },
    shipment: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
    cycleCountLine: { findMany: jest.fn().mockResolvedValue([]) },
    wave: { count: jest.fn().mockResolvedValue(0) },
    issue: { count: jest.fn().mockResolvedValue(0) },
    rma: { count: jest.fn().mockResolvedValue(0) },
    warehouseBin: { count: jest.fn().mockResolvedValue(0) },
  };
  // Deep-merge overrides
  for (const key of Object.keys(overrides)) {
    (defaults as any)[key] = { ...(defaults as any)[key], ...overrides[key] };
  }
  return defaults as any;
}

describe('WarehouseOperationsDashboardService', () => {
  const now = new Date('2026-04-20T12:00:00.000Z');

  it('returns a full snapshot with all sections', async () => {
    const prisma = makePrisma();
    const svc = new WarehouseOperationsDashboardService(prisma);
    const snap = await svc.buildSnapshot('org-1', now);
    expect(snap.generatedAt).toBe(now.toISOString());
    expect(snap.throughput).toBeDefined();
    expect(snap.cycleTimes).toBeDefined();
    expect(snap.quality).toBeDefined();
    expect(snap.liveWork).toBeDefined();
    expect(snap.exceptions).toBeDefined();
    expect(snap.capacity).toBeDefined();
  });

  it('counts throughput with separate today and 7-day windows', async () => {
    // Today's start is 00:00 UTC; 7d ago is earlier.
    const startOfToday = new Date(now);
    startOfToday.setUTCHours(0, 0, 0, 0);
    const todayMs = startOfToday.getTime();

    // Dispatch by the `gte` filter date: equals today → return today value, earlier → 7d value.
    const byWindow = (todayVal: number, weekVal: number) =>
      jest.fn().mockImplementation(async (args: any) => {
        const gte = args?.where?.updatedAt?.gte ?? args?.where?.completedAt?.gte;
        if (!gte) return 0; // fallback for live-work etc. (no time filter)
        return gte.getTime() === todayMs ? todayVal : weekVal;
      });

    const prisma = makePrisma({
      receivingTask: { count: byWindow(3, 21) },
      putawayTask: { count: byWindow(5, 32) },
      pickTask: { count: byWindow(8, 60) },
      packTask: { count: byWindow(7, 55) },
      shipment: { count: byWindow(4, 28) },
    });
    const svc = new WarehouseOperationsDashboardService(prisma);
    const snap = await svc.buildSnapshot('org-1', now);
    expect(snap.throughput.today).toEqual({ receipts: 3, putaways: 5, picks: 8, packs: 7, shipmentsDispatched: 4 });
    expect(snap.throughput.last7Days).toEqual({ receipts: 21, putaways: 32, picks: 60, packs: 55, shipmentsDispatched: 28 });
  });

  it('computes pick cycle time in minutes from startedAt/completedAt samples', async () => {
    const startedAt = new Date('2026-04-20T10:00:00Z');
    const completedAt = new Date('2026-04-20T10:18:00Z'); // 18 min
    const prisma = makePrisma({
      pickTask: { findMany: jest.fn().mockResolvedValue([{ startedAt, completedAt }]) },
    });
    const svc = new WarehouseOperationsDashboardService(prisma);
    const snap = await svc.buildSnapshot('org-1', now);
    expect(snap.cycleTimes.pickCycleMinutes).toBe(18);
    expect(snap.cycleTimes.samples.pickCycle).toBe(1);
  });

  it('returns null for cycle times when no samples exist', async () => {
    const prisma = makePrisma();
    const svc = new WarehouseOperationsDashboardService(prisma);
    const snap = await svc.buildSnapshot('org-1', now);
    expect(snap.cycleTimes.pickCycleMinutes).toBeNull();
    expect(snap.cycleTimes.dockToStockMinutes).toBeNull();
    expect(snap.cycleTimes.orderToShipHours).toBeNull();
  });

  it('computes dock-to-stock from putaway completion minus linked receiving task creation', async () => {
    const receivingCreatedAt = new Date('2026-04-20T08:00:00Z');
    const putawayUpdatedAt = new Date('2026-04-20T08:45:00Z'); // 45 min
    const prisma = makePrisma({
      putawayTask: {
        findMany: jest.fn().mockResolvedValue([
          { updatedAt: putawayUpdatedAt, receivingTask: { createdAt: receivingCreatedAt } },
        ]),
      },
    });
    const svc = new WarehouseOperationsDashboardService(prisma);
    const snap = await svc.buildSnapshot('org-1', now);
    expect(snap.cycleTimes.dockToStockMinutes).toBe(45);
  });

  it('computes pick accuracy from completed vs short_pick counts', async () => {
    // pickTask.count calls: buildCycleTimes doesn't use count, only findMany.
    // Order of count calls in buildQuality: completed, short_pick, packTotal, packPass
    const pickCount = jest.fn()
      .mockImplementation(async (args: any) => {
        if (args.where.status === 'completed') return 90;
        if (args.where.status === 'short_pick') return 10;
        return 0;
      });
    const prisma = makePrisma({ pickTask: { count: pickCount } });
    const svc = new WarehouseOperationsDashboardService(prisma);
    const snap = await svc.buildSnapshot('org-1', now);
    // Only quality.buildQuality uses short_pick; throughput uses completed-today and completed-7d.
    // The mock returns 90 for any 'completed' query, so throughput counts will also be 90. That's OK for the test.
    expect(snap.quality.pickAccuracyPercent).toBe(90);
    expect(snap.quality.pickAccuracySamples).toBe(100);
  });

  it('computes pack audit pass rate from verdict counts', async () => {
    const packAuditCount = jest.fn()
      .mockImplementation(async (args: any) => {
        if (args.where.verdict === 'pass') return 95;
        if (args.where.verdict === 'fail') return 0;
        return 100; // total
      });
    const prisma = makePrisma({ packAudit: { count: packAuditCount } });
    const svc = new WarehouseOperationsDashboardService(prisma);
    const snap = await svc.buildSnapshot('org-1', now);
    expect(snap.quality.packAuditPassRatePercent).toBe(95);
    expect(snap.quality.packAuditSamples).toBe(100);
  });

  it('computes inventory accuracy from cycle count variance', async () => {
    // 3 lines: expected 100+50+200 = 350, counted 98+50+195 = 343, variance = 2+0+5 = 7
    // accuracy = 1 - 7/350 = 98%
    const prisma = makePrisma({
      cycleCountLine: {
        findMany: jest.fn().mockResolvedValue([
          { expectedQuantity: 100, countedQuantity: 98, status: 'counted' },
          { expectedQuantity: 50, countedQuantity: 50, status: 'counted' },
          { expectedQuantity: 200, countedQuantity: 195, status: 'counted' },
        ]),
      },
    });
    const svc = new WarehouseOperationsDashboardService(prisma);
    const snap = await svc.buildSnapshot('org-1', now);
    expect(snap.quality.inventoryAccuracyPercent).toBe(98);
    expect(snap.quality.cycleCountSamples).toBe(3);
  });

  it('ignores uncounted cycle-count lines (countedQuantity null)', async () => {
    const prisma = makePrisma({
      cycleCountLine: {
        findMany: jest.fn().mockResolvedValue([
          { expectedQuantity: 100, countedQuantity: null, status: 'pending' },
          { expectedQuantity: 50, countedQuantity: 50, status: 'counted' },
        ]),
      },
    });
    const svc = new WarehouseOperationsDashboardService(prisma);
    const snap = await svc.buildSnapshot('org-1', now);
    expect(snap.quality.inventoryAccuracyPercent).toBe(100);
    expect(snap.quality.cycleCountSamples).toBe(1);
  });

  it('aggregates live work counts', async () => {
    const pickCount = jest.fn().mockResolvedValue(12);
    const putawayCount = jest.fn().mockResolvedValue(7);
    const packCount = jest.fn().mockResolvedValue(4);
    const waveCount = jest.fn().mockResolvedValue(2);
    const receivingCount = jest.fn().mockResolvedValue(1);
    const prisma = makePrisma({
      pickTask: { count: pickCount },
      putawayTask: { count: putawayCount },
      packTask: { count: packCount },
      wave: { count: waveCount },
      receivingTask: { count: receivingCount },
    });
    const svc = new WarehouseOperationsDashboardService(prisma);
    const snap = await svc.buildSnapshot('org-1', now);
    // Live work reuses task counts; the mocks return the same for all calls.
    expect(snap.liveWork.activeWaves).toBe(2);
    expect(snap.liveWork.pendingPackTasks).toBe(4);
  });

  it('computes bin utilization as occupied / total', async () => {
    const binCount = jest.fn()
      .mockResolvedValueOnce(200)  // total
      .mockResolvedValueOnce(150); // occupied
    const prisma = makePrisma({ warehouseBin: { count: binCount } });
    const svc = new WarehouseOperationsDashboardService(prisma);
    const snap = await svc.buildSnapshot('org-1', now);
    expect(snap.capacity.totalBins).toBe(200);
    expect(snap.capacity.binsWithInventory).toBe(150);
    expect(snap.capacity.utilizationPercent).toBe(75);
  });

  it('returns null utilization when there are no bins', async () => {
    const prisma = makePrisma();
    const svc = new WarehouseOperationsDashboardService(prisma);
    const snap = await svc.buildSnapshot('org-1', now);
    expect(snap.capacity.utilizationPercent).toBeNull();
  });

  it('rolls cutoff at-risk counts into exceptions section', async () => {
    const shipmentCount = jest.fn()
      .mockImplementation(async (args: any) => {
        if (args.where.lastCutoffRiskSeverity === 'critical') return 3;
        if (args.where.lastCutoffRiskSeverity === 'warning') return 5;
        return 0;
      });
    const prisma = makePrisma({ shipment: { count: shipmentCount } });
    const svc = new WarehouseOperationsDashboardService(prisma);
    const snap = await svc.buildSnapshot('org-1', now);
    expect(snap.exceptions.cutoffAtRisk.critical).toBe(3);
    expect(snap.exceptions.cutoffAtRisk.warning).toBe(5);
  });
});
