import { CreateWaveTemplateCommandHandler, CREATE_WAVE_TEMPLATE } from '../../commands/warehouse/CreateWaveTemplateCommand';
import { ApplyWaveTemplateCommandHandler, APPLY_WAVE_TEMPLATE } from '../../commands/warehouse/ApplyWaveTemplateCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

/* ── CreateWaveTemplateCommandHandler ──────────────────────── */

describe('CreateWaveTemplateCommandHandler', () => {
  it('creates template and returns id + name', async () => {
    const mockTemplate = { id: 'tpl-1', name: 'Daily FedEx 14:00', orgId: 'test-org' };
    const tx = {
      waveTemplate: { create: jest.fn().mockResolvedValue(mockTemplate) },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new CreateWaveTemplateCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(CREATE_WAVE_TEMPLATE, {
        locationId: 'loc-1', name: 'Daily FedEx 14:00', pickStrategy: 'batch',
        cutoffTime: '14:00', maxOrders: 50, autoRelease: true,
      })
    );

    expect(result.success).toBe(true);
    expect(result.data?.name).toBe('Daily FedEx 14:00');
    expect(tx.waveTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          pickStrategy: 'batch', cutoffTime: '14:00', autoRelease: true,
        }),
      })
    );
  });

  it('persists zonePickMode when supplied (for zone pick strategy)', async () => {
    const mockTemplate = { id: 'tpl-zone', name: 'Zone Sequential', orgId: 'test-org' };
    const tx = {
      waveTemplate: { create: jest.fn().mockResolvedValue(mockTemplate) },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new CreateWaveTemplateCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(CREATE_WAVE_TEMPLATE, {
        locationId: 'loc-1', name: 'Zone Sequential',
        pickStrategy: 'zone', zonePickMode: 'sequential',
      })
    );

    expect(result.success).toBe(true);
    expect(tx.waveTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          pickStrategy: 'zone',
          zonePickMode: 'sequential',
        }),
      })
    );
  });

  it('defaults zonePickMode to null when omitted', async () => {
    const tx = {
      waveTemplate: { create: jest.fn().mockResolvedValue({ id: 'tpl-null', name: 'No Zone Mode', orgId: 'test-org' }) },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const handler = new CreateWaveTemplateCommandHandler(prisma, mockEventBus().bus);

    await handler.execute(
      createTestCommand(CREATE_WAVE_TEMPLATE, {
        locationId: 'loc-1', name: 'No Zone Mode', pickStrategy: 'discrete',
      })
    );

    expect(tx.waveTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ zonePickMode: null }),
      })
    );
  });
});

/* ── ApplyWaveTemplateCommandHandler ───────────────────────── */

describe('ApplyWaveTemplateCommandHandler', () => {
  const mockTemplate = {
    id: 'tpl-1', locationId: 'loc-1', name: 'Daily Batch',
    pickStrategy: 'batch', groupingRules: null, cutoffTime: '16:00',
    minOrders: 2, maxOrders: 100, active: true, orgId: 'test-org',
  };

  it('creates wave from eligible orders', async () => {
    const mockWave = { id: 'wave-1', waveNumber: 'W-2026-04-16-001' };
    const tx = {
      waveTemplate: { findUnique: jest.fn().mockResolvedValue(mockTemplate) },
      waveOrder: {
        findMany: jest.fn().mockResolvedValue([]), // no existing wave orders
        createMany: jest.fn().mockResolvedValue({ count: 3 }),
      },
      order: { findMany: jest.fn().mockResolvedValue([{ id: 'o1' }, { id: 'o2' }, { id: 'o3' }]) },
      orderLineItem: { count: jest.fn().mockResolvedValue(8) },
      wave: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue(mockWave),
      },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new ApplyWaveTemplateCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(APPLY_WAVE_TEMPLATE, { templateId: 'tpl-1' })
    );

    expect(result.success).toBe(true);
    expect(result.data?.skipped).toBe(false);
    expect(result.data?.orderCount).toBe(3);
    expect(result.data?.waveNumber).toMatch(/^W-/);
    expect(result.events.some(e => e.type === EVENT_TYPES.WAVE_CREATED)).toBe(true);
    expect(result.events[0].payload).toEqual(
      expect.objectContaining({ templateId: 'tpl-1', templateName: 'Daily Batch' })
    );
  });

  it('skips if below minOrders', async () => {
    const tx = {
      waveTemplate: { findUnique: jest.fn().mockResolvedValue(mockTemplate) },
      waveOrder: { findMany: jest.fn().mockResolvedValue([]) },
      order: { findMany: jest.fn().mockResolvedValue([{ id: 'o1' }]) }, // only 1, min is 2
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new ApplyWaveTemplateCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(APPLY_WAVE_TEMPLATE, { templateId: 'tpl-1' })
    );

    expect(result.success).toBe(true);
    expect(result.data?.skipped).toBe(true);
    expect(result.data?.skipReason).toContain('minimum');
  });

  it('skips if no eligible orders', async () => {
    const tx = {
      waveTemplate: { findUnique: jest.fn().mockResolvedValue({ ...mockTemplate, minOrders: null }) },
      waveOrder: { findMany: jest.fn().mockResolvedValue([]) },
      order: { findMany: jest.fn().mockResolvedValue([]) },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new ApplyWaveTemplateCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(APPLY_WAVE_TEMPLATE, { templateId: 'tpl-1' })
    );

    expect(result.success).toBe(true);
    expect(result.data?.skipped).toBe(true);
    expect(result.data?.skipReason).toContain('No eligible');
  });

  it('fails if template inactive', async () => {
    const tx = {
      waveTemplate: { findUnique: jest.fn().mockResolvedValue({ ...mockTemplate, active: false }) },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new ApplyWaveTemplateCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(APPLY_WAVE_TEMPLATE, { templateId: 'tpl-1' })
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('inactive');
  });

  it('caps orders at maxOrders', async () => {
    const smallMaxTemplate = { ...mockTemplate, minOrders: null, maxOrders: 2 };
    const mockWave = { id: 'wave-1', waveNumber: 'W-2026-04-16-001' };
    const tx = {
      waveTemplate: { findUnique: jest.fn().mockResolvedValue(smallMaxTemplate) },
      waveOrder: {
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      order: { findMany: jest.fn().mockResolvedValue([{ id: 'o1' }, { id: 'o2' }, { id: 'o3' }, { id: 'o4' }]) },
      orderLineItem: { count: jest.fn().mockResolvedValue(4) },
      wave: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue(mockWave),
      },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new ApplyWaveTemplateCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(APPLY_WAVE_TEMPLATE, { templateId: 'tpl-1' })
    );

    expect(result.success).toBe(true);
    expect(result.data?.orderCount).toBe(2); // Capped at maxOrders
  });
});
