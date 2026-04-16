import { ReleaseWaveCommandHandler, RELEASE_WAVE } from '../../commands/warehouse/ReleaseWaveCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

describe('ReleaseWaveCommand - Zone Strategy', () => {
  it('creates one pick task per zone with zone strategy', async () => {
    const mockWave = {
      id: 'wave-1', waveNumber: 'W-001', locationId: 'loc-1', status: 'planning',
      pickStrategy: 'zone', zonePickMode: 'parallel', orgId: 'test-org',
      waveOrders: [{ orderId: 'order-1', priority: 0 }],
    };
    const mockOrderLines = [
      { id: 'line-1', orderId: 'order-1', sku: 'SKU-A', quantity: 5, order: { id: 'order-1' } },
      { id: 'line-2', orderId: 'order-1', sku: 'SKU-B', quantity: 3, order: { id: 'order-1' } },
    ];
    // SKU-A in zone-1 (bin-1), SKU-B in zone-2 (bin-2)
    const mockInvA = { id: 'inv-1', sku: 'SKU-A', quantityAvailable: 10, uomCode: 'EA', lotNumber: null, bin: { id: 'bin-1', walkSequence: 1 } };
    const mockInvB = { id: 'inv-2', sku: 'SKU-B', quantityAvailable: 10, uomCode: 'EA', lotNumber: null, bin: { id: 'bin-2', walkSequence: 5 } };

    const createdTasks: any[] = [];
    const tx = {
      wave: { findUnique: jest.fn().mockResolvedValue(mockWave), update: jest.fn() },
      orderLineItem: { findMany: jest.fn().mockResolvedValue(mockOrderLines) },
      inventoryRecord: {
        findMany: jest.fn()
          .mockResolvedValueOnce([mockInvA])  // SKU-A inventory
          .mockResolvedValueOnce([mockInvB]), // SKU-B inventory
        update: jest.fn(),
      },
      allocation: { create: jest.fn() },
      warehouseBin: {
        findUnique: jest.fn()
          .mockResolvedValueOnce({ zoneId: 'zone-1' }) // bin-1 -> zone-1
          .mockResolvedValueOnce({ zoneId: 'zone-2' }), // bin-2 -> zone-2
      },
      warehouseZone: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'zone-1', sortOrder: 0, name: 'Zone A' },
          { id: 'zone-2', sortOrder: 1, name: 'Zone B' },
        ]),
      },
      pickTask: { create: jest.fn().mockImplementation((args: any) => {
        const task = { id: `pick-${createdTasks.length + 1}`, ...args.data };
        createdTasks.push(task);
        return task;
      })},
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
    expect(result.data?.pickTasksCreated).toBe(2);

    // Verify zone tasks were created
    expect(createdTasks).toHaveLength(2);
    expect(createdTasks[0].pickType).toBe('zone');
    expect(createdTasks[0].zoneId).toBe('zone-1');
    expect(createdTasks[0].zoneSequence).toBe(0);
    expect(createdTasks[1].zoneId).toBe('zone-2');
    expect(createdTasks[1].zoneSequence).toBe(1);

    // Verify events include zone info
    const pickEvents = result.events.filter(e => e.type === EVENT_TYPES.PICK_TASK_CREATED);
    expect(pickEvents).toHaveLength(2);
    expect(pickEvents[0].payload).toEqual(expect.objectContaining({ zoneId: 'zone-1', zoneName: 'Zone A' }));
    expect(pickEvents[1].payload).toEqual(expect.objectContaining({ zoneId: 'zone-2', zoneName: 'Zone B' }));
  });

  it('groups lines by zone correctly - same order across zones', async () => {
    const mockWave = {
      id: 'wave-1', waveNumber: 'W-001', locationId: 'loc-1', status: 'planning',
      pickStrategy: 'zone', zonePickMode: 'sequential', orgId: 'test-org',
      waveOrders: [{ orderId: 'order-1', priority: 0 }],
    };
    // 3 lines, 2 in zone-1, 1 in zone-2
    const mockOrderLines = [
      { id: 'line-1', orderId: 'order-1', sku: 'SKU-A', quantity: 5, order: { id: 'order-1' } },
      { id: 'line-2', orderId: 'order-1', sku: 'SKU-B', quantity: 3, order: { id: 'order-1' } },
      { id: 'line-3', orderId: 'order-1', sku: 'SKU-C', quantity: 2, order: { id: 'order-1' } },
    ];
    const invA = { id: 'inv-1', sku: 'SKU-A', quantityAvailable: 10, uomCode: 'EA', lotNumber: null, bin: { id: 'bin-1', walkSequence: 1 } };
    const invB = { id: 'inv-2', sku: 'SKU-B', quantityAvailable: 10, uomCode: 'EA', lotNumber: null, bin: { id: 'bin-2', walkSequence: 3 } };
    const invC = { id: 'inv-3', sku: 'SKU-C', quantityAvailable: 10, uomCode: 'EA', lotNumber: null, bin: { id: 'bin-3', walkSequence: 2 } };

    const pickLineData: any[] = [];
    const tx = {
      wave: { findUnique: jest.fn().mockResolvedValue(mockWave), update: jest.fn() },
      orderLineItem: { findMany: jest.fn().mockResolvedValue(mockOrderLines) },
      inventoryRecord: {
        findMany: jest.fn()
          .mockResolvedValueOnce([invA])
          .mockResolvedValueOnce([invB])
          .mockResolvedValueOnce([invC]),
        update: jest.fn(),
      },
      allocation: { create: jest.fn() },
      warehouseBin: {
        findUnique: jest.fn()
          .mockResolvedValueOnce({ zoneId: 'zone-1' }) // bin-1 -> zone-1
          .mockResolvedValueOnce({ zoneId: 'zone-1' }) // bin-2 -> zone-1
          .mockResolvedValueOnce({ zoneId: 'zone-2' }), // bin-3 -> zone-2
      },
      warehouseZone: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'zone-1', sortOrder: 0, name: 'Zone A' },
          { id: 'zone-2', sortOrder: 1, name: 'Zone B' },
        ]),
      },
      pickTask: { create: jest.fn().mockImplementation((args: any) => ({ id: 'pick-x', ...args.data })) },
      pickLine: { createMany: jest.fn().mockImplementation((args: any) => {
        pickLineData.push(...args.data);
        return { count: args.data.length };
      })},
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
    expect(result.data?.pickTasksCreated).toBe(2);

    // Zone 1 should have 2 lines (bin-1 + bin-2), zone 2 should have 1 line (bin-3)
    expect(tx.pickLine.createMany).toHaveBeenCalledTimes(2);
    // Total lines across both zones
    expect(pickLineData).toHaveLength(3);
  });
});
