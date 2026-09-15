/**
 * #220: these five writes used to happen straight from a route handler by bare id, with no tenant
 * check. Each test pins the org scope on the authoritative read inside the transaction.
 */

import { CreatePutawayRuleCommandHandler, CREATE_PUTAWAY_RULE } from '../../commands/warehouse/CreatePutawayRuleCommand';
import { CreateReceivingAppointmentCommandHandler, CREATE_RECEIVING_APPOINTMENT } from '../../commands/warehouse/CreateReceivingAppointmentCommand';
import { CheckInAppointmentCommandHandler, CHECK_IN_APPOINTMENT } from '../../commands/warehouse/CheckInAppointmentCommand';
import { CancelAppointmentCommandHandler, CANCEL_APPOINTMENT } from '../../commands/warehouse/CancelAppointmentCommand';
import { InspectReceivingLineCommandHandler, INSPECT_RECEIVING_LINE } from '../../commands/warehouse/InspectReceivingLineCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus, facilityMocks } from '../helpers/testUtils';

const appointment = {
  id: 'appt-1', orgId: 'test-org', locationId: 'loc-1', status: 'scheduled',
  dockBinId: null, trailerNumber: null, sealNumber: null,
  scheduledAt: new Date('2026-09-07T09:00:00Z'),
};

function buildPrisma(overrides: any = {}) {
  const tx = {
      ...facilityMocks(),
    putawayRule: { create: jest.fn().mockResolvedValue({ id: 'rule-1', name: 'Cold to zone C', locationId: 'loc-1', priority: 50, targetType: 'zone' }) },
    receivingAppointment: {
      findFirst: jest.fn().mockResolvedValue('appointment' in overrides ? overrides.appointment : appointment),
      create: jest.fn().mockResolvedValue({ ...appointment, id: 'appt-new' }),
      update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ ...appointment, ...data })),
    },
    receivingLine: {
      findFirst: jest.fn().mockResolvedValue('line' in overrides ? overrides.line : { id: 'line-1', inspectionStatus: 'pending', receivingTaskId: 'task-1', sku: 'SKU-1' }),
      update: jest.fn().mockResolvedValue({ id: 'line-1', inspectionStatus: 'pass', receivingTaskId: 'task-1', sku: 'SKU-1' }),
    },
    warehouseZone: { findFirst: jest.fn().mockResolvedValue('zone' in overrides ? overrides.zone : { id: 'zone-1' }) },
    warehouseBin: { findFirst: jest.fn().mockResolvedValue('bin' in overrides ? overrides.bin : { id: 'bin-1' }) },
    domainEventLog: { create: jest.fn().mockResolvedValue({}) },
  } as any;
  const prisma = {
    $transaction: jest.fn((fn: Function) => fn(tx)),
    domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
  } as any;
  return { prisma, tx };
}

describe('CreatePutawayRuleCommandHandler', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates the rule with the caller org and emits PUTAWAY_RULE_CREATED', async () => {
    const { prisma, tx } = buildPrisma();
    const { bus } = mockEventBus();

    const result = await new CreatePutawayRuleCommandHandler(prisma, bus).execute(
      createTestCommand(CREATE_PUTAWAY_RULE, { facilityId: 'fac-1', name: 'Cold to zone C', targetType: 'zone' })
    );

    expect(result.success).toBe(true);
    expect(tx.putawayRule.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ orgId: 'test-org', priority: 50 }) })
    );
    expect(result.events![0].type).toBe(EVENT_TYPES.PUTAWAY_RULE_CREATED);
  });

  it('refuses a target zone belonging to another tenant', async () => {
    const { prisma, tx } = buildPrisma({ zone: null });
    const { bus } = mockEventBus();

    const result = await new CreatePutawayRuleCommandHandler(prisma, bus).execute(
      createTestCommand(CREATE_PUTAWAY_RULE, { facilityId: 'fac-1', name: 'Rule', targetType: 'zone', targetZoneId: 'other-org-zone' })
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
    expect(tx.warehouseZone.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'other-org-zone', orgId: 'test-org' } })
    );
    expect(tx.putawayRule.create).not.toHaveBeenCalled();
  });

  it('refuses a target bin belonging to another tenant', async () => {
    const { prisma, tx } = buildPrisma({ bin: null });
    const { bus } = mockEventBus();

    const result = await new CreatePutawayRuleCommandHandler(prisma, bus).execute(
      createTestCommand(CREATE_PUTAWAY_RULE, { facilityId: 'fac-1', name: 'Rule', targetType: 'specific_bin', targetBinId: 'other-org-bin' })
    );

    expect(result.success).toBe(false);
    expect(tx.putawayRule.create).not.toHaveBeenCalled();
  });
});

describe('CreateReceivingAppointmentCommandHandler', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates the appointment and emits RECEIVING_APPOINTMENT_CREATED with no carrier contact detail', async () => {
    const { prisma, tx } = buildPrisma();
    const { bus } = mockEventBus();

    const result = await new CreateReceivingAppointmentCommandHandler(prisma, bus).execute(
      createTestCommand(CREATE_RECEIVING_APPOINTMENT, {
        facilityId: 'fac-1',
        scheduledAt: '2026-09-07T09:00:00Z',
        scheduledEndAt: '2026-09-07T10:00:00Z',
        carrierName: 'A Haulier',
      })
    );

    expect(result.success).toBe(true);
    expect(tx.receivingAppointment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ orgId: 'test-org' }) })
    );
    expect(result.events![0].type).toBe(EVENT_TYPES.RECEIVING_APPOINTMENT_CREATED);
    expect(JSON.stringify(result.events![0].payload)).not.toContain('A Haulier');
  });

  it('rejects a window that ends before it starts', async () => {
    const { prisma, tx } = buildPrisma();
    const { bus } = mockEventBus();

    const result = await new CreateReceivingAppointmentCommandHandler(prisma, bus).execute(
      createTestCommand(CREATE_RECEIVING_APPOINTMENT, {
        facilityId: 'fac-1',
        scheduledAt: '2026-09-07T10:00:00Z',
        scheduledEndAt: '2026-09-07T09:00:00Z',
      })
    );

    expect(result.success).toBe(false);
    expect(tx.receivingAppointment.create).not.toHaveBeenCalled();
  });

  it('refuses a dock bin belonging to another tenant', async () => {
    const { prisma, tx } = buildPrisma({ bin: null });
    const { bus } = mockEventBus();

    const result = await new CreateReceivingAppointmentCommandHandler(prisma, bus).execute(
      createTestCommand(CREATE_RECEIVING_APPOINTMENT, {
        facilityId: 'fac-1',
        scheduledAt: '2026-09-07T09:00:00Z',
        scheduledEndAt: '2026-09-07T10:00:00Z',
        dockBinId: 'other-org-bin',
      })
    );

    expect(result.success).toBe(false);
    expect(tx.receivingAppointment.create).not.toHaveBeenCalled();
  });
});

describe('CheckInAppointmentCommandHandler', () => {
  beforeEach(() => jest.clearAllMocks());

  it('checks in and emits RECEIVING_APPOINTMENT_CHECKED_IN', async () => {
    const { prisma, tx } = buildPrisma();
    const { bus } = mockEventBus();

    const result = await new CheckInAppointmentCommandHandler(prisma, bus).execute(
      createTestCommand(CHECK_IN_APPOINTMENT, { appointmentId: 'appt-1', trailerNumber: 'T-1' })
    );

    expect(result.success).toBe(true);
    expect(tx.receivingAppointment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'checked_in', trailerNumber: 'T-1' }) })
    );
    expect(result.events![0].type).toBe(EVENT_TYPES.RECEIVING_APPOINTMENT_CHECKED_IN);
  });

  it('reads the appointment scoped by org, so another tenant s id misses', async () => {
    const { prisma, tx } = buildPrisma({ appointment: null });
    const { bus } = mockEventBus();

    const result = await new CheckInAppointmentCommandHandler(prisma, bus).execute(
      createTestCommand(CHECK_IN_APPOINTMENT, { appointmentId: 'other-org-appt' })
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
    expect(tx.receivingAppointment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'other-org-appt', orgId: 'test-org' } })
    );
    expect(tx.receivingAppointment.update).not.toHaveBeenCalled();
  });

  it('refuses to check in a cancelled appointment', async () => {
    const { prisma, tx } = buildPrisma({ appointment: { ...appointment, status: 'cancelled' } });
    const { bus } = mockEventBus();

    const result = await new CheckInAppointmentCommandHandler(prisma, bus).execute(
      createTestCommand(CHECK_IN_APPOINTMENT, { appointmentId: 'appt-1' })
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Cannot check in');
    expect(tx.receivingAppointment.update).not.toHaveBeenCalled();
  });
});

describe('CancelAppointmentCommandHandler', () => {
  beforeEach(() => jest.clearAllMocks());

  it('cancels and emits RECEIVING_APPOINTMENT_CANCELLED', async () => {
    const { prisma, tx } = buildPrisma();
    const { bus } = mockEventBus();

    const result = await new CancelAppointmentCommandHandler(prisma, bus).execute(
      createTestCommand(CANCEL_APPOINTMENT, { appointmentId: 'appt-1' })
    );

    expect(result.success).toBe(true);
    expect(tx.receivingAppointment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'cancelled' } })
    );
    expect(result.events![0].type).toBe(EVENT_TYPES.RECEIVING_APPOINTMENT_CANCELLED);
  });

  it('scopes the read by org', async () => {
    const { prisma, tx } = buildPrisma({ appointment: null });
    const { bus } = mockEventBus();

    const result = await new CancelAppointmentCommandHandler(prisma, bus).execute(
      createTestCommand(CANCEL_APPOINTMENT, { appointmentId: 'other-org-appt' })
    );

    expect(result.success).toBe(false);
    expect(tx.receivingAppointment.update).not.toHaveBeenCalled();
  });

  it('refuses to cancel a completed appointment', async () => {
    const { prisma, tx } = buildPrisma({ appointment: { ...appointment, status: 'completed' } });
    const { bus } = mockEventBus();

    const result = await new CancelAppointmentCommandHandler(prisma, bus).execute(
      createTestCommand(CANCEL_APPOINTMENT, { appointmentId: 'appt-1' })
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Cannot cancel');
    expect(tx.receivingAppointment.update).not.toHaveBeenCalled();
  });

  it('is a no-op on an already cancelled appointment', async () => {
    const { prisma, tx } = buildPrisma({ appointment: { ...appointment, status: 'cancelled' } });
    const { bus } = mockEventBus();

    const result = await new CancelAppointmentCommandHandler(prisma, bus).execute(
      createTestCommand(CANCEL_APPOINTMENT, { appointmentId: 'appt-1' })
    );

    expect(result.success).toBe(true);
    expect(tx.receivingAppointment.update).not.toHaveBeenCalled();
    expect(result.events).toHaveLength(0);
  });
});

describe('InspectReceivingLineCommandHandler', () => {
  beforeEach(() => jest.clearAllMocks());

  it('records the inspection and emits RECEIVING_LINE_INSPECTED', async () => {
    const { prisma, tx } = buildPrisma();
    const { bus } = mockEventBus();

    const result = await new InspectReceivingLineCommandHandler(prisma, bus).execute(
      createTestCommand(INSPECT_RECEIVING_LINE, { lineId: 'line-1', inspectionStatus: 'pass' })
    );

    expect(result.success).toBe(true);
    expect(result.events![0].type).toBe(EVENT_TYPES.RECEIVING_LINE_INSPECTED);
    expect((result.events![0].payload as any).previousStatus).toBe('pending');
  });

  it('scopes the line through its task org, since ReceivingLine has no orgId', async () => {
    const { prisma, tx } = buildPrisma({ line: null });
    const { bus } = mockEventBus();

    const result = await new InspectReceivingLineCommandHandler(prisma, bus).execute(
      createTestCommand(INSPECT_RECEIVING_LINE, { lineId: 'other-org-line', inspectionStatus: 'pass' })
    );

    expect(result.success).toBe(false);
    expect(tx.receivingLine.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'other-org-line', receivingTask: { orgId: 'test-org' } } })
    );
    expect(tx.receivingLine.update).not.toHaveBeenCalled();
  });
});
