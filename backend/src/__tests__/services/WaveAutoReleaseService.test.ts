import { WaveAutoReleaseService, parseDailyHHMM } from '../../services/waves/WaveAutoReleaseService';

describe('parseDailyHHMM', () => {
  const now = new Date('2026-04-20T10:00:00.000Z');

  it('parses HH:MM 24-hour format', () => {
    const r = parseDailyHHMM('14:30', now);
    expect(r?.toISOString()).toBe('2026-04-20T14:30:00.000Z');
  });

  it('parses single-digit hour', () => {
    const r = parseDailyHHMM('9:00', now);
    expect(r?.toISOString()).toBe('2026-04-20T09:00:00.000Z');
  });

  it('parses basic cron "M H * * *"', () => {
    const r = parseDailyHHMM('30 14 * * *', now);
    expect(r?.toISOString()).toBe('2026-04-20T14:30:00.000Z');
  });

  it('returns null for invalid hour', () => {
    expect(parseDailyHHMM('25:00', now)).toBeNull();
  });

  it('returns null for invalid minute', () => {
    expect(parseDailyHHMM('10:61', now)).toBeNull();
  });

  it('returns null for unsupported formats', () => {
    expect(parseDailyHHMM('daily', now)).toBeNull();
    expect(parseDailyHHMM('*/5 * * * *', now)).toBeNull();
    expect(parseDailyHHMM('', now)).toBeNull();
  });
});

describe('WaveAutoReleaseService.shouldRelease', () => {
  const now = new Date('2026-04-20T14:00:00.000Z'); // Monday 14:00 UTC

  function svc() {
    return new WaveAutoReleaseService({} as any, {} as any);
  }

  function tpl(overrides: Partial<any> = {}): any {
    return {
      id: 't1', name: 'Daily', autoRelease: true, active: true,
      releaseSchedule: null, cutoffTime: null, lastAutoReleasedAt: null,
      ...overrides,
    };
  }

  it('returns false when no schedule is set', () => {
    expect(svc().shouldRelease(tpl(), now)).toBe(false);
  });

  it('returns true when releaseSchedule HH:MM has passed', () => {
    expect(svc().shouldRelease(tpl({ releaseSchedule: '13:00' }), now)).toBe(true);
  });

  it('returns false when releaseSchedule HH:MM has not yet arrived', () => {
    expect(svc().shouldRelease(tpl({ releaseSchedule: '16:00' }), now)).toBe(false);
  });

  it('falls back to cutoffTime when releaseSchedule is null', () => {
    expect(svc().shouldRelease(tpl({ cutoffTime: '13:00' }), now)).toBe(true);
    expect(svc().shouldRelease(tpl({ cutoffTime: '16:00' }), now)).toBe(false);
  });

  it('dedupes within the 12h window after last release', () => {
    const template = tpl({
      releaseSchedule: '13:00',
      lastAutoReleasedAt: new Date('2026-04-20T13:00:00.000Z'), // 1h ago
    });
    expect(svc().shouldRelease(template, now)).toBe(false);
  });

  it('fires again after the dedup window has passed', () => {
    const template = tpl({
      releaseSchedule: '13:00',
      lastAutoReleasedAt: new Date('2026-04-20T00:00:00.000Z'), // 14h ago
    });
    expect(svc().shouldRelease(template, now)).toBe(true);
  });

  it('accepts a custom dedup window', () => {
    const template = tpl({
      releaseSchedule: '13:00',
      lastAutoReleasedAt: new Date('2026-04-20T13:00:00.000Z'), // 1h ago
    });
    expect(svc().shouldRelease(template, now, 0.5)).toBe(true);
  });
});

describe('WaveAutoReleaseService.runOnce', () => {
  const now = new Date('2026-04-20T14:00:00.000Z');

  function setup(templates: any[], dispatchResult: any = { success: true, data: { waveNumber: 'W-001' } }) {
    const prisma = {
      waveTemplate: {
        findMany: jest.fn().mockResolvedValue(templates),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const commandBus = {
      dispatch: jest.fn().mockResolvedValue(dispatchResult),
    };
    return { prisma, commandBus, svc: new WaveAutoReleaseService(prisma as any, commandBus as any) };
  }

  it('fires APPLY_WAVE_TEMPLATE for a due template and stamps lastAutoReleasedAt', async () => {
    const { prisma, commandBus, svc } = setup([
      { id: 't1', orgId: 'org1', name: 'Daily', autoRelease: true, active: true, releaseSchedule: '13:00', cutoffTime: null, lastAutoReleasedAt: null },
    ]);
    const r = await svc.runOnce(now);
    expect(r.templatesChecked).toBe(1);
    expect(r.templatesTriggered).toBe(1);
    expect(commandBus.dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'wave_template.apply',
      payload: { templateId: 't1' },
    }));
    expect(prisma.waveTemplate.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 't1' },
      data: { lastAutoReleasedAt: now },
    }));
  });

  it('skips a template whose schedule has not arrived', async () => {
    const { commandBus, svc, prisma } = setup([
      { id: 't1', orgId: 'org1', name: 'Future', autoRelease: true, active: true, releaseSchedule: '16:00', cutoffTime: null, lastAutoReleasedAt: null },
    ]);
    const r = await svc.runOnce(now);
    expect(r.templatesTriggered).toBe(0);
    expect(commandBus.dispatch).not.toHaveBeenCalled();
    expect(prisma.waveTemplate.update).not.toHaveBeenCalled();
  });

  it('records dispatch failures without stamping lastAutoReleasedAt', async () => {
    const { prisma, svc } = setup(
      [{ id: 't1', orgId: 'org1', name: 'Bad', autoRelease: true, active: true, releaseSchedule: '13:00', cutoffTime: null, lastAutoReleasedAt: null }],
      { success: false, error: 'template inactive' },
    );
    const r = await svc.runOnce(now);
    expect(r.templatesTriggered).toBe(0);
    expect(r.triggered[0].skipped).toBe(true);
    expect(r.triggered[0].reason).toContain('template inactive');
    expect(prisma.waveTemplate.update).not.toHaveBeenCalled();
  });

  it('captures skipped waves (no eligible orders) in the result', async () => {
    const { svc, prisma } = setup(
      [{ id: 't1', orgId: 'org1', name: 'NoOrders', autoRelease: true, active: true, releaseSchedule: '13:00', cutoffTime: null, lastAutoReleasedAt: null }],
      { success: true, data: { skipped: true, skipReason: 'No eligible orders' } },
    );
    const r = await svc.runOnce(now);
    // The template was triggered, but the inner command reported a skip - stamp still happens because the dispatch succeeded.
    expect(r.templatesTriggered).toBe(1);
    expect(r.triggered[0].skipped).toBe(true);
    expect(r.triggered[0].reason).toBe('No eligible orders');
    expect(prisma.waveTemplate.update).toHaveBeenCalled();
  });
});
