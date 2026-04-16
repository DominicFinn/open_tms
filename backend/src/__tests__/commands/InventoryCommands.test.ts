import { AdjustInventoryCommandHandler, ADJUST_INVENTORY } from '../../commands/warehouse/AdjustInventoryCommand';
import { TransferInventoryCommandHandler, TRANSFER_INVENTORY } from '../../commands/warehouse/TransferInventoryCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

/* ── Mock Data ─────────────────────────────────────────────── */

const mockRecord = {
  id: 'inv-1', locationId: 'loc-1', binId: 'bin-1', sku: 'SKU-001',
  uomCode: 'EA', quantityOnHand: 50, quantityAllocated: 10,
  quantityAvailable: 35, quantityOnHold: 5, ownerCustomerId: null,
  lotNumber: 'LOT-A', expiryDate: null, orgId: 'test-org',
  lastCountedAt: null, createdAt: new Date(), updatedAt: new Date(),
};

const mockTargetBin = {
  id: 'bin-2', label: 'BULK-B-01-01', active: true, locationId: 'loc-1',
  zone: { temperatureZone: null },
  temperatureZone: null,
};

/* ── AdjustInventoryCommandHandler ────────────────────────── */

describe('AdjustInventoryCommandHandler', () => {
  const buildTx = (overrides: any = {}) => ({
    inventoryRecord: {
      findUnique: jest.fn().mockResolvedValue(overrides.record ?? mockRecord),
      update: jest.fn().mockResolvedValue({}),
    },
    inventoryTransaction: { create: jest.fn().mockResolvedValue({ id: 'txn-1' }) },
    domainEventLog: { create: jest.fn().mockResolvedValue({}) },
  } as any);

  const buildPrisma = (tx: any) => ({
    $transaction: jest.fn((fn: Function) => fn(tx)),
    domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
  } as any);

  it('increases stock and emits INVENTORY_ADJUSTED', async () => {
    const tx = buildTx();
    const prisma = buildPrisma(tx);
    const { bus } = mockEventBus();
    const handler = new AdjustInventoryCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(ADJUST_INVENTORY, {
        inventoryRecordId: 'inv-1', quantityChange: 5, reasonCode: 'found',
      })
    );

    expect(result.success).toBe(true);
    expect(result.data?.previousQuantity).toBe(50);
    expect(result.data?.newQuantity).toBe(55);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].type).toBe(EVENT_TYPES.INVENTORY_ADJUSTED);

    expect(tx.inventoryRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ quantityOnHand: 55 }) })
    );
    expect(tx.inventoryTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          transactionType: 'adjust', quantityChange: 5, reasonCode: 'found',
        }),
      })
    );
  });

  it('decreases stock and records reason', async () => {
    const tx = buildTx();
    const prisma = buildPrisma(tx);
    const { bus } = mockEventBus();
    const handler = new AdjustInventoryCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(ADJUST_INVENTORY, {
        inventoryRecordId: 'inv-1', quantityChange: -3, reasonCode: 'damage',
      })
    );

    expect(result.success).toBe(true);
    expect(result.data?.newQuantity).toBe(47);
    expect(result.events[0].payload).toEqual(
      expect.objectContaining({ reasonCode: 'damage', quantityChange: -3 })
    );
  });

  it('fails if adjustment would go negative', async () => {
    const tx = buildTx();
    const prisma = buildPrisma(tx);
    const { bus } = mockEventBus();
    const handler = new AdjustInventoryCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(ADJUST_INVENTORY, {
        inventoryRecordId: 'inv-1', quantityChange: -100, reasonCode: 'scrap',
      })
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('negative');
  });

  it('fails if quantity change is zero', async () => {
    const tx = buildTx();
    const prisma = buildPrisma(tx);
    const { bus } = mockEventBus();
    const handler = new AdjustInventoryCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(ADJUST_INVENTORY, {
        inventoryRecordId: 'inv-1', quantityChange: 0, reasonCode: 'recount',
      })
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('zero');
  });

  it('fails if record not found', async () => {
    const notFoundTx = {
      inventoryRecord: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
      inventoryTransaction: { create: jest.fn() },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = buildPrisma(notFoundTx);
    const { bus } = mockEventBus();
    const handler = new AdjustInventoryCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(ADJUST_INVENTORY, {
        inventoryRecordId: 'missing', quantityChange: 1, reasonCode: 'found',
      })
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });
});

/* ── TransferInventoryCommandHandler ──────────────────────── */

describe('TransferInventoryCommandHandler', () => {
  const buildTx = (overrides: any = {}) => ({
    inventoryRecord: {
      findUnique: jest.fn().mockResolvedValue(overrides.source ?? mockRecord),
      findFirst: jest.fn().mockResolvedValue(overrides.targetRecord ?? null),
      update: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({ id: 'inv-new', quantityOnHand: 20 }),
      delete: jest.fn().mockResolvedValue({}),
    },
    warehouseBin: {
      findUnique: jest.fn().mockResolvedValue(overrides.targetBin ?? mockTargetBin),
    },
    warehouseZone: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    inventoryTransaction: { create: jest.fn().mockResolvedValue({ id: 'txn-1' }) },
    domainEventLog: { create: jest.fn().mockResolvedValue({}) },
  } as any);

  const buildPrisma = (tx: any) => ({
    $transaction: jest.fn((fn: Function) => fn(tx)),
    domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
  } as any);

  it('transfers stock to new bin and emits INVENTORY_TRANSFERRED', async () => {
    const tx = buildTx();
    const prisma = buildPrisma(tx);
    const { bus } = mockEventBus();
    const handler = new TransferInventoryCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(TRANSFER_INVENTORY, {
        inventoryRecordId: 'inv-1', targetBinId: 'bin-2', quantity: 20,
      })
    );

    expect(result.success).toBe(true);
    expect(result.data?.quantity).toBe(20);
    expect(result.data?.targetBinLabel).toBe('BULK-B-01-01');

    // Source deducted
    expect(tx.inventoryRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'inv-1' },
        data: expect.objectContaining({ quantityOnHand: 30 }),
      })
    );

    // Target created (no existing record)
    expect(tx.inventoryRecord.create).toHaveBeenCalled();

    // Two transactions (source debit + target credit)
    expect(tx.inventoryTransaction.create).toHaveBeenCalledTimes(2);

    expect(result.events).toHaveLength(1);
    expect(result.events[0].type).toBe(EVENT_TYPES.INVENTORY_TRANSFERRED);
  });

  it('transfers to existing inventory record at target bin', async () => {
    const existingTarget = { ...mockRecord, id: 'inv-target', binId: 'bin-2', quantityOnHand: 10 };
    const tx = buildTx({ targetRecord: existingTarget });
    const prisma = buildPrisma(tx);
    const { bus } = mockEventBus();
    const handler = new TransferInventoryCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(TRANSFER_INVENTORY, {
        inventoryRecordId: 'inv-1', targetBinId: 'bin-2', quantity: 5,
      })
    );

    expect(result.success).toBe(true);
    // Should update existing, not create
    expect(tx.inventoryRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'inv-target' },
        data: expect.objectContaining({ quantityOnHand: { increment: 5 } }),
      })
    );
    expect(tx.inventoryRecord.create).not.toHaveBeenCalled();
  });

  it('fails if insufficient available stock', async () => {
    const tx = buildTx();
    const prisma = buildPrisma(tx);
    const { bus } = mockEventBus();
    const handler = new TransferInventoryCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(TRANSFER_INVENTORY, {
        inventoryRecordId: 'inv-1', targetBinId: 'bin-2', quantity: 100,
      })
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Insufficient');
  });

  it('fails if target bin not found', async () => {
    const notFoundTx = {
      inventoryRecord: {
        findUnique: jest.fn().mockResolvedValue(mockRecord),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      warehouseBin: { findUnique: jest.fn().mockResolvedValue(null) },
      warehouseZone: { findFirst: jest.fn().mockResolvedValue(null) },
      inventoryTransaction: { create: jest.fn() },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = buildPrisma(notFoundTx);
    const { bus } = mockEventBus();
    const handler = new TransferInventoryCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(TRANSFER_INVENTORY, {
        inventoryRecordId: 'inv-1', targetBinId: 'missing', quantity: 5,
      })
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('fails if source and target bin are the same', async () => {
    const sameBin = { ...mockTargetBin, id: 'bin-1' };
    const tx = buildTx({ targetBin: sameBin });
    const prisma = buildPrisma(tx);
    const { bus } = mockEventBus();
    const handler = new TransferInventoryCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(TRANSFER_INVENTORY, {
        inventoryRecordId: 'inv-1', targetBinId: 'bin-1', quantity: 5,
      })
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('same');
  });

  it('cleans up empty source record after full transfer', async () => {
    const emptySource = { ...mockRecord, quantityOnHand: 10, quantityAllocated: 0, quantityOnHold: 0, quantityAvailable: 10 };
    const tx = buildTx({ source: emptySource });
    const prisma = buildPrisma(tx);
    const { bus } = mockEventBus();
    const handler = new TransferInventoryCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(TRANSFER_INVENTORY, {
        inventoryRecordId: 'inv-1', targetBinId: 'bin-2', quantity: 10,
      })
    );

    expect(result.success).toBe(true);
    expect(tx.inventoryRecord.delete).toHaveBeenCalledWith({ where: { id: 'inv-1' } });
  });
});
