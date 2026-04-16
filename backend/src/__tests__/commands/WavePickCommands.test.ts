import { CreateWaveCommandHandler, CREATE_WAVE } from '../../commands/warehouse/CreateWaveCommand';
import { ReleaseWaveCommandHandler, RELEASE_WAVE } from '../../commands/warehouse/ReleaseWaveCommand';
import { CompletePickLineCommandHandler, COMPLETE_PICK_LINE } from '../../commands/warehouse/CompletePickLineCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

/* ── CreateWaveCommandHandler ──────────────────────────────── */

describe('CreateWaveCommandHandler', () => {
  it('creates wave with orders and emits WAVE_CREATED', async () => {
    const mockWave = {
      id: 'wave-1', waveNumber: 'W-2026-04-15-001', locationId: 'loc-1',
      status: 'planning', pickStrategy: 'discrete', orderCount: 2, lineCount: 5,
      orgId: 'test-org',
    };
    const tx = {
      wave: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue(mockWave),
      },
      waveOrder: { createMany: jest.fn().mockResolvedValue({ count: 2 }) },
      orderLineItem: { count: jest.fn().mockResolvedValue(5) },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new CreateWaveCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(CREATE_WAVE, {
        locationId: 'loc-1', pickStrategy: 'discrete', orderIds: ['order-1', 'order-2'],
      })
    );

    expect(result.success).toBe(true);
    expect(result.data?.waveNumber).toMatch(/^W-/);
    expect(result.data?.orderCount).toBe(2);
    expect(result.data?.status).toBe('planning');
    expect(result.events).toHaveLength(1);
    expect(result.events[0].type).toBe(EVENT_TYPES.WAVE_CREATED);
  });

  it('fails with empty order list', async () => {
    const tx = { domainEventLog: { create: jest.fn().mockResolvedValue({}) } } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new CreateWaveCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(CREATE_WAVE, { locationId: 'loc-1', pickStrategy: 'discrete', orderIds: [] })
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('at least one');
  });
});

/* ── ReleaseWaveCommandHandler ─────────────────────────────── */

describe('ReleaseWaveCommandHandler', () => {
  it('releases wave, allocates inventory, creates pick tasks', async () => {
    const mockWave = {
      id: 'wave-1', waveNumber: 'W-001', locationId: 'loc-1', status: 'planning',
      pickStrategy: 'discrete', orgId: 'test-org',
      waveOrders: [{ orderId: 'order-1', priority: 0 }],
    };
    const mockOrderLine = {
      id: 'line-1', orderId: 'order-1', sku: 'SKU-001', quantity: 5,
      order: { id: 'order-1' },
    };
    const mockInv = {
      id: 'inv-1', sku: 'SKU-001', quantityAvailable: 10, uomCode: 'EA', lotNumber: null,
      bin: { id: 'bin-1', walkSequence: 5 },
    };
    const tx = {
      wave: {
        findUnique: jest.fn().mockResolvedValue(mockWave),
        update: jest.fn().mockResolvedValue({}),
      },
      orderLineItem: { findMany: jest.fn().mockResolvedValue([mockOrderLine]) },
      inventoryRecord: {
        findMany: jest.fn().mockResolvedValue([mockInv]),
        update: jest.fn().mockResolvedValue({}),
      },
      allocation: { create: jest.fn().mockResolvedValue({}) },
      pickTask: { create: jest.fn().mockResolvedValue({ id: 'pick-1' }) },
      pickLine: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new ReleaseWaveCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(RELEASE_WAVE, { waveId: 'wave-1' })
    );

    expect(result.success).toBe(true);
    expect(result.data?.status).toBe('released');
    expect(result.data?.pickTasksCreated).toBe(1);
    expect(result.data?.allocationFailures).toEqual([]);

    // Inventory allocated
    expect(tx.inventoryRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          quantityAllocated: { increment: 5 },
          quantityAvailable: { decrement: 5 },
        }),
      })
    );

    // Pick task and lines created
    expect(tx.pickTask.create).toHaveBeenCalled();
    expect(tx.pickLine.createMany).toHaveBeenCalled();

    const eventTypes = result.events.map(e => e.type);
    expect(eventTypes).toContain(EVENT_TYPES.PICK_TASK_CREATED);
    expect(eventTypes).toContain(EVENT_TYPES.WAVE_RELEASED);
  });

  it('reports allocation failures for insufficient stock', async () => {
    const mockWave = {
      id: 'wave-1', waveNumber: 'W-001', locationId: 'loc-1', status: 'planning',
      pickStrategy: 'batch', orgId: 'test-org',
      waveOrders: [{ orderId: 'order-1', priority: 0 }],
    };
    const mockOrderLine = {
      id: 'line-1', orderId: 'order-1', sku: 'SKU-001', quantity: 50,
      order: { id: 'order-1' },
    };
    // Only 10 available, need 50
    const mockInv = {
      id: 'inv-1', sku: 'SKU-001', quantityAvailable: 10, uomCode: 'EA', lotNumber: null,
      bin: { id: 'bin-1', walkSequence: 1 },
    };
    const tx = {
      wave: {
        findUnique: jest.fn().mockResolvedValue(mockWave),
        update: jest.fn().mockResolvedValue({}),
      },
      orderLineItem: { findMany: jest.fn().mockResolvedValue([mockOrderLine]) },
      inventoryRecord: {
        findMany: jest.fn().mockResolvedValue([mockInv]),
        update: jest.fn().mockResolvedValue({}),
      },
      allocation: { create: jest.fn().mockResolvedValue({}) },
      pickTask: { create: jest.fn().mockResolvedValue({ id: 'pick-1' }) },
      pickLine: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new ReleaseWaveCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(RELEASE_WAVE, { waveId: 'wave-1' })
    );

    expect(result.success).toBe(true);
    expect(result.data?.allocationFailures).toHaveLength(1);
    expect(result.data?.allocationFailures[0]).toContain('SKU-001');
    expect(result.data?.allocationFailures[0]).toContain('short 40');
  });

  it('fails if wave not in planning status', async () => {
    const tx = {
      wave: { findUnique: jest.fn().mockResolvedValue({ id: 'wave-1', status: 'released', waveOrders: [] }) },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new ReleaseWaveCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(RELEASE_WAVE, { waveId: 'wave-1' })
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('planning');
  });
});

/* ── CompletePickLineCommandHandler ────────────────────────── */

describe('CompletePickLineCommandHandler', () => {
  const mockTask = {
    id: 'pick-1', waveId: 'wave-1', status: 'in_progress', pickType: 'discrete',
    totalLines: 2, completedLines: 0, orgId: 'test-org',
  };
  const mockLine = {
    id: 'line-1', pickTaskId: 'pick-1', sku: 'SKU-001', binId: 'bin-1',
    inventoryRecordId: 'inv-1', requestedQuantity: 10, pickedQuantity: 0,
    status: 'pending', walkSequence: 1, lotNumber: null,
    pickTask: mockTask,
  };
  const mockInvRecord = { id: 'inv-1', quantityOnHand: 50, quantityAllocated: 10, quantityAvailable: 40 };

  it('completes a pick line at full quantity', async () => {
    const tx = {
      pickLine: {
        findUnique: jest.fn().mockResolvedValue(mockLine),
        update: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(1), // 1 completed of 2 total
      },
      pickTask: {
        update: jest.fn().mockResolvedValue({}),
      },
      inventoryRecord: {
        findUnique: jest.fn().mockResolvedValue(mockInvRecord),
        update: jest.fn().mockResolvedValue({}),
      },
      inventoryTransaction: { create: jest.fn().mockResolvedValue({}) },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new CompletePickLineCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(COMPLETE_PICK_LINE, { pickLineId: 'line-1', pickedQuantity: 10 })
    );

    expect(result.success).toBe(true);
    expect(result.data?.short).toBe(false);
    expect(result.data?.pickedQuantity).toBe(10);
    expect(result.data?.taskComplete).toBe(false); // 1 of 2 lines done

    // Inventory deducted
    expect(tx.inventoryRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          quantityOnHand: { decrement: 10 },
          quantityAllocated: { decrement: 10 },
        }),
      })
    );

    expect(result.events.some(e => e.type === EVENT_TYPES.PICK_LINE_COMPLETED)).toBe(true);
  });

  it('handles short pick and emits PICK_LINE_SHORT', async () => {
    const tx = {
      pickLine: {
        findUnique: jest.fn().mockResolvedValue(mockLine),
        update: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(1),
      },
      pickTask: { update: jest.fn().mockResolvedValue({}) },
      inventoryRecord: {
        findUnique: jest.fn().mockResolvedValue(mockInvRecord),
        update: jest.fn().mockResolvedValue({}),
      },
      inventoryTransaction: { create: jest.fn().mockResolvedValue({}) },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new CompletePickLineCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(COMPLETE_PICK_LINE, {
        pickLineId: 'line-1', pickedQuantity: 7, shortPickAction: 'cancel_line',
      })
    );

    expect(result.success).toBe(true);
    expect(result.data?.short).toBe(true);

    // Released allocation for short qty back to available
    expect(tx.inventoryRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          quantityAllocated: { decrement: 3 },
          quantityAvailable: { increment: 3 },
        }),
      })
    );

    expect(result.events.some(e => e.type === EVENT_TYPES.PICK_LINE_SHORT)).toBe(true);
  });

  it('auto-completes task when all lines done', async () => {
    const tx = {
      pickLine: {
        findUnique: jest.fn().mockResolvedValue(mockLine),
        update: jest.fn().mockResolvedValue({}),
        count: jest.fn()
          .mockResolvedValueOnce(2) // completedLines count = totalLines
          .mockResolvedValueOnce(0), // hasShorts count = 0
      },
      pickTask: {
        update: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(0), // remainingTasks for wave completion check
      },
      wave: { update: jest.fn().mockResolvedValue({}) },
      inventoryRecord: {
        findUnique: jest.fn().mockResolvedValue(mockInvRecord),
        update: jest.fn().mockResolvedValue({}),
      },
      inventoryTransaction: { create: jest.fn().mockResolvedValue({}) },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new CompletePickLineCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(COMPLETE_PICK_LINE, { pickLineId: 'line-1', pickedQuantity: 10 })
    );

    expect(result.success).toBe(true);
    expect(result.data?.taskComplete).toBe(true);

    expect(result.events.some(e => e.type === EVENT_TYPES.PICK_TASK_COMPLETED)).toBe(true);
  });

  it('fails if line already picked', async () => {
    const pickedLine = { ...mockLine, status: 'picked' };
    const tx = {
      pickLine: { findUnique: jest.fn().mockResolvedValue(pickedLine) },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new CompletePickLineCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(COMPLETE_PICK_LINE, { pickLineId: 'line-1', pickedQuantity: 10 })
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('already');
  });
});
