import {
  SoftDeleteOrderCommandHandler,
  SOFT_DELETE_ORDER,
} from '../../commands/orders/SoftDeleteOrderCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

function makePrisma(order: any) {
  const update = jest.fn().mockResolvedValue({ ...order, deletedAt: new Date() });
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

const baseOrder = { id: 'order-1', orderNumber: 'ORD-001', deletedAt: null };

describe('SoftDeleteOrderCommandHandler', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sets deletedAt/deletedBy and emits ORDER_DELETED', async () => {
    const { mockPrisma, update } = makePrisma({ ...baseOrder });
    const { bus } = mockEventBus();
    const handler = new SoftDeleteOrderCommandHandler(mockPrisma, bus);

    const result = await handler.execute(
      createTestCommand(SOFT_DELETE_ORDER, { id: 'order-1' }, { actorId: 'admin-7' })
    );

    expect(result.success).toBe(true);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'order-1' },
      data: expect.objectContaining({ deletedBy: 'admin-7' }),
    }));
    expect(update.mock.calls[0][0].data.deletedAt).toBeInstanceOf(Date);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].type).toBe(EVENT_TYPES.ORDER_DELETED);
    expect(result.events[0].payload).toEqual(
      expect.objectContaining({ orderReference: 'ORD-001', softDelete: true })
    );
  });

  it('is idempotent — re-deleting an already-deleted order is a no-op', async () => {
    const { mockPrisma, update } = makePrisma({ ...baseOrder, deletedAt: new Date('2026-06-01') });
    const { bus } = mockEventBus();
    const handler = new SoftDeleteOrderCommandHandler(mockPrisma, bus);

    const result = await handler.execute(
      createTestCommand(SOFT_DELETE_ORDER, { id: 'order-1' })
    );

    expect(result.success).toBe(true);
    expect((result.data as any).alreadyDeleted).toBe(true);
    expect(update).not.toHaveBeenCalled();
    expect(result.events).toHaveLength(0);
  });

  it('propagates actor/org metadata onto the emitted event', async () => {
    const { mockPrisma } = makePrisma({ ...baseOrder });
    const { bus } = mockEventBus();
    const handler = new SoftDeleteOrderCommandHandler(mockPrisma, bus);

    const result = await handler.execute(
      createTestCommand(SOFT_DELETE_ORDER, { id: 'order-1' }, { actorId: 'admin-7', orgId: 'org-3' })
    );

    expect(result.events[0].actorId).toBe('admin-7');
    expect(result.events[0].orgId).toBe('org-3');
  });
});
