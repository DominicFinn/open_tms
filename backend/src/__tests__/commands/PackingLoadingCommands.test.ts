import { CreatePackTaskCommandHandler, CREATE_PACK_TASK } from '../../commands/warehouse/CreatePackTaskCommand';
import { CompletePackLineCommandHandler, COMPLETE_PACK_LINE } from '../../commands/warehouse/CompletePackLineCommand';
import { CreateStagingAssignmentCommandHandler, CREATE_STAGING_ASSIGNMENT } from '../../commands/warehouse/CreateStagingAssignmentCommand';
import { CompleteLoadingCommandHandler, COMPLETE_LOADING } from '../../commands/warehouse/CompleteLoadingCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

/* ── CreatePackTaskCommandHandler ──────────────────────────── */

describe('CreatePackTaskCommandHandler', () => {
  it('creates pack task with lines and emits PACK_TASK_CREATED', async () => {
    const mockTask = { id: 'pack-1', status: 'pending', orderId: 'order-1', orgId: 'test-org' };
    const tx = {
      packTask: { create: jest.fn().mockResolvedValue(mockTask) },
      packLine: { createMany: jest.fn().mockResolvedValue({ count: 2 }) },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new CreatePackTaskCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(CREATE_PACK_TASK, {
        locationId: 'loc-1', orderId: 'order-1',
        lines: [
          { orderLineItemId: 'oli-1', trackableUnitId: 'unit-1', sku: 'SKU-001', expectedQuantity: 5 },
          { orderLineItemId: 'oli-2', trackableUnitId: 'unit-1', sku: 'SKU-002', expectedQuantity: 3 },
        ],
      })
    );

    expect(result.success).toBe(true);
    expect(result.data?.lineCount).toBe(2);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].type).toBe(EVENT_TYPES.PACK_TASK_CREATED);
  });

  it('fails with empty lines', async () => {
    const tx = { domainEventLog: { create: jest.fn().mockResolvedValue({}) } } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new CreatePackTaskCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(CREATE_PACK_TASK, { locationId: 'loc-1', orderId: 'order-1', lines: [] })
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('at least one');
  });
});

/* ── CompletePackLineCommandHandler ────────────────────────── */

describe('CompletePackLineCommandHandler', () => {
  const mockTask = { id: 'pack-1', status: 'in_progress', orderId: 'order-1', pickTaskId: null, orgId: 'test-org' };
  const mockLine = {
    id: 'pline-1', packTaskId: 'pack-1', sku: 'SKU-001',
    expectedQuantity: 5, packedQuantity: 0, status: 'pending',
    trackableUnitId: 'unit-1', packTask: mockTask,
  };

  it('packs a line and emits PACK_LINE_VERIFIED', async () => {
    const tx = {
      packLine: {
        findUnique: jest.fn().mockResolvedValue(mockLine),
        update: jest.fn().mockResolvedValue({}),
        count: jest.fn()
          .mockResolvedValueOnce(2) // totalLines
          .mockResolvedValueOnce(1), // completedLines (not all done yet)
      },
      packTask: { update: jest.fn().mockResolvedValue({}) },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new CompletePackLineCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(COMPLETE_PACK_LINE, { packLineId: 'pline-1', packedQuantity: 5 })
    );

    expect(result.success).toBe(true);
    expect(result.data?.taskComplete).toBe(false);
    expect(result.events.some(e => e.type === EVENT_TYPES.PACK_LINE_VERIFIED)).toBe(true);
  });

  it('auto-completes task when all lines packed', async () => {
    const tx = {
      packLine: {
        findUnique: jest.fn().mockResolvedValue(mockLine),
        update: jest.fn().mockResolvedValue({}),
        count: jest.fn()
          .mockResolvedValueOnce(1) // totalLines
          .mockResolvedValueOnce(1), // completedLines = totalLines
      },
      packTask: { update: jest.fn().mockResolvedValue({}) },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new CompletePackLineCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(COMPLETE_PACK_LINE, { packLineId: 'pline-1', packedQuantity: 5 })
    );

    expect(result.success).toBe(true);
    expect(result.data?.taskComplete).toBe(true);
    expect(result.events.some(e => e.type === EVENT_TYPES.PACK_TASK_COMPLETED)).toBe(true);
  });

  it('fails if line already packed', async () => {
    const packedLine = { ...mockLine, status: 'packed' };
    const tx = {
      packLine: { findUnique: jest.fn().mockResolvedValue(packedLine) },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new CompletePackLineCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(COMPLETE_PACK_LINE, { packLineId: 'pline-1', packedQuantity: 5 })
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('already packed');
  });
});

/* ── CreateStagingAssignmentCommandHandler ─────────────────── */

describe('CreateStagingAssignmentCommandHandler', () => {
  it('creates staging assignment and moves unit', async () => {
    const mockBin = { id: 'bin-staging', label: 'STAGE-01', active: true, zoneId: 'zone-ship' };
    const tx = {
      warehouseBin: { findUnique: jest.fn().mockResolvedValue(mockBin) },
      stagingAssignment: { create: jest.fn().mockResolvedValue({ id: 'sa-1', status: 'staged' }) },
      trackableUnit: { update: jest.fn().mockResolvedValue({}) },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new CreateStagingAssignmentCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(CREATE_STAGING_ASSIGNMENT, {
        locationId: 'loc-1', orderId: 'order-1',
        trackableUnitId: 'unit-1', stagingBinId: 'bin-staging',
      })
    );

    expect(result.success).toBe(true);
    expect(result.data?.stagingBinLabel).toBe('STAGE-01');
    expect(tx.trackableUnit.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ currentBinId: 'bin-staging' }) })
    );
    expect(result.events[0].type).toBe(EVENT_TYPES.STAGING_ASSIGNMENT_CREATED);
  });

  it('fails if bin not found', async () => {
    const tx = {
      warehouseBin: { findUnique: jest.fn().mockResolvedValue(null) },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new CreateStagingAssignmentCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(CREATE_STAGING_ASSIGNMENT, {
        locationId: 'loc-1', orderId: 'order-1',
        trackableUnitId: 'unit-1', stagingBinId: 'missing',
      })
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });
});

/* ── CompleteLoadingCommandHandler ─────────────────────────── */

describe('CompleteLoadingCommandHandler', () => {
  it('loads assignments and clears unit locations', async () => {
    const assignments = [
      { id: 'sa-1', status: 'staged', trackableUnitId: 'unit-1', orderId: 'order-1' },
      { id: 'sa-2', status: 'staged', trackableUnitId: 'unit-2', orderId: 'order-1' },
    ];
    const tx = {
      stagingAssignment: {
        findMany: jest.fn().mockResolvedValue(assignments),
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      trackableUnit: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new CompleteLoadingCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(COMPLETE_LOADING, {
        assignmentIds: ['sa-1', 'sa-2'], shipmentId: 'ship-1',
      })
    );

    expect(result.success).toBe(true);
    expect(result.data?.loadedCount).toBe(2);

    // Units cleared from bins (on vehicle now)
    expect(tx.trackableUnit.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { currentBinId: null, currentZoneId: null },
      })
    );

    expect(result.events[0].type).toBe(EVENT_TYPES.LOADING_COMPLETED);
  });

  it('fails with empty assignment list', async () => {
    const tx = { domainEventLog: { create: jest.fn().mockResolvedValue({}) } } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new CompleteLoadingCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(COMPLETE_LOADING, { assignmentIds: [] })
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('No assignments');
  });
});
