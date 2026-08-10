import {
  CancelOrderCommandHandler,
  CANCEL_ORDER,
} from '../../commands/orders/CancelOrderCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

function makePrisma(order: any) {
  const update = jest.fn().mockResolvedValue({ ...order, status: 'cancelled' });
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

describe('CancelOrderCommandHandler', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each(['pending', 'verified', 'issue'])(
    'cancels an order with status "%s" and emits ORDER_STATUS_CHANGED',
    async (status) => {
      const { mockPrisma, update } = makePrisma({
        id: 'order-1',
        orderNumber: 'ORD-001',
        status,
      });
      const { bus } = mockEventBus();
      const handler = new CancelOrderCommandHandler(mockPrisma, bus);

      const result = await handler.execute(createTestCommand(CANCEL_ORDER, { id: 'order-1' }));

      expect(result.success).toBe(true);
      expect(update).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: { status: 'cancelled' },
      });
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(EVENT_TYPES.ORDER_STATUS_CHANGED);
      expect(result.events[0].payload).toEqual(
        expect.objectContaining({
          orderReference: 'ORD-001',
          previousStatus: status,
          newStatus: 'cancelled',
        })
      );
    }
  );

  it('rejects cancelling an order that is already assigned to a shipment', async () => {
    const { mockPrisma, update } = makePrisma({
      id: 'order-1',
      orderNumber: 'ORD-001',
      status: 'assigned',
    });
    const { bus } = mockEventBus();
    const handler = new CancelOrderCommandHandler(mockPrisma, bus);

    const result = await handler.execute(createTestCommand(CANCEL_ORDER, { id: 'order-1' }));

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Cannot cancel an order with status "assigned"/);
    expect(update).not.toHaveBeenCalled();
    expect(result.events).toHaveLength(0);
  });

  it('rejects cancelling an order that is already cancelled', async () => {
    const { mockPrisma, update } = makePrisma({
      id: 'order-1',
      orderNumber: 'ORD-001',
      status: 'cancelled',
    });
    const { bus } = mockEventBus();
    const handler = new CancelOrderCommandHandler(mockPrisma, bus);

    const result = await handler.execute(createTestCommand(CANCEL_ORDER, { id: 'order-1' }));

    expect(result.success).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects cancelling an archived order', async () => {
    const { mockPrisma, update } = makePrisma({
      id: 'order-1',
      orderNumber: 'ORD-001',
      status: 'archived',
    });
    const { bus } = mockEventBus();
    const handler = new CancelOrderCommandHandler(mockPrisma, bus);

    const result = await handler.execute(createTestCommand(CANCEL_ORDER, { id: 'order-1' }));

    expect(result.success).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });
});
