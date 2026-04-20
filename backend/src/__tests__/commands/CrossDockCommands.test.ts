import { CompleteReceivingCommandHandler, COMPLETE_RECEIVING } from '../../commands/warehouse/CompleteReceivingCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

describe('Cross-dock workflow', () => {
  const mockLine = {
    id: 'line-1', receivingTaskId: 'task-1', sku: 'SKU-001',
    receivedQuantity: 10, damagedQuantity: 0, trackableUnitId: 'unit-1',
    orderLineItemId: 'oli-1',
  };

  it('sorts received units directly to staging when crossDock is true', async () => {
    const taskWithCrossDock = {
      id: 'task-1', locationId: 'loc-1', status: 'in_progress',
      receivingType: 'asn', crossDock: true, appointmentId: null, dockBinId: 'bin-dock',
      lines: [mockLine],
    };
    const stagingBin = { id: 'bin-staging', label: 'STAGE-01', zoneId: 'zone-ship' };

    const tx = {
      receivingTask: {
        findUnique: jest.fn().mockResolvedValue(taskWithCrossDock),
        update: jest.fn().mockResolvedValue({}),
      },
      receivingAppointment: { update: jest.fn() },
      warehouseBin: { findFirst: jest.fn().mockResolvedValue(stagingBin) },
      orderLineItem: { findUnique: jest.fn().mockResolvedValue({ orderId: 'order-1' }) },
      stagingAssignment: { create: jest.fn().mockResolvedValue({ id: 'sa-1' }) },
      trackableUnit: { update: jest.fn().mockResolvedValue({}) },
      // These shouldn't be called for cross-dock
      putawayRule: { findMany: jest.fn().mockResolvedValue([]) },
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

    // Staging assignment created (not putaway task)
    expect(tx.stagingAssignment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          trackableUnitId: 'unit-1',
          stagingBinId: 'bin-staging',
          status: 'staged',
          orderId: 'order-1',
        }),
      })
    );

    // Unit moved to staging bin
    expect(tx.trackableUnit.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ currentBinId: 'bin-staging', currentZoneId: 'zone-ship' }),
      })
    );

    // No putaway tasks created
    expect(tx.putawayTask.create).not.toHaveBeenCalled();

    // Cross-dock sorted event emitted
    expect(result.events.some(e => e.type === EVENT_TYPES.CROSS_DOCK_SORTED)).toBe(true);
    expect(result.events.some(e => e.type === EVENT_TYPES.RECEIVING_TASK_COMPLETED)).toBe(true);

    const sortedEvent = result.events.find(e => e.type === EVENT_TYPES.CROSS_DOCK_SORTED);
    expect(sortedEvent?.payload).toEqual(expect.objectContaining({
      unitsSorted: 1,
      stagingBinId: 'bin-staging',
      stagingBinLabel: 'STAGE-01',
    }));
  });

  it('does not create staging assignments for non-crossdock tasks', async () => {
    const normalTask = {
      id: 'task-2', locationId: 'loc-1', status: 'in_progress',
      receivingType: 'asn', crossDock: false, appointmentId: null, dockBinId: 'bin-dock',
      lines: [mockLine],
    };
    const fallbackBin = { id: 'bin-bulk', label: 'BULK-A-01' };

    const tx = {
      receivingTask: {
        findUnique: jest.fn().mockResolvedValue(normalTask),
        update: jest.fn().mockResolvedValue({}),
      },
      receivingAppointment: { update: jest.fn() },
      warehouseBin: { findFirst: jest.fn().mockResolvedValue(fallbackBin) },
      putawayRule: { findMany: jest.fn().mockResolvedValue([]) },
      putawayTask: { create: jest.fn().mockResolvedValue({ id: 'pt-1' }) },
      stagingAssignment: { create: jest.fn() },
      trackableUnit: { update: jest.fn() },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new CompleteReceivingCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(COMPLETE_RECEIVING, { taskId: 'task-2' })
    );

    expect(result.success).toBe(true);

    // Putaway task created, not staging
    expect(tx.putawayTask.create).toHaveBeenCalled();
    expect(tx.stagingAssignment.create).not.toHaveBeenCalled();

    // No cross-dock event
    expect(result.events.some(e => e.type === EVENT_TYPES.CROSS_DOCK_SORTED)).toBe(false);
  });
});
