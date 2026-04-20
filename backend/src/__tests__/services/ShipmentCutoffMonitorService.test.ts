import {
  ShipmentCutoffMonitorService,
  resolveCutoffForNow,
  computeSeverity,
  getLocalDayOfWeek,
  buildLocalDateTime,
} from '../../services/cutoff/ShipmentCutoffMonitorService';
import { EVENT_TYPES } from '../../events/eventTypes';

const DEFAULT_CONFIG = {
  minutesPerPendingPick: 45,
  minutesPerPendingPack: 15,
  minutesNoLoadPlan: 30,
  warningBufferMinutes: 30,
  criticalBufferMinutes: 10,
  dedupWindowMinutes: 30,
};

function makeCutoff(overrides: Partial<any> = {}): any {
  return {
    id: 'c-1', carrierId: 'car-1', orgId: 'org-1',
    dayOfWeek: 1, cutoffLocalTime: '16:30', timezone: 'UTC',
    serviceLevel: null, locationId: null, notes: null, active: true,
    createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  };
}

describe('buildLocalDateTime', () => {
  it('builds 16:30 UTC when timezone is UTC', () => {
    const now = new Date('2026-04-20T10:00:00.000Z'); // Monday
    const result = buildLocalDateTime(now, 'UTC', 16, 30);
    expect(result.toISOString()).toBe('2026-04-20T16:30:00.000Z');
  });

  it('builds the correct UTC time for an offset timezone (America/New_York, EDT = UTC-4)', () => {
    const now = new Date('2026-04-20T14:00:00.000Z'); // 10:00 EDT Mon
    const result = buildLocalDateTime(now, 'America/New_York', 16, 30);
    // 16:30 EDT = 20:30 UTC
    expect(result.toISOString()).toBe('2026-04-20T20:30:00.000Z');
  });
});

describe('getLocalDayOfWeek', () => {
  it('returns 1 (Monday) for a UTC Monday', () => {
    expect(getLocalDayOfWeek(new Date('2026-04-20T10:00:00.000Z'), 'UTC')).toBe(1);
  });

  it('returns the previous day when local timezone is behind UTC and it is still yesterday there', () => {
    // 2026-04-20T03:00:00Z = Sunday 23:00 in America/New_York (UTC-4)
    expect(getLocalDayOfWeek(new Date('2026-04-20T03:00:00.000Z'), 'America/New_York')).toBe(0);
  });
});

describe('resolveCutoffForNow', () => {
  const monday = new Date('2026-04-20T10:00:00.000Z'); // Monday 10:00 UTC

  it('returns null when no cutoff exists for today', () => {
    const cutoffs = [makeCutoff({ dayOfWeek: 2 })]; // Tuesday only
    expect(resolveCutoffForNow(cutoffs, monday)).toBeNull();
  });

  it('returns the matching Monday cutoff', () => {
    const cutoffs = [makeCutoff({ dayOfWeek: 1, cutoffLocalTime: '16:30' })];
    const resolved = resolveCutoffForNow(cutoffs, monday);
    expect(resolved).not.toBeNull();
    expect(resolved!.cutoffAt.toISOString()).toBe('2026-04-20T16:30:00.000Z');
  });

  it('ignores inactive cutoffs', () => {
    const cutoffs = [makeCutoff({ dayOfWeek: 1, active: false })];
    expect(resolveCutoffForNow(cutoffs, monday)).toBeNull();
  });

  it('picks the earliest cutoff when multiple match the same day', () => {
    const cutoffs = [
      makeCutoff({ id: 'late', dayOfWeek: 1, cutoffLocalTime: '18:00' }),
      makeCutoff({ id: 'early', dayOfWeek: 1, cutoffLocalTime: '14:00' }),
    ];
    const resolved = resolveCutoffForNow(cutoffs, monday);
    expect(resolved!.cutoff.id).toBe('early');
  });

  it('returns null for an empty list', () => {
    expect(resolveCutoffForNow([], monday)).toBeNull();
  });
});

describe('computeSeverity', () => {
  it('returns critical when buffer is below critical threshold', () => {
    expect(computeSeverity(5, DEFAULT_CONFIG)).toBe('critical');
  });

  it('returns critical for past-cutoff (negative buffer)', () => {
    expect(computeSeverity(-15, DEFAULT_CONFIG)).toBe('critical');
  });

  it('returns warning when buffer is between critical and warning thresholds', () => {
    expect(computeSeverity(20, DEFAULT_CONFIG)).toBe('warning');
  });

  it('returns minor when buffer is above warning threshold', () => {
    expect(computeSeverity(60, DEFAULT_CONFIG)).toBe('minor');
  });

  it('returns minor at exact warning boundary', () => {
    expect(computeSeverity(30, DEFAULT_CONFIG)).toBe('minor');
  });

  it('returns warning at exact critical boundary', () => {
    expect(computeSeverity(10, DEFAULT_CONFIG)).toBe('warning');
  });
});

describe('ShipmentCutoffMonitorService.evaluateShipment', () => {
  const now = new Date('2026-04-20T14:00:00.000Z'); // Monday 14:00 UTC, cutoff 16:30 = 150 min ahead

  function makePrisma(opts: {
    cutoffs?: any[];
    pickCount?: number;
    packCount?: number;
    loadPlanCount?: number;
    shipmentUpdate?: jest.Mock;
    issueCreate?: jest.Mock;
  } = {}) {
    return {
      carrierCutoff: { findMany: jest.fn().mockResolvedValue(opts.cutoffs ?? [makeCutoff()]) },
      pickTask: { count: jest.fn().mockResolvedValue(opts.pickCount ?? 0) },
      packTask: { count: jest.fn().mockResolvedValue(opts.packCount ?? 0) },
      loadPlan: { count: jest.fn().mockResolvedValue(opts.loadPlanCount ?? 1) },
      shipment: {
        update: opts.shipmentUpdate ?? jest.fn().mockResolvedValue({}),
      },
      issue: {
        create: opts.issueCreate ?? jest.fn().mockResolvedValue({ id: 'issue-1' }),
      },
    } as any;
  }

  function makeShipment(overrides: Partial<any> = {}): any {
    return {
      id: 'ship-1', reference: 'SH-100',
      carrierId: 'car-1', archived: false, status: 'booked',
      orderShipments: [{ orderId: 'order-1' }],
      lastCutoffRiskSeverity: null, lastCutoffRiskAt: null, lastCutoffRiskIssueId: null,
      ...overrides,
    };
  }

  it('returns no risk when there is no carrier assigned', async () => {
    const prisma = makePrisma();
    const bus = { publish: jest.fn() };
    const svc = new ShipmentCutoffMonitorService(prisma, bus as any);
    const result = await svc.evaluateShipment(makeShipment({ carrierId: null }), now, 'org-1');
    expect(result.severity).toBeNull();
    expect(result.cutoffAt).toBeNull();
  });

  it('returns no risk when carrier has no cutoff for today', async () => {
    const prisma = makePrisma({ cutoffs: [] });
    const bus = { publish: jest.fn() };
    const svc = new ShipmentCutoffMonitorService(prisma, bus as any);
    const result = await svc.evaluateShipment(makeShipment(), now, 'org-1');
    expect(result.severity).toBeNull();
  });

  it('fires critical severity when projected ready is past cutoff', async () => {
    // 150 min to cutoff, 4 pending picks × 45 = 180 min of work → 30 min past cutoff
    const prisma = makePrisma({ pickCount: 4, loadPlanCount: 1 });
    const bus = { publish: jest.fn().mockResolvedValue(undefined) };
    const svc = new ShipmentCutoffMonitorService(prisma, bus as any);

    const result = await svc.evaluateShipment(makeShipment(), now, 'org-1');
    expect(result.severity).toBe('critical');
    expect(result.bufferMinutes).toBeLessThan(0);
    expect(result.blockingStage).toBe('picking');
    expect(result.notified).toBe(true);
    expect(prisma.issue.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        priority: 'high',
        category: 'logistics',
        sourceEntityType: 'shipment',
      }),
    }));
    expect(bus.publish).toHaveBeenCalled();
    const eventArg = (bus.publish as jest.Mock).mock.calls[0][0];
    expect(eventArg.type).toBe(EVENT_TYPES.SHIPMENT_CUTOFF_AT_RISK);
    expect(eventArg.payload.severity).toBe('critical');
  });

  it('fires warning when buffer is between 10 and 30 minutes', async () => {
    // 150 min to cutoff. 2 pending packs × 15 = 30 → buffer 120. That's minor.
    // Let's set up: 2 picks × 45 = 90, plus no load plan +30 = 120 → buffer 30 → minor (exact boundary)
    // Try 2 picks × 45 + 20 min pack. 90 + 30 (no load plan) = 120, buffer = 30 → minor
    // Need to land in 10-30 buffer range: work = 120-140 min
    // 2 picks = 90min + 2 packs × 15 = 30min → 120 → buffer 30 → minor
    // 3 picks = 135min → buffer 15 → warning
    const prisma = makePrisma({ pickCount: 3, loadPlanCount: 1 });
    const bus = { publish: jest.fn().mockResolvedValue(undefined) };
    const svc = new ShipmentCutoffMonitorService(prisma, bus as any);

    const result = await svc.evaluateShipment(makeShipment(), now, 'org-1');
    expect(result.severity).toBe('warning');
    expect(prisma.issue.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ priority: 'medium' }),
    }));
  });

  it('returns minor severity when there is plenty of buffer and does not create an issue', async () => {
    // 150 min to cutoff, 1 pick × 45 = 45min, buffer = 105 → minor
    const prisma = makePrisma({ pickCount: 1, loadPlanCount: 1 });
    const bus = { publish: jest.fn().mockResolvedValue(undefined) };
    const svc = new ShipmentCutoffMonitorService(prisma, bus as any);

    const result = await svc.evaluateShipment(makeShipment(), now, 'org-1');
    expect(result.severity).toBe('minor');
    expect(prisma.issue.create).not.toHaveBeenCalled();
    expect(result.notified).toBe(false); // minor doesn't fire unless escalating
  });

  it('dedupes warning re-notifications within the window', async () => {
    const prisma = makePrisma({ pickCount: 3, loadPlanCount: 1 });
    const bus = { publish: jest.fn().mockResolvedValue(undefined) };
    const svc = new ShipmentCutoffMonitorService(prisma, bus as any);

    const shipment = makeShipment({
      lastCutoffRiskSeverity: 'warning',
      lastCutoffRiskAt: new Date(now.getTime() - 10 * 60 * 1000), // 10 min ago
      lastCutoffRiskIssueId: 'issue-old',
    });

    const result = await svc.evaluateShipment(shipment, now, 'org-1');
    expect(result.severity).toBe('warning');
    expect(result.notified).toBe(false);
    expect(bus.publish).not.toHaveBeenCalled();
    expect(prisma.issue.create).not.toHaveBeenCalled();
  });

  it('escalates to critical even within the dedup window', async () => {
    const prisma = makePrisma({ pickCount: 4, loadPlanCount: 1 });
    const bus = { publish: jest.fn().mockResolvedValue(undefined) };
    const svc = new ShipmentCutoffMonitorService(prisma, bus as any);

    const shipment = makeShipment({
      lastCutoffRiskSeverity: 'warning',
      lastCutoffRiskAt: new Date(now.getTime() - 5 * 60 * 1000),
      lastCutoffRiskIssueId: 'issue-old',
    });

    const result = await svc.evaluateShipment(shipment, now, 'org-1');
    expect(result.severity).toBe('critical');
    expect(result.notified).toBe(true);
    expect(bus.publish).toHaveBeenCalled();
    // Should reuse the existing issue rather than create a duplicate
    expect(prisma.issue.create).not.toHaveBeenCalled();
  });

  it('fires again after the dedup window even at the same severity', async () => {
    const prisma = makePrisma({ pickCount: 3, loadPlanCount: 1 });
    const bus = { publish: jest.fn().mockResolvedValue(undefined) };
    const svc = new ShipmentCutoffMonitorService(prisma, bus as any);

    const shipment = makeShipment({
      lastCutoffRiskSeverity: 'warning',
      lastCutoffRiskAt: new Date(now.getTime() - 60 * 60 * 1000), // 60 min ago
      lastCutoffRiskIssueId: 'issue-old',
    });

    const result = await svc.evaluateShipment(shipment, now, 'org-1');
    expect(result.severity).toBe('warning');
    expect(result.notified).toBe(true);
    expect(bus.publish).toHaveBeenCalled();
  });

  it('identifies load_planning as blocking stage when picks and packs are done but no load plan', async () => {
    // 0 picks, 0 packs, no load plan → 30 min of work. Buffer = 120 min → minor
    // Bump to 0 picks, 0 packs, no load plan, but push status near cutoff
    // For blocking stage test, just verify the field; severity doesn't matter.
    const prisma = makePrisma({ pickCount: 0, packCount: 0, loadPlanCount: 0 });
    const bus = { publish: jest.fn().mockResolvedValue(undefined) };
    const svc = new ShipmentCutoffMonitorService(prisma, bus as any);

    const result = await svc.evaluateShipment(makeShipment(), now, 'org-1');
    expect(result.blockingStage).toBe('load_planning');
    expect(result.pendingLoadPlan).toBe(true);
  });
});
