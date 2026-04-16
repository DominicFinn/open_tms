import { CreateCycleCountCommandHandler, CREATE_CYCLE_COUNT } from '../../commands/warehouse/CreateCycleCountCommand';
import { RecordCycleCountLineCommandHandler, RECORD_CYCLE_COUNT_LINE } from '../../commands/warehouse/RecordCycleCountLineCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

/* ── CreateCycleCountCommandHandler ────────────────────────── */

describe('CreateCycleCountCommandHandler', () => {
  it('creates a full cycle count from inventory records', async () => {
    const mockInvRecords = [
      { id: 'inv-1', binId: 'bin-1', sku: 'SKU-001', uomCode: 'EA', quantityOnHand: 50, bin: { id: 'bin-1', label: 'A-01' } },
      { id: 'inv-2', binId: 'bin-2', sku: 'SKU-002', uomCode: 'EA', quantityOnHand: 30, bin: { id: 'bin-2', label: 'A-02' } },
    ];
    const mockCount = { id: 'cc-1', totalBins: 2, status: 'planned', orgId: 'test-org' };
    const tx = {
      inventoryRecord: { findMany: jest.fn().mockResolvedValue(mockInvRecords) },
      cycleCount: { create: jest.fn().mockResolvedValue(mockCount) },
      cycleCountLine: { createMany: jest.fn().mockResolvedValue({ count: 2 }) },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new CreateCycleCountCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(CREATE_CYCLE_COUNT, { locationId: 'loc-1', countType: 'full' })
    );

    expect(result.success).toBe(true);
    expect(result.data?.totalBins).toBe(2);
    expect(result.events[0].type).toBe(EVENT_TYPES.CYCLE_COUNT_CREATED);
    expect(tx.cycleCountLine.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ sku: 'SKU-001', expectedQuantity: 50 }),
        ]),
      })
    );
  });

  it('fails if no inventory to count', async () => {
    const tx = {
      inventoryRecord: { findMany: jest.fn().mockResolvedValue([]) },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new CreateCycleCountCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(CREATE_CYCLE_COUNT, { locationId: 'loc-1', countType: 'full' })
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('No inventory');
  });
});

/* ── RecordCycleCountLineCommandHandler ────────────────────── */

describe('RecordCycleCountLineCommandHandler', () => {
  const mockCount = {
    id: 'cc-1', locationId: 'loc-1', status: 'planned', totalBins: 2, countedBins: 0, orgId: 'test-org',
  };
  const mockLine = {
    id: 'ccl-1', cycleCountId: 'cc-1', binId: 'bin-1', sku: 'SKU-001',
    expectedQuantity: 50, countedQuantity: null, variance: null,
    status: 'pending', inventoryRecordId: 'inv-1',
    cycleCount: mockCount,
  };

  it('records a count with no variance', async () => {
    const tx = {
      cycleCountLine: {
        findUnique: jest.fn().mockResolvedValue(mockLine),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn()
          .mockResolvedValueOnce(1)  // countedBins
          .mockResolvedValueOnce(0), // varianceCount
      },
      cycleCount: { update: jest.fn().mockResolvedValue({}) },
      inventoryRecord: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      inventoryTransaction: { create: jest.fn() },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new RecordCycleCountLineCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(RECORD_CYCLE_COUNT_LINE, { lineId: 'ccl-1', countedQuantity: 50 })
    );

    expect(result.success).toBe(true);
    expect(result.data?.variance).toBe(0);
    // Auto-started the count
    expect(result.events.some(e => e.type === EVENT_TYPES.CYCLE_COUNT_STARTED)).toBe(true);
    expect(result.events.some(e => e.type === EVENT_TYPES.CYCLE_COUNT_LINE_RECORDED)).toBe(true);
    // No variance event
    expect(result.events.some(e => e.type === EVENT_TYPES.CYCLE_COUNT_VARIANCE_DETECTED)).toBe(false);
  });

  it('detects variance and emits variance event', async () => {
    const tx = {
      cycleCountLine: {
        findUnique: jest.fn().mockResolvedValue({ ...mockLine, cycleCount: { ...mockCount, status: 'in_progress' } }),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn()
          .mockResolvedValueOnce(1)  // countedBins
          .mockResolvedValueOnce(1), // varianceCount
      },
      cycleCount: { update: jest.fn().mockResolvedValue({}) },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new RecordCycleCountLineCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(RECORD_CYCLE_COUNT_LINE, { lineId: 'ccl-1', countedQuantity: 45 })
    );

    expect(result.success).toBe(true);
    expect(result.data?.variance).toBe(-5);
    expect(result.events.some(e => e.type === EVENT_TYPES.CYCLE_COUNT_VARIANCE_DETECTED)).toBe(true);
  });

  it('auto-completes count and adjusts inventory when all lines done', async () => {
    const invRecord = { id: 'inv-1', quantityOnHand: 50, quantityAllocated: 0, quantityOnHold: 0 };
    const varianceLine = { ...mockLine, countedQuantity: 48, variance: -2, inventoryRecordId: 'inv-1' };
    const tx = {
      cycleCountLine: {
        findUnique: jest.fn().mockResolvedValue({ ...mockLine, cycleCount: { ...mockCount, status: 'in_progress', totalBins: 1 } }),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({}),
        findMany: jest.fn()
          .mockResolvedValueOnce([varianceLine])  // varianceLines
          .mockResolvedValueOnce([varianceLine]),  // allLines for lastCountedAt
        count: jest.fn()
          .mockResolvedValueOnce(1)  // countedBins = totalBins
          .mockResolvedValueOnce(1), // varianceCount
      },
      cycleCount: { update: jest.fn().mockResolvedValue({}) },
      inventoryRecord: {
        findUnique: jest.fn().mockResolvedValue(invRecord),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({}),
      },
      inventoryTransaction: { create: jest.fn().mockResolvedValue({}) },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new RecordCycleCountLineCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(RECORD_CYCLE_COUNT_LINE, { lineId: 'ccl-1', countedQuantity: 48 })
    );

    expect(result.success).toBe(true);
    expect(result.data?.countComplete).toBe(true);

    // Inventory adjusted
    expect(tx.inventoryRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'inv-1' },
        data: expect.objectContaining({ quantityOnHand: 48 }),
      })
    );

    // Transaction created
    expect(tx.inventoryTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          transactionType: 'cycle_count', quantityChange: -2,
        }),
      })
    );

    expect(result.events.some(e => e.type === EVENT_TYPES.CYCLE_COUNT_COMPLETED)).toBe(true);
  });
});
