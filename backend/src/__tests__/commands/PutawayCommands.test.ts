import { AssignPutawayTaskCommandHandler, ASSIGN_PUTAWAY_TASK } from '../../commands/warehouse/AssignPutawayTaskCommand';
import { CompletePutawayCommandHandler, COMPLETE_PUTAWAY } from '../../commands/warehouse/CompletePutawayCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

/* ── Mock Data ─────────────────────────────────────────────── */

const mockZone = { id: 'zone-1', name: 'Bulk A', zoneType: 'bulk_storage', temperatureZone: null, hazmatCertified: false };
const mockTargetBin = {
  id: 'bin-target', label: 'BULK-A-01-01', binType: 'pallet', active: true,
  temperatureZone: null, hazmatCertified: false, zone: mockZone,
  locationId: 'loc-1', currentPalletCount: 0, maxPalletPositions: 4,
};
const mockUnit = {
  id: 'unit-1', identifier: 'PLT-001', unitType: 'pallet', barcode: 'BC-001',
  lotNumber: 'LOT-A', expiryDate: null, qualityStatus: 'available',
  ownerCustomerId: null,
  lineItems: [{ sku: 'SKU-001', description: 'Widget', quantity: 10, weight: 5.0, temperature: null, hazmat: false }],
  order: { id: 'order-1' },
};
const mockTask = {
  id: 'task-1', locationId: 'loc-1', receivingTaskId: 'recv-1',
  trackableUnitId: 'unit-1', sourceBinId: 'bin-dock', targetBinId: 'bin-target',
  status: 'assigned', putawayType: 'directed', assignedToUserId: 'user-1',
  orgId: 'test-org', createdAt: new Date(), updatedAt: new Date(),
  targetBin: mockTargetBin,
};

/* ── AssignPutawayTaskCommandHandler ──────────────────────── */

describe('AssignPutawayTaskCommandHandler', () => {
  it('assigns task and emits PUTAWAY_TASK_ASSIGNED', async () => {
    const tx = {
      putawayTask: {
        findUnique: jest.fn().mockResolvedValue({ ...mockTask, status: 'pending', assignedToUserId: null }),
        update: jest.fn().mockResolvedValue({ ...mockTask, status: 'assigned', assignedToUserId: 'user-42' }),
      },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new AssignPutawayTaskCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(ASSIGN_PUTAWAY_TASK, { taskId: 'task-1', assignedToUserId: 'user-42' })
    );

    expect(result.success).toBe(true);
    expect(result.data?.assignedToUserId).toBe('user-42');
    expect(result.events).toHaveLength(1);
    expect(result.events[0].type).toBe(EVENT_TYPES.PUTAWAY_TASK_ASSIGNED);
  });

  it('fails if task is completed', async () => {
    const tx = {
      putawayTask: { findUnique: jest.fn().mockResolvedValue({ ...mockTask, status: 'completed' }) },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new AssignPutawayTaskCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(ASSIGN_PUTAWAY_TASK, { taskId: 'task-1', assignedToUserId: 'user-1' })
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('completed');
  });
});

/* ── CompletePutawayCommandHandler ────────────────────────── */

describe('CompletePutawayCommandHandler', () => {
  const buildTx = (overrides: any = {}) => ({
    putawayTask: {
      findUnique: jest.fn().mockResolvedValue({ ...mockTask, ...overrides.task }),
      update: jest.fn().mockResolvedValue({}),
    },
    warehouseBin: {
      findFirst: jest.fn().mockResolvedValue(overrides.scannedBin ?? mockTargetBin),
      update: jest.fn().mockResolvedValue({}),
    },
    trackableUnit: {
      findUnique: jest.fn().mockResolvedValue(overrides.unit ?? mockUnit),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    inventoryRecord: {
      findFirst: jest.fn().mockResolvedValue(overrides.existingInventory ?? null),
      create: jest.fn().mockResolvedValue({ id: 'inv-1', quantityOnHand: 10 }),
      update: jest.fn().mockResolvedValue({ id: 'inv-1', quantityOnHand: 20 }),
    },
    inventoryTransaction: {
      create: jest.fn().mockResolvedValue({ id: 'txn-1' }),
    },
    domainEventLog: { create: jest.fn().mockResolvedValue({}) },
  } as any);

  const buildPrisma = (tx: any) => ({
    $transaction: jest.fn((fn: Function) => fn(tx)),
    domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
  } as any);

  it('completes putaway at directed bin, creates inventory, updates unit location', async () => {
    const tx = buildTx();
    const prisma = buildPrisma(tx);
    const { bus } = mockEventBus();
    const handler = new CompletePutawayCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(COMPLETE_PUTAWAY, { taskId: 'task-1', scannedBinLabel: 'BULK-A-01-01' })
    );

    expect(result.success).toBe(true);
    expect(result.data?.deviation).toBe(false);
    expect(result.data?.actualBinLabel).toBe('BULK-A-01-01');
    expect(result.data?.constraintWarnings).toEqual([]);

    // Unit location updated
    expect(tx.trackableUnit.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ currentBinId: 'bin-target' }) })
    );

    // Inventory record created
    expect(tx.inventoryRecord.create).toHaveBeenCalled();
    expect(tx.inventoryTransaction.create).toHaveBeenCalled();

    // Bin capacity updated (pallet)
    expect(tx.warehouseBin.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ currentPalletCount: { increment: 1 } }) })
    );

    // Events
    const eventTypes = result.events.map(e => e.type);
    expect(eventTypes).toContain(EVENT_TYPES.PUTAWAY_TASK_COMPLETED);
    expect(eventTypes).toContain(EVENT_TYPES.INVENTORY_RECEIVED);
    expect(eventTypes).not.toContain(EVENT_TYPES.PUTAWAY_TASK_DEVIATION);
  });

  it('records deviation when scanned bin differs from target', async () => {
    const deviationBin = { ...mockTargetBin, id: 'bin-other', label: 'BULK-B-02-01' };
    const tx = buildTx({ scannedBin: deviationBin });
    const prisma = buildPrisma(tx);
    const { bus } = mockEventBus();
    const handler = new CompletePutawayCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(COMPLETE_PUTAWAY, { taskId: 'task-1', scannedBinLabel: 'BULK-B-02-01' })
    );

    expect(result.success).toBe(true);
    expect(result.data?.deviation).toBe(true);
    expect(result.data?.deviationReason).toContain('BULK-A-01-01');
    expect(result.data?.deviationReason).toContain('BULK-B-02-01');

    const eventTypes = result.events.map(e => e.type);
    expect(eventTypes).toContain(EVENT_TYPES.PUTAWAY_TASK_DEVIATION);
  });

  it('warns on temperature mismatch', async () => {
    const coldUnit = {
      ...mockUnit,
      lineItems: [{ ...mockUnit.lineItems[0], temperature: 'frozen' }],
    };
    const ambientBin = { ...mockTargetBin, temperatureZone: 'ambient', zone: { ...mockZone, temperatureZone: 'ambient' } };
    const tx = buildTx({ unit: coldUnit, scannedBin: ambientBin });
    const prisma = buildPrisma(tx);
    const { bus } = mockEventBus();
    const handler = new CompletePutawayCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(COMPLETE_PUTAWAY, { taskId: 'task-1', scannedBinLabel: 'BULK-A-01-01' })
    );

    expect(result.success).toBe(true);
    expect(result.data?.constraintWarnings).toEqual(
      expect.arrayContaining([expect.stringContaining('Temperature mismatch')])
    );
  });

  it('warns on hazmat in non-certified bin', async () => {
    const hazmatUnit = {
      ...mockUnit,
      lineItems: [{ ...mockUnit.lineItems[0], hazmat: true }],
    };
    const tx = buildTx({ unit: hazmatUnit });
    const prisma = buildPrisma(tx);
    const { bus } = mockEventBus();
    const handler = new CompletePutawayCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(COMPLETE_PUTAWAY, { taskId: 'task-1', scannedBinLabel: 'BULK-A-01-01' })
    );

    expect(result.success).toBe(true);
    expect(result.data?.constraintWarnings).toEqual(
      expect.arrayContaining([expect.stringContaining('Hazmat')])
    );
  });

  it('updates existing inventory record instead of creating new', async () => {
    const existingInv = { id: 'inv-existing', quantityOnHand: 5, sku: 'SKU-001' };
    const tx = buildTx({ existingInventory: existingInv });
    const prisma = buildPrisma(tx);
    const { bus } = mockEventBus();
    const handler = new CompletePutawayCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(COMPLETE_PUTAWAY, { taskId: 'task-1', scannedBinLabel: 'BULK-A-01-01' })
    );

    expect(result.success).toBe(true);
    // Should update, not create
    expect(tx.inventoryRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ quantityOnHand: { increment: 10 } }),
      })
    );
    expect(tx.inventoryRecord.create).not.toHaveBeenCalled();
  });

  it('fails if scanned bin not found at location', async () => {
    const tx = buildTx();
    tx.warehouseBin.findFirst.mockResolvedValue(null);
    const prisma = buildPrisma(tx);
    const { bus } = mockEventBus();
    const handler = new CompletePutawayCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(COMPLETE_PUTAWAY, { taskId: 'task-1', scannedBinLabel: 'NONEXISTENT' })
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('fails if task already completed', async () => {
    const tx = buildTx({ task: { status: 'completed' } });
    const prisma = buildPrisma(tx);
    const { bus } = mockEventBus();
    const handler = new CompletePutawayCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(COMPLETE_PUTAWAY, { taskId: 'task-1', scannedBinLabel: 'BULK-A-01-01' })
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('already completed');
  });
});
