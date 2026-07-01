import {
  UnarchiveOrderCommandHandler,
  UNARCHIVE_ORDER,
} from '../../commands/orders/UnarchiveOrderCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

function makePrisma(order: any) {
  const update = jest.fn().mockResolvedValue({
    ...order,
    archived: false,
    archivedAt: null,
    status: order.statusBeforeArchive ?? 'pending',
    statusBeforeArchive: null,
  });
  const mockTx = {
    order: {
      findFirstOrThrow: jest.fn().mockResolvedValue(order),
      update,
    },
    domainEventLog: { create: jest.fn().mockResolvedValue({}) },
  } as any;
  const mockPrisma = {
    $transaction: jest.fn((fn: Function) => fn(mockTx)),
    domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
  } as any;
  return { mockPrisma, update };
}

describe('UnarchiveOrderCommandHandler', () => {
  beforeEach(() => jest.clearAllMocks());

  it('clears archived/archivedAt, restores the pre-archive status, and emits ORDER_UNARCHIVED', async () => {
    const { mockPrisma, update } = makePrisma({
      id: 'order-1',
      orderNumber: 'ORD-001',
      archived: true,
      deletedAt: null,
      statusBeforeArchive: 'converted',
    });
    const { bus } = mockEventBus();
    const handler = new UnarchiveOrderCommandHandler(mockPrisma, bus);

    const result = await handler.execute(createTestCommand(UNARCHIVE_ORDER, { id: 'order-1' }));

    expect(result.success).toBe(true);
    expect(update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: { archived: false, archivedAt: null, status: 'converted', statusBeforeArchive: null },
    });
    expect(result.events).toHaveLength(1);
    expect(result.events[0].type).toBe(EVENT_TYPES.ORDER_UNARCHIVED);
    expect(result.events[0].payload).toEqual(expect.objectContaining({ orderReference: 'ORD-001' }));
  });

  it('falls back to pending status when no statusBeforeArchive was captured', async () => {
    const { mockPrisma, update } = makePrisma({
      id: 'order-1',
      orderNumber: 'ORD-001',
      archived: true,
      deletedAt: null,
      statusBeforeArchive: null,
    });
    const { bus } = mockEventBus();
    const handler = new UnarchiveOrderCommandHandler(mockPrisma, bus);

    await handler.execute(createTestCommand(UNARCHIVE_ORDER, { id: 'order-1' }));

    expect(update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: { archived: false, archivedAt: null, status: 'pending', statusBeforeArchive: null },
    });
  });

  it('is idempotent — unarchiving a non-archived order is a no-op', async () => {
    const { mockPrisma, update } = makePrisma({
      id: 'order-1',
      orderNumber: 'ORD-001',
      archived: false,
      deletedAt: null,
      statusBeforeArchive: null,
    });
    const { bus } = mockEventBus();
    const handler = new UnarchiveOrderCommandHandler(mockPrisma, bus);

    const result = await handler.execute(createTestCommand(UNARCHIVE_ORDER, { id: 'order-1' }));

    expect(result.success).toBe(true);
    expect((result.data as any).notArchived).toBe(true);
    expect(update).not.toHaveBeenCalled();
    expect(result.events).toHaveLength(0);
  });
});
