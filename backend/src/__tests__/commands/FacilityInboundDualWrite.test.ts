/**
 * Phase 2a batch 2 (#225): every inbound row created against a Location must also carry the
 * facilityId derived from it, so the read switchover in a later batch finds no orphans.
 *
 * Also covers the org filters added to the same commands (#220): a bare id or a bare locationId
 * would let one tenant drive another's inbound work.
 */

import { CreateReceivingAppointmentCommandHandler, CREATE_RECEIVING_APPOINTMENT } from '../../commands/warehouse/CreateReceivingAppointmentCommand';
import { CreateReceivingTaskCommandHandler, CREATE_RECEIVING_TASK } from '../../commands/warehouse/CreateReceivingTaskCommand';
import { CreatePutawayRuleCommandHandler, CREATE_PUTAWAY_RULE } from '../../commands/warehouse/CreatePutawayRuleCommand';
import { CheckReplenishmentCommandHandler, CHECK_REPLENISHMENT } from '../../commands/warehouse/CheckReplenishmentCommand';
import { CompleteReceivingCommandHandler, COMPLETE_RECEIVING } from '../../commands/warehouse/CompleteReceivingCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

const mockLocation = {
  name: 'Leeds DC', address1: '1 Depot Way', address2: null,
  city: 'Leeds', state: null, postalCode: 'LS1 1AA', country: 'GB',
};

function buildPrisma(opts: {
  existingFacility?: { id: string } | null;
  location?: any;
  replenishmentRules?: any[];
  pickFaceQty?: number;
  bulkInventory?: any;
  receivingTask?: any;
} = {}) {
  const tx = {
    facility: {
      findFirst: jest.fn().mockResolvedValue({ id: 'fac-1', sourceLocationId: 'loc-1' }),
      findUnique: jest.fn().mockResolvedValue(opts.existingFacility ?? null),
      create: jest.fn().mockResolvedValue({ id: 'fac-new', sourceLocationId: 'loc-1' }),
    },
    location: {
      findFirst: jest.fn().mockResolvedValue('location' in opts ? opts.location : mockLocation),
    },
    receivingAppointment: {
      create: jest.fn().mockResolvedValue({ id: 'appt-1', locationId: 'loc-1', scheduledAt: new Date('2026-10-01T09:00:00Z'), status: 'scheduled' }),
      findFirst: jest.fn().mockResolvedValue({ id: 'appt-1' }),
      update: jest.fn().mockResolvedValue({}),
    },
    receivingTask: {
      create: jest.fn().mockResolvedValue({ id: 'rt-1', locationId: 'loc-1', status: 'pending', receivingType: 'blind', crossDock: false, inboundShipmentId: null }),
      findFirst: jest.fn().mockResolvedValue('receivingTask' in opts ? opts.receivingTask : null),
      update: jest.fn().mockResolvedValue({}),
    },
    receivingLine: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
    putawayRule: {
      create: jest.fn().mockResolvedValue({ id: 'pr-1', name: 'Pharma to cold', locationId: 'loc-1', priority: 50, targetType: 'zone' }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    putawayTask: {
      create: jest.fn().mockResolvedValue({ id: 'pt-1' }),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    replenishmentRule: { findMany: jest.fn().mockResolvedValue(opts.replenishmentRules ?? []) },
    inventoryRecord: {
      findFirst: jest.fn()
        .mockResolvedValueOnce({ id: 'inv-pick', quantityOnHand: opts.pickFaceQty ?? 0 })
        .mockResolvedValue(opts.bulkInventory ?? null),
    },
    warehouseZone: { findFirst: jest.fn().mockResolvedValue({ id: 'zone-1' }) },
    warehouseBin: {
      findFirst: jest.fn().mockResolvedValue({ id: 'bin-1', label: 'BULK-A-01', zoneId: 'zone-1', walkSequence: 1 }),
      findUnique: jest.fn().mockResolvedValue({ label: 'PICK-A-01' }),
    },
    trackableUnit: { update: jest.fn().mockResolvedValue({}) },
    domainEventLog: { create: jest.fn().mockResolvedValue({}) },
  } as any;
  const prisma = {
    $transaction: jest.fn((fn: Function) => fn(tx)),
    domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
  } as any;
  return { prisma, tx };
}

const appointmentPayload = {
  facilityId: 'fac-1',
  scheduledAt: '2026-10-01T09:00:00Z',
  scheduledEndAt: '2026-10-01T11:00:00Z',
};
const receivingTaskPayload = { facilityId: 'fac-1', receivingType: 'blind' };
const putawayRulePayload = { facilityId: 'fac-1', name: 'Pharma to cold', targetType: 'zone', targetZoneId: 'zone-1' };

describe('Facility dual-write on inbound creates (#225)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('writes the named facility and its source location on the appointment', async () => {
    const { prisma, tx } = buildPrisma();
    const { bus } = mockEventBus();

    const result = await new CreateReceivingAppointmentCommandHandler(prisma, bus)
      .execute(createTestCommand(CREATE_RECEIVING_APPOINTMENT, appointmentPayload));

    expect(result.success).toBe(true);
    expect(tx.receivingAppointment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ facilityId: 'fac-1', locationId: 'loc-1' }) })
    );
    expect(result.events!.map(e => e.type)).toEqual([EVENT_TYPES.RECEIVING_APPOINTMENT_CREATED]);
  });

  it('reuses an existing facility for the receiving task rather than creating a second', async () => {
    const { prisma, tx } = buildPrisma({ existingFacility: { id: 'fac-1' } });
    const { bus } = mockEventBus();

    const result = await new CreateReceivingTaskCommandHandler(prisma, bus)
      .execute(createTestCommand(CREATE_RECEIVING_TASK, receivingTaskPayload));

    expect(result.success).toBe(true);
    expect(tx.facility.create).not.toHaveBeenCalled();
    expect(tx.receivingTask.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ facilityId: 'fac-1' }) })
    );
    expect(result.events!.map(e => e.type)).toEqual([EVENT_TYPES.RECEIVING_TASK_CREATED]);
  });

  it('files the putaway rule under the facility', async () => {
    const { prisma, tx } = buildPrisma({ existingFacility: { id: 'fac-1' } });
    const { bus } = mockEventBus();

    const result = await new CreatePutawayRuleCommandHandler(prisma, bus)
      .execute(createTestCommand(CREATE_PUTAWAY_RULE, putawayRulePayload));

    expect(result.success).toBe(true);
    expect(tx.putawayRule.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ facilityId: 'fac-1' }) })
    );
  });

  it('looks the facility up within the calling org', async () => {
    const { prisma, tx } = buildPrisma();
    const { bus } = mockEventBus();

    await new CreateReceivingTaskCommandHandler(prisma, bus)
      .execute(createTestCommand(CREATE_RECEIVING_TASK, receivingTaskPayload));

    expect(tx.facility.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'fac-1', orgId: 'test-org', archived: false } })
    );
  });

  it('fails the whole command when the facility belongs to another tenant', async () => {
    const { prisma, tx } = buildPrisma();
    tx.facility.findFirst.mockResolvedValue(null);
    const { bus } = mockEventBus();

    const result = await new CreateReceivingTaskCommandHandler(prisma, bus)
      .execute(createTestCommand(CREATE_RECEIVING_TASK, receivingTaskPayload));

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
    expect(tx.receivingTask.create).not.toHaveBeenCalled();
  });

  it('rejects a receiving task linked to another tenant s appointment', async () => {
    const { prisma, tx } = buildPrisma({ existingFacility: { id: 'fac-1' } });
    tx.receivingAppointment.findFirst.mockResolvedValue(null);
    const { bus } = mockEventBus();

    const result = await new CreateReceivingTaskCommandHandler(prisma, bus)
      .execute(createTestCommand(CREATE_RECEIVING_TASK, { ...receivingTaskPayload, appointmentId: 'appt-other' }));

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
    expect(tx.receivingTask.create).not.toHaveBeenCalled();
    expect(tx.receivingAppointment.update).not.toHaveBeenCalled();
  });
});

describe('Facility dual-write on generated putaway tasks (#225)', () => {
  beforeEach(() => jest.clearAllMocks());

  const replenishmentRule = {
    id: 'rr-1', sku: 'SKU-1', pickFaceBinId: 'bin-pick', bulkZoneId: 'zone-bulk',
    minQuantity: 10, maxQuantity: 100,
  };

  it('stamps the facility on a replenishment putaway task', async () => {
    const { prisma, tx } = buildPrisma({
      existingFacility: { id: 'fac-1' },
      replenishmentRules: [replenishmentRule],
      pickFaceQty: 2,
      bulkInventory: { id: 'inv-bulk', binId: 'bin-bulk', quantityAvailable: 50, bin: { id: 'bin-bulk' } },
    });
    const { bus } = mockEventBus();

    const result = await new CheckReplenishmentCommandHandler(prisma, bus)
      .execute(createTestCommand(CHECK_REPLENISHMENT, { facilityId: 'fac-1' }));

    expect(result.success).toBe(true);
    expect(tx.putawayTask.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ facilityId: 'fac-1', putawayType: 'replenishment' }) })
    );
  });

  it('does not create a facility when a replenishment run produces no tasks', async () => {
    const { prisma, tx } = buildPrisma({ replenishmentRules: [] });
    const { bus } = mockEventBus();

    const result = await new CheckReplenishmentCommandHandler(prisma, bus)
      .execute(createTestCommand(CHECK_REPLENISHMENT, { facilityId: 'fac-1' }));

    expect(result.success).toBe(true);
    expect(tx.facility.findUnique).not.toHaveBeenCalled();
    expect(tx.facility.create).not.toHaveBeenCalled();
  });

  it('scopes the replenishment rule lookup to the calling org', async () => {
    const { prisma, tx } = buildPrisma({ replenishmentRules: [] });
    const { bus } = mockEventBus();

    await new CheckReplenishmentCommandHandler(prisma, bus)
      .execute(createTestCommand(CHECK_REPLENISHMENT, { facilityId: 'fac-1' }));

    expect(tx.replenishmentRule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ orgId: 'test-org', locationId: 'loc-1' }) })
    );
  });

  it('stamps the facility on putaway tasks generated by completing a receiving task', async () => {
    const { prisma, tx } = buildPrisma({
      existingFacility: { id: 'fac-1' },
      receivingTask: {
        id: 'rt-1', locationId: 'loc-1', status: 'in_progress', crossDock: false,
        appointmentId: null, dockBinId: null,
        lines: [{ id: 'rl-1', trackableUnitId: 'tu-1', receivedQuantity: 5, damagedQuantity: 0 }],
      },
    });
    const { bus } = mockEventBus();

    const result = await new CompleteReceivingCommandHandler(prisma, bus)
      .execute(createTestCommand(COMPLETE_RECEIVING, { taskId: 'rt-1' }));

    expect(result.success).toBe(true);
    expect(tx.putawayTask.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ facilityId: 'fac-1', receivingTaskId: 'rt-1' }) })
    );
  });

  it('refuses to complete a receiving task belonging to another tenant', async () => {
    const { prisma, tx } = buildPrisma({ receivingTask: null });
    const { bus } = mockEventBus();

    const result = await new CompleteReceivingCommandHandler(prisma, bus)
      .execute(createTestCommand(COMPLETE_RECEIVING, { taskId: 'rt-other' }));

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
    expect(tx.receivingTask.update).not.toHaveBeenCalled();
    expect(tx.receivingTask.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'rt-other', orgId: 'test-org' } })
    );
  });
});
