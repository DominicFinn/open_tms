/**
 * Phase 2a batch 3 (#227): every outbound row created against a Location must also carry the
 * facilityId derived from it, so the read switchover in a later batch finds no orphans.
 *
 * Also covers the org filters added to the same commands (#220). The worst of them was
 * ReleaseWave allocating inventory on locationId and SKU alone, which hard-allocated another
 * tenant's stock and decremented their quantityAvailable.
 */

import { CreatePackTaskCommandHandler, CREATE_PACK_TASK } from '../../commands/warehouse/CreatePackTaskCommand';
import { CreateStagingAssignmentCommandHandler, CREATE_STAGING_ASSIGNMENT } from '../../commands/warehouse/CreateStagingAssignmentCommand';
import { ReleaseWaveCommandHandler, RELEASE_WAVE } from '../../commands/warehouse/ReleaseWaveCommand';
import { CompleteReceivingCommandHandler, COMPLETE_RECEIVING } from '../../commands/warehouse/CompleteReceivingCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus, facilityMocks } from '../helpers/testUtils';

function buildPrisma(opts: {
  existingFacility?: { id: string } | null;
  wave?: any;
  demandLines?: any[];
  inventory?: any[];
  receivingTask?: any;
  stagingBin?: any;
  trackableUnit?: any;
} = {}) {
  const tx = {
    ...facilityMocks(opts.existingFacility === null ? null : (opts.existingFacility?.id ?? 'fac-1')),
    packTask: { create: jest.fn().mockResolvedValue({ id: 'pk-1', status: 'pending', orderId: 'ord-1' }) },
    packLine: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    stagingAssignment: { create: jest.fn().mockResolvedValue({ id: 'sa-1', status: 'staged' }) },
    pickTask: { create: jest.fn().mockResolvedValue({ id: 'pt-1' }) },
    pickLine: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    wave: {
      findFirst: jest.fn().mockResolvedValue('wave' in opts ? opts.wave : null),
      update: jest.fn().mockResolvedValue({}),
    },
    wmsFulfilmentOrderLine: { findMany: jest.fn().mockResolvedValue(opts.demandLines ?? []) },
    inventoryRecord: {
      findMany: jest.fn().mockResolvedValue(opts.inventory ?? []),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
    },
    allocation: { create: jest.fn().mockResolvedValue({ id: 'alloc-1' }) },
    warehouseBin: {
      findFirst: jest.fn().mockResolvedValue(
        'stagingBin' in opts ? opts.stagingBin : { id: 'bin-stage', label: 'STAGE-01', zoneId: 'zone-1', active: true, walkSequence: 1 }
      ),
      findUnique: jest.fn().mockResolvedValue({ label: 'STAGE-01' }),
    },
    trackableUnit: {
      findFirst: jest.fn().mockResolvedValue('trackableUnit' in opts ? opts.trackableUnit : { id: 'tu-1' }),
      update: jest.fn().mockResolvedValue({}),
    },
    receivingTask: {
      findFirst: jest.fn().mockResolvedValue('receivingTask' in opts ? opts.receivingTask : null),
      update: jest.fn().mockResolvedValue({}),
    },
    receivingAppointment: { update: jest.fn().mockResolvedValue({}) },
    orderLineItem: { findUnique: jest.fn().mockResolvedValue({ orderId: 'ord-1' }) },
    putawayRule: { findMany: jest.fn().mockResolvedValue([]) },
    putawayTask: { create: jest.fn().mockResolvedValue({ id: 'pt-1' }) },
    domainEventLog: { create: jest.fn().mockResolvedValue({}) },
  } as any;
  const prisma = {
    $transaction: jest.fn((fn: Function) => fn(tx)),
    domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
  } as any;
  return { prisma, tx };
}

const packPayload = {
  facilityId: 'fac-1',
  orderId: 'ord-1',
  lines: [{ orderLineItemId: 'oli-1', trackableUnitId: 'tu-1', sku: 'SKU-1', expectedQuantity: 2 }],
};
const stagingPayload = {
  facilityId: 'fac-1', orderId: 'ord-1', trackableUnitId: 'tu-1', stagingBinId: 'bin-stage',
};

describe('Facility dual-write on outbound creates (#227)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('writes the named facility and its source location on the pack task', async () => {
    const { prisma, tx } = buildPrisma();
    const { bus } = mockEventBus();

    const result = await new CreatePackTaskCommandHandler(prisma, bus)
      .execute(createTestCommand(CREATE_PACK_TASK, packPayload));

    expect(result.success).toBe(true);
    expect(tx.packTask.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ facilityId: 'fac-1', locationId: 'loc-1' }) })
    );
    expect(result.events!.map(e => e.type)).toEqual([EVENT_TYPES.PACK_TASK_CREATED]);
  });

  it('reuses an existing facility for the staging assignment', async () => {
    const { prisma, tx } = buildPrisma();
    const { bus } = mockEventBus();

    const result = await new CreateStagingAssignmentCommandHandler(prisma, bus)
      .execute(createTestCommand(CREATE_STAGING_ASSIGNMENT, stagingPayload));

    expect(result.success).toBe(true);
    expect(tx.facility.create).not.toHaveBeenCalled();
    expect(tx.stagingAssignment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ facilityId: 'fac-1' }) })
    );
  });

  it('refuses to stage into another tenant s bin', async () => {
    const { prisma, tx } = buildPrisma({ stagingBin: null });
    const { bus } = mockEventBus();

    const result = await new CreateStagingAssignmentCommandHandler(prisma, bus)
      .execute(createTestCommand(CREATE_STAGING_ASSIGNMENT, stagingPayload));

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
    expect(tx.stagingAssignment.create).not.toHaveBeenCalled();
    expect(tx.trackableUnit.update).not.toHaveBeenCalled();
    expect(tx.warehouseBin.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'bin-stage', orgId: 'test-org' } })
    );
  });

  it('refuses to move another tenant s trackable unit', async () => {
    const { prisma, tx } = buildPrisma({ trackableUnit: null });
    const { bus } = mockEventBus();

    const result = await new CreateStagingAssignmentCommandHandler(prisma, bus)
      .execute(createTestCommand(CREATE_STAGING_ASSIGNMENT, stagingPayload));

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
    expect(tx.stagingAssignment.create).not.toHaveBeenCalled();
    expect(tx.trackableUnit.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'tu-1', order: { orgId: 'test-org' } } })
    );
  });

  it('fails the whole command when the location belongs to another tenant', async () => {
    const { prisma, tx } = buildPrisma({ existingFacility: null });
    tx.location.findFirst.mockResolvedValue(null);
    const { bus } = mockEventBus();

    const result = await new CreatePackTaskCommandHandler(prisma, bus)
      .execute(createTestCommand(CREATE_PACK_TASK, packPayload));

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
    expect(tx.packTask.create).not.toHaveBeenCalled();
  });
});

describe('Facility dual-write on wave release (#227)', () => {
  beforeEach(() => jest.clearAllMocks());

  const wave = {
    id: 'wave-1', locationId: 'loc-1', orgId: 'test-org', status: 'planning',
    pickStrategy: 'discrete', waveOrders: [{ orderId: 'ord-1', priority: 1 }],
  };
  const demandLines = [{
    sourceLineId: 'oli-1', sku: 'SKU-1', quantity: 2,
    fulfilmentOrder: { sourceId: 'ord-1' },
  }];
  const inventory = [{
    id: 'inv-1', quantityAvailable: 10, uomCode: 'EA', lotNumber: null,
    bin: { id: 'bin-1', walkSequence: 1 },
  }];

  it('stamps the facility on pick tasks created by releasing a wave', async () => {
    const { prisma, tx } = buildPrisma({ wave, demandLines, inventory });
    const { bus } = mockEventBus();

    const result = await new ReleaseWaveCommandHandler(prisma, bus)
      .execute(createTestCommand(RELEASE_WAVE, { waveId: 'wave-1' }));

    expect(result.success).toBe(true);
    expect(tx.pickTask.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ facilityId: 'fac-1', locationId: 'loc-1' }) })
    );
  });

  it('allocates only inventory belonging to the calling org', async () => {
    const { prisma, tx } = buildPrisma({ wave, demandLines, inventory });
    const { bus } = mockEventBus();

    await new ReleaseWaveCommandHandler(prisma, bus)
      .execute(createTestCommand(RELEASE_WAVE, { waveId: 'wave-1' }));

    expect(tx.inventoryRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ orgId: 'test-org', locationId: 'loc-1', sku: 'SKU-1' }),
      })
    );
  });

  it('refuses to release a wave belonging to another tenant', async () => {
    const { prisma, tx } = buildPrisma({ wave: null });
    const { bus } = mockEventBus();

    const result = await new ReleaseWaveCommandHandler(prisma, bus)
      .execute(createTestCommand(RELEASE_WAVE, { waveId: 'wave-other' }));

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
    expect(tx.pickTask.create).not.toHaveBeenCalled();
    expect(tx.wave.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'wave-other', orgId: 'test-org' } })
    );
  });
});

describe('Facility dual-write on cross-dock staging (#227)', () => {
  beforeEach(() => jest.clearAllMocks());

  const crossDockTask = {
    id: 'rt-1', locationId: 'loc-1', status: 'in_progress', crossDock: true,
    appointmentId: null, dockBinId: null,
    lines: [{ id: 'rl-1', trackableUnitId: 'tu-1', orderLineItemId: 'oli-1', receivedQuantity: 5, damagedQuantity: 0 }],
  };

  it('stamps the facility on staging assignments created by a cross-dock receipt', async () => {
    const { prisma, tx } = buildPrisma({ receivingTask: crossDockTask });
    const { bus } = mockEventBus();

    const result = await new CompleteReceivingCommandHandler(prisma, bus)
      .execute(createTestCommand(COMPLETE_RECEIVING, { taskId: 'rt-1' }));

    expect(result.success).toBe(true);
    expect(tx.stagingAssignment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ facilityId: 'fac-1', locationId: 'loc-1' }) })
    );
    expect(tx.putawayTask.create).not.toHaveBeenCalled();
  });

  it('does not derive a facility when a receipt has nothing to put away or stage', async () => {
    const { prisma, tx } = buildPrisma({
      receivingTask: { ...crossDockTask, lines: [{ id: 'rl-1', trackableUnitId: null, receivedQuantity: 0, damagedQuantity: 0 }] },
    });
    const { bus } = mockEventBus();

    const result = await new CompleteReceivingCommandHandler(prisma, bus)
      .execute(createTestCommand(COMPLETE_RECEIVING, { taskId: 'rt-1' }));

    expect(result.success).toBe(true);
    expect(tx.facility.findUnique).not.toHaveBeenCalled();
    expect(tx.facility.create).not.toHaveBeenCalled();
  });
});
