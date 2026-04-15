import { CreateReceivingTaskCommandHandler, CREATE_RECEIVING_TASK } from '../../commands/warehouse/CreateReceivingTaskCommand';
import { RecordReceivingLineCommandHandler, RECORD_RECEIVING_LINE } from '../../commands/warehouse/RecordReceivingLineCommand';
import { CompleteReceivingCommandHandler, COMPLETE_RECEIVING } from '../../commands/warehouse/CompleteReceivingCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

/* ── Mock Data ─────────────────────────────────────────────── */

const mockTask = {
  id: 'task-1', locationId: 'loc-1', appointmentId: null,
  inboundShipmentId: null, dockBinId: 'bin-dock-1',
  status: 'pending', receivingType: 'blind', crossDock: false,
  assignedToUserId: null, orgId: 'test-org',
  createdAt: new Date(), updatedAt: new Date(),
};

const mockLine = {
  id: 'line-1', receivingTaskId: 'task-1', orderLineItemId: null,
  trackableUnitId: null, sku: 'SKU-001', uomCode: 'EA',
  expectedQuantity: 10, receivedQuantity: 0, damagedQuantity: 0,
  inspectionStatus: 'pending', lotNumber: null, expiryDate: null,
  createdAt: new Date(), updatedAt: new Date(),
};

/* ── CreateReceivingTaskCommandHandler ─────────────────────── */

describe('CreateReceivingTaskCommandHandler', () => {
  it('creates task and emits RECEIVING_TASK_CREATED', async () => {
    const tx = {
      receivingTask: { create: jest.fn().mockResolvedValue(mockTask) },
      receivingLine: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
      receivingAppointment: { update: jest.fn() },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new CreateReceivingTaskCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(CREATE_RECEIVING_TASK, {
        locationId: 'loc-1',
        receivingType: 'blind',
      })
    );

    expect(result.success).toBe(true);
    expect(result.data?.id).toBe('task-1');
    expect(result.data?.status).toBe('pending');
    expect(result.events).toHaveLength(1);
    expect(result.events[0].type).toBe(EVENT_TYPES.RECEIVING_TASK_CREATED);
  });

  it('creates expected lines for ASN mode', async () => {
    const tx = {
      receivingTask: { create: jest.fn().mockResolvedValue(mockTask) },
      receivingLine: { createMany: jest.fn().mockResolvedValue({ count: 2 }) },
      receivingAppointment: { update: jest.fn() },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new CreateReceivingTaskCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(CREATE_RECEIVING_TASK, {
        locationId: 'loc-1',
        receivingType: 'asn',
        expectedLines: [
          { sku: 'SKU-001', expectedQuantity: 10 },
          { sku: 'SKU-002', expectedQuantity: 5 },
        ],
      })
    );

    expect(result.success).toBe(true);
    expect(result.data?.lineCount).toBe(2);
    expect(tx.receivingLine.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ sku: 'SKU-001', expectedQuantity: 10 }),
        ]),
      })
    );
  });

  it('updates appointment status when linked', async () => {
    const taskWithAppt = { ...mockTask, appointmentId: 'appt-1' };
    const tx = {
      receivingTask: { create: jest.fn().mockResolvedValue(taskWithAppt) },
      receivingLine: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
      receivingAppointment: { update: jest.fn().mockResolvedValue({}) },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new CreateReceivingTaskCommandHandler(prisma, bus);

    await handler.execute(
      createTestCommand(CREATE_RECEIVING_TASK, {
        locationId: 'loc-1',
        receivingType: 'blind',
        appointmentId: 'appt-1',
      })
    );

    expect(tx.receivingAppointment.update).toHaveBeenCalledWith({
      where: { id: 'appt-1' },
      data: { status: 'receiving' },
    });
  });
});

/* ── RecordReceivingLineCommandHandler ─────────────────────── */

describe('RecordReceivingLineCommandHandler', () => {
  it('records a blind line and auto-starts task', async () => {
    const newLine = { ...mockLine, sku: 'BLIND-001', receivedQuantity: 5 };
    const tx = {
      receivingTask: {
        findUnique: jest.fn().mockResolvedValue(mockTask),
        update: jest.fn().mockResolvedValue({ ...mockTask, status: 'in_progress' }),
      },
      receivingLine: {
        create: jest.fn().mockResolvedValue(newLine),
        update: jest.fn(),
      },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new RecordReceivingLineCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(RECORD_RECEIVING_LINE, {
        taskId: 'task-1',
        sku: 'BLIND-001',
        receivedQuantity: 5,
      })
    );

    expect(result.success).toBe(true);
    expect(result.data?.receivedQuantity).toBe(5);
    // Should emit TASK_STARTED + LINE_RECORDED
    expect(result.events).toHaveLength(2);
    expect(result.events[0].type).toBe(EVENT_TYPES.RECEIVING_TASK_STARTED);
    expect(result.events[1].type).toBe(EVENT_TYPES.RECEIVING_LINE_RECORDED);
  });

  it('updates an existing ASN line by lineId', async () => {
    const updatedLine = { ...mockLine, receivedQuantity: 10 };
    const inProgressTask = { ...mockTask, status: 'in_progress' };
    const tx = {
      receivingTask: {
        findUnique: jest.fn().mockResolvedValue(inProgressTask),
        update: jest.fn(),
      },
      receivingLine: {
        create: jest.fn(),
        update: jest.fn().mockResolvedValue(updatedLine),
      },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new RecordReceivingLineCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(RECORD_RECEIVING_LINE, {
        taskId: 'task-1',
        lineId: 'line-1',
        receivedQuantity: 10,
      })
    );

    expect(result.success).toBe(true);
    expect(tx.receivingLine.update).toHaveBeenCalled();
    // Only LINE_RECORDED (no TASK_STARTED since already in_progress)
    expect(result.events).toHaveLength(1);
    expect(result.events[0].type).toBe(EVENT_TYPES.RECEIVING_LINE_RECORDED);
  });

  it('fails if task not found', async () => {
    const tx = {
      receivingTask: { findUnique: jest.fn().mockResolvedValue(null) },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new RecordReceivingLineCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(RECORD_RECEIVING_LINE, { taskId: 'missing', receivedQuantity: 5 })
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('fails if task is completed', async () => {
    const tx = {
      receivingTask: { findUnique: jest.fn().mockResolvedValue({ ...mockTask, status: 'completed' }) },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new RecordReceivingLineCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(RECORD_RECEIVING_LINE, { taskId: 'task-1', receivedQuantity: 5, sku: 'X' })
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('completed');
  });
});

/* ── CompleteReceivingCommandHandler ───────────────────────── */

describe('CompleteReceivingCommandHandler', () => {
  it('completes task and emits RECEIVING_TASK_COMPLETED', async () => {
    const taskWithLines = {
      ...mockTask, status: 'in_progress',
      lines: [
        { ...mockLine, receivedQuantity: 10, damagedQuantity: 1, trackableUnitId: null },
      ],
    };
    const tx = {
      receivingTask: {
        findUnique: jest.fn().mockResolvedValue(taskWithLines),
        update: jest.fn().mockResolvedValue({ ...taskWithLines, status: 'completed' }),
      },
      receivingAppointment: { update: jest.fn() },
      putawayRule: { findMany: jest.fn().mockResolvedValue([]) },
      warehouseBin: { findFirst: jest.fn().mockResolvedValue(null) },
      putawayTask: { create: jest.fn() },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new CompleteReceivingCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(COMPLETE_RECEIVING, { taskId: 'task-1' })
    );

    expect(result.success).toBe(true);
    expect(result.data?.status).toBe('completed');
    expect(result.data?.totalReceived).toBe(10);
    expect(result.data?.totalDamaged).toBe(1);
    expect(result.events.some(e => e.type === EVENT_TYPES.RECEIVING_TASK_COMPLETED)).toBe(true);
  });

  it('generates putaway tasks for units with trackableUnitId', async () => {
    const taskWithTrackedLines = {
      ...mockTask, status: 'in_progress',
      lines: [
        { ...mockLine, receivedQuantity: 10, trackableUnitId: 'unit-1' },
      ],
    };
    const fallbackBin = { id: 'bin-bulk-1', label: 'BULK-A-01-01' };
    const tx = {
      receivingTask: {
        findUnique: jest.fn().mockResolvedValue(taskWithTrackedLines),
        update: jest.fn().mockResolvedValue({ ...taskWithTrackedLines, status: 'completed' }),
      },
      receivingAppointment: { update: jest.fn() },
      putawayRule: { findMany: jest.fn().mockResolvedValue([]) },
      warehouseBin: { findFirst: jest.fn().mockResolvedValue(fallbackBin) },
      putawayTask: { create: jest.fn().mockResolvedValue({ id: 'putaway-1' }) },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new CompleteReceivingCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(COMPLETE_RECEIVING, { taskId: 'task-1' })
    );

    expect(result.success).toBe(true);
    expect(result.data?.putawayTasksCreated).toBe(1);
    expect(tx.putawayTask.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          trackableUnitId: 'unit-1',
          targetBinId: 'bin-bulk-1',
          putawayType: 'directed',
        }),
      })
    );
    expect(result.events.some(e => e.type === EVENT_TYPES.PUTAWAY_TASK_CREATED)).toBe(true);
  });

  it('fails if task already completed', async () => {
    const tx = {
      receivingTask: {
        findUnique: jest.fn().mockResolvedValue({ ...mockTask, status: 'completed', lines: [] }),
      },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new CompleteReceivingCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(COMPLETE_RECEIVING, { taskId: 'task-1' })
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('already completed');
  });
});
