/**
 * Phase 2a batch 4 (#229): waves and wave templates carry the facilityId derived from their
 * Location. This is the last of the WMS schema, so after this every model that references
 * Location has a facility beside it.
 *
 * Also covers the org filter added to ApplyWaveTemplate (#220): applying a template creates a
 * wave at that template's location, so a bare id lookup built our wave on another tenant's floor.
 */

import { CreateWaveCommandHandler, CREATE_WAVE } from '../../commands/warehouse/CreateWaveCommand';
import { CreateWaveTemplateCommandHandler, CREATE_WAVE_TEMPLATE } from '../../commands/warehouse/CreateWaveTemplateCommand';
import { ApplyWaveTemplateCommandHandler, APPLY_WAVE_TEMPLATE } from '../../commands/warehouse/ApplyWaveTemplateCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus, facilityMocks } from '../helpers/testUtils';

function buildPrisma(opts: {
  existingFacility?: { id: string } | null;
  template?: any;
  demandOrders?: any[];
} = {}) {
  const tx = {
    ...facilityMocks(opts.existingFacility === null ? null : (opts.existingFacility?.id ?? 'fac-1')),
    wave: {
      create: jest.fn().mockResolvedValue({ id: 'wave-1', waveNumber: 'W-2026-09-07-001', status: 'planning' }),
      count: jest.fn().mockResolvedValue(0),
    },
    waveTemplate: {
      create: jest.fn().mockResolvedValue({ id: 'wt-1', name: 'Morning pick', locationId: 'loc-1' }),
      findFirst: jest.fn().mockResolvedValue('template' in opts ? opts.template : null),
    },
    waveOrder: {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    wmsFulfilmentOrder: { findMany: jest.fn().mockResolvedValue(opts.demandOrders ?? []) },
    wmsFulfilmentOrderLine: { count: jest.fn().mockResolvedValue(3) },
    domainEventLog: { create: jest.fn().mockResolvedValue({}) },
  } as any;
  const prisma = {
    $transaction: jest.fn((fn: Function) => fn(tx)),
    domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
  } as any;
  return { prisma, tx };
}

const wavePayload = { locationId: 'loc-1', pickStrategy: 'discrete', orderIds: ['ord-1'] };
const templatePayload = { locationId: 'loc-1', name: 'Morning pick', pickStrategy: 'discrete' };

describe('Facility dual-write on wave creates (#229)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('derives a facility from the location and files the wave under it', async () => {
    const { prisma, tx } = buildPrisma({ existingFacility: null });
    const { bus } = mockEventBus();

    const result = await new CreateWaveCommandHandler(prisma, bus)
      .execute(createTestCommand(CREATE_WAVE, wavePayload));

    expect(result.success).toBe(true);
    expect(tx.facility.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ orgId: 'test-org', sourceLocationId: 'loc-1' }) })
    );
    expect(tx.wave.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ facilityId: 'fac-new', locationId: 'loc-1' }) })
    );
    expect(result.events!.map(e => e.type)).toEqual([
      EVENT_TYPES.FACILITY_CREATED,
      EVENT_TYPES.WAVE_CREATED,
    ]);
  });

  it('reuses an existing facility for the wave template', async () => {
    const { prisma, tx } = buildPrisma();
    const { bus } = mockEventBus();

    const result = await new CreateWaveTemplateCommandHandler(prisma, bus)
      .execute(createTestCommand(CREATE_WAVE_TEMPLATE, templatePayload));

    expect(result.success).toBe(true);
    expect(tx.facility.create).not.toHaveBeenCalled();
    expect(tx.waveTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ facilityId: 'fac-1' }) })
    );
  });

  it('fails the whole command when the location belongs to another tenant', async () => {
    const { prisma, tx } = buildPrisma({ existingFacility: null });
    tx.location.findFirst.mockResolvedValue(null);
    const { bus } = mockEventBus();

    const result = await new CreateWaveCommandHandler(prisma, bus)
      .execute(createTestCommand(CREATE_WAVE, wavePayload));

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
    expect(tx.wave.create).not.toHaveBeenCalled();
  });
});

describe('Facility dual-write on template application (#229)', () => {
  beforeEach(() => jest.clearAllMocks());

  const template = {
    id: 'wt-1', name: 'Morning pick', locationId: 'loc-1', orgId: 'test-org',
    active: true, pickStrategy: 'discrete', groupingRules: null,
    cutoffTime: null, minOrders: null, maxOrders: null,
  };
  const demandOrders = [{ sourceId: 'ord-1', lineCount: 3 }];

  it('stamps the facility on a wave created from a template', async () => {
    const { prisma, tx } = buildPrisma({ template, demandOrders });
    const { bus } = mockEventBus();

    const result = await new ApplyWaveTemplateCommandHandler(prisma, bus)
      .execute(createTestCommand(APPLY_WAVE_TEMPLATE, { templateId: 'wt-1' }));

    expect(result.success).toBe(true);
    expect(result.data?.skipped).toBe(false);
    expect(tx.wave.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ facilityId: 'fac-1', locationId: 'loc-1' }) })
    );
  });

  it('refuses to apply another tenant s template', async () => {
    const { prisma, tx } = buildPrisma({ template: null });
    const { bus } = mockEventBus();

    const result = await new ApplyWaveTemplateCommandHandler(prisma, bus)
      .execute(createTestCommand(APPLY_WAVE_TEMPLATE, { templateId: 'wt-other' }));

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
    expect(tx.wave.create).not.toHaveBeenCalled();
    expect(tx.waveTemplate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'wt-other', orgId: 'test-org' } })
    );
  });

  it('does not derive a facility when a template run finds no eligible orders', async () => {
    const { prisma, tx } = buildPrisma({ template, demandOrders: [] });
    const { bus } = mockEventBus();

    const result = await new ApplyWaveTemplateCommandHandler(prisma, bus)
      .execute(createTestCommand(APPLY_WAVE_TEMPLATE, { templateId: 'wt-1' }));

    expect(result.success).toBe(true);
    expect(result.data?.skipped).toBe(true);
    expect(tx.facility.findUnique).not.toHaveBeenCalled();
    expect(tx.facility.create).not.toHaveBeenCalled();
  });
});
