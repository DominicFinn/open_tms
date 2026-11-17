import {
  ShipmentCutoffMonitorService,
  resolveCutoffForNow,
  computeSeverity,
  getLocalDayOfWeek,
  buildLocalDateTime,
} from '../../services/cutoff/ShipmentCutoffMonitorService';
import { EVENT_TYPES } from '../../events/eventTypes';

const DEFAULT_CONFIG = {
  minutesToReady: 30,
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
  // Monday, cutoff 16:30 UTC. A shipment needs 30 minutes before it can be handed over, so the
  // buffer is (16:30 - now - 30 min).
  const early = new Date('2026-04-20T14:00:00.000Z');    // ready 14:30, buffer 120 → minor
  const tight = new Date('2026-04-20T15:45:00.000Z');    // ready 16:15, buffer 15 → warning
  const tooLate = new Date('2026-04-20T16:10:00.000Z');  // ready 16:40, buffer -10 → critical

  function makePrisma(opts: { cutoffs?: any[]; shipmentUpdate?: jest.Mock } = {}) {
    return {
      carrierCutoff: { findMany: jest.fn().mockResolvedValue(opts.cutoffs ?? [makeCutoff()]) },
      shipment: { update: opts.shipmentUpdate ?? jest.fn().mockResolvedValue({}) },
      issue: { create: jest.fn().mockResolvedValue({ id: 'issue-1' }) },
    } as any;
  }

  function makeShipment(overrides: Partial<any> = {}): any {
    return {
      id: 'ship-1', orgId: 'org-1', reference: 'SH-100',
      carrierId: 'car-1', archived: false, status: 'booked',
      lastCutoffRiskSeverity: null, lastCutoffRiskAt: null, lastCutoffRiskIssueId: null,
      ...overrides,
    };
  }

  const makeBus = () => ({ publish: jest.fn().mockResolvedValue(undefined) });
  const published = (bus: { publish: jest.Mock }, type: string) =>
    bus.publish.mock.calls.map(c => c[0]).find(e => e.type === type);

  it('returns no risk when there is no carrier assigned', async () => {
    const prisma = makePrisma();
    const svc = new ShipmentCutoffMonitorService(prisma, makeBus() as any);
    const result = await svc.evaluateShipment(makeShipment({ carrierId: null }), early, 'org-1');
    expect(result.severity).toBeNull();
    expect(prisma.carrierCutoff.findMany).not.toHaveBeenCalled();
  });

  it('scopes the cutoff query to the shipment org', async () => {
    const prisma = makePrisma();
    const svc = new ShipmentCutoffMonitorService(prisma, makeBus() as any);
    await svc.evaluateShipment(makeShipment(), early, 'org-1');

    expect(prisma.carrierCutoff.findMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ orgId: 'org-1', carrierId: 'car-1' }),
    });
  });

  it('returns no risk when carrier has no cutoff for today', async () => {
    const svc = new ShipmentCutoffMonitorService(makePrisma({ cutoffs: [] }), makeBus() as any);
    const result = await svc.evaluateShipment(makeShipment(), early, 'org-1');
    expect(result.severity).toBeNull();
    expect(result.projectedReadyAt).toBeNull();
  });

  it('projects the ready time from the handling allowance', async () => {
    const svc = new ShipmentCutoffMonitorService(makePrisma(), makeBus() as any);
    const result = await svc.evaluateShipment(makeShipment(), early, 'org-1');
    expect(result.projectedReadyAt?.toISOString()).toBe('2026-04-20T14:30:00.000Z');
    expect(result.bufferMinutes).toBe(120);
  });

  it('honours a configured handling allowance', async () => {
    const svc = new ShipmentCutoffMonitorService(makePrisma(), makeBus() as any, { minutesToReady: 140 });
    const result = await svc.evaluateShipment(makeShipment(), early, 'org-1');
    expect(result.bufferMinutes).toBe(10);
    expect(result.severity).toBe('warning');
  });

  it('fires critical severity when the ready time is past the cutoff', async () => {
    const prisma = makePrisma();
    const bus = makeBus();
    const svc = new ShipmentCutoffMonitorService(prisma, bus as any);

    const result = await svc.evaluateShipment(makeShipment(), tooLate, 'org-1');
    expect(result.severity).toBe('critical');
    expect(result.bufferMinutes).toBe(-10);
    expect(result.notified).toBe(true);
    // Issue creation is owned by the Issue Engine, which consumes the event below.
    expect(prisma.issue.create).not.toHaveBeenCalled();
    const event = published(bus, EVENT_TYPES.SHIPMENT_CUTOFF_AT_RISK);
    expect(event.orgId).toBe('org-1');
    expect(event.payload).toEqual({
      shipmentId: 'ship-1',
      shipmentReference: 'SH-100',
      carrierId: 'car-1',
      cutoffAt: '2026-04-20T16:30:00.000Z',
      projectedReadyAt: '2026-04-20T16:40:00.000Z',
      bufferMinutes: -10,
      severity: 'critical',
    });
  });

  it('fires warning when the buffer is between 10 and 30 minutes', async () => {
    const prisma = makePrisma();
    const bus = makeBus();
    const svc = new ShipmentCutoffMonitorService(prisma, bus as any);

    const result = await svc.evaluateShipment(makeShipment(), tight, 'org-1');
    expect(result.severity).toBe('warning');
    expect(prisma.issue.create).not.toHaveBeenCalled();
    expect(published(bus, EVENT_TYPES.SHIPMENT_CUTOFF_AT_RISK).payload.severity).toBe('warning');
    expect(prisma.shipment.update).toHaveBeenCalledWith({
      where: { id: 'ship-1', orgId: 'org-1' },
      data: { lastCutoffRiskSeverity: 'warning', lastCutoffRiskAt: tight },
    });
  });

  it('returns minor severity when there is plenty of buffer and publishes nothing', async () => {
    const bus = makeBus();
    const svc = new ShipmentCutoffMonitorService(makePrisma(), bus as any);

    const result = await svc.evaluateShipment(makeShipment(), early, 'org-1');
    expect(result.severity).toBe('minor');
    expect(result.notified).toBe(false);
    expect(bus.publish).not.toHaveBeenCalled();
  });

  it('emits cutoff_cleared and clears the marker when a previously at-risk shipment recovers', async () => {
    const shipmentUpdate = jest.fn().mockResolvedValue({});
    const bus = makeBus();
    const svc = new ShipmentCutoffMonitorService(makePrisma({ shipmentUpdate }), bus as any);

    const result = await svc.evaluateShipment(makeShipment({ lastCutoffRiskSeverity: 'critical' }), early, 'org-1');
    expect(result.severity).toBe('minor');
    const cleared = published(bus, EVENT_TYPES.SHIPMENT_CUTOFF_CLEARED);
    expect(cleared.payload.shipmentId).toBe('ship-1');
    expect(cleared.orgId).toBe('org-1');
    expect(shipmentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ lastCutoffRiskSeverity: null }) }),
    );
  });

  it('does not emit cutoff_cleared when the shipment was not previously at risk', async () => {
    const bus = makeBus();
    const svc = new ShipmentCutoffMonitorService(makePrisma(), bus as any);

    await svc.evaluateShipment(makeShipment({ lastCutoffRiskSeverity: null }), early, 'org-1');
    expect(published(bus, EVENT_TYPES.SHIPMENT_CUTOFF_CLEARED)).toBeUndefined();
  });

  it('dedupes warning re-notifications within the window', async () => {
    const bus = makeBus();
    const svc = new ShipmentCutoffMonitorService(makePrisma(), bus as any);

    const shipment = makeShipment({
      lastCutoffRiskSeverity: 'warning',
      lastCutoffRiskAt: new Date(tight.getTime() - 10 * 60 * 1000), // 10 min ago
    });

    const result = await svc.evaluateShipment(shipment, tight, 'org-1');
    expect(result.severity).toBe('warning');
    expect(result.notified).toBe(false);
    expect(bus.publish).not.toHaveBeenCalled();
  });

  it('escalates to critical even within the dedup window', async () => {
    const bus = makeBus();
    const svc = new ShipmentCutoffMonitorService(makePrisma(), bus as any);

    const shipment = makeShipment({
      lastCutoffRiskSeverity: 'warning',
      lastCutoffRiskAt: new Date(tooLate.getTime() - 5 * 60 * 1000),
    });

    const result = await svc.evaluateShipment(shipment, tooLate, 'org-1');
    expect(result.severity).toBe('critical');
    expect(result.notified).toBe(true);
    expect(published(bus, EVENT_TYPES.SHIPMENT_CUTOFF_AT_RISK).payload.severity).toBe('critical');
  });

  it('fires again after the dedup window even at the same severity', async () => {
    const bus = makeBus();
    const svc = new ShipmentCutoffMonitorService(makePrisma(), bus as any);

    const shipment = makeShipment({
      lastCutoffRiskSeverity: 'warning',
      lastCutoffRiskAt: new Date(tight.getTime() - 60 * 60 * 1000), // 60 min ago
    });

    const result = await svc.evaluateShipment(shipment, tight, 'org-1');
    expect(result.severity).toBe('warning');
    expect(result.notified).toBe(true);
    expect(bus.publish).toHaveBeenCalled();
  });
});
