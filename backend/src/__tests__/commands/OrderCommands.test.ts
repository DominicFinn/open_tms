import { CreateOrderCommandHandler, CREATE_ORDER } from '../../commands/orders/CreateOrderCommand';
import { UpdateOrderCommandHandler, UPDATE_ORDER } from '../../commands/orders/UpdateOrderCommand';
import { ArchiveOrderCommandHandler, ARCHIVE_ORDER } from '../../commands/orders/ArchiveOrderCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

// Mock PrismaClient
const mockOrder = {
  id: 'order-1',
  orderNumber: 'ORD-001',
  status: 'pending',
  customerId: 'cust-1',
  originId: 'loc-1',
  destinationId: 'loc-2',
  importSource: 'manual',
  createdAt: new Date(),
  updatedAt: new Date(),
  customer: { id: 'cust-1', name: 'Acme', contactEmail: null },
  origin: { id: 'loc-1', name: 'Chicago WH', city: 'Chicago', state: 'IL' },
  destination: { id: 'loc-2', name: 'NY Depot', city: 'New York', state: 'NY' },
};

const mockTx = {
  order: {
    create: jest.fn().mockResolvedValue(mockOrder),
    update: jest.fn().mockResolvedValue({ ...mockOrder, status: 'validated' }),
    findUniqueOrThrow: jest.fn().mockResolvedValue(mockOrder),
  },
  domainEventLog: {
    create: jest.fn().mockResolvedValue({}),
    findFirst: jest.fn().mockResolvedValue(null),
  },
} as any;

const mockPrisma = {
  $transaction: jest.fn((fn: Function) => fn(mockTx)),
  domainEventLog: {
    findFirst: jest.fn().mockResolvedValue(null),
  },
} as any;

describe('Order Command Handlers', () => {
  describe('CreateOrderCommandHandler', () => {
    it('creates an order and emits ORDER_CREATED event', async () => {
      const { bus, fannedOut } = mockEventBus();
      const handler = new CreateOrderCommandHandler(mockPrisma, bus);

      const command = createTestCommand(CREATE_ORDER, {
        orderData: {
          orderNumber: 'ORD-001',
          customerId: 'cust-1',
          originId: 'loc-1',
          destinationId: 'loc-2',
        },
        status: 'validated',
      });

      const result = await handler.execute(command);

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('order-1');
      expect(result.data?.orderNumber).toBe('ORD-001');
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(EVENT_TYPES.ORDER_CREATED);
      expect(result.events[0].entityType).toBe('order');
      expect(result.events[0].entityId).toBe('order-1');
    });

    it('carries command metadata into emitted events', async () => {
      const { bus } = mockEventBus();
      const handler = new CreateOrderCommandHandler(mockPrisma, bus);

      const command = createTestCommand(CREATE_ORDER, {
        orderData: { orderNumber: 'ORD-002', customerId: 'cust-1' },
        status: 'pending',
      }, { orgId: 'my-org', actorId: 'user-42' });

      const result = await handler.execute(command);

      expect(result.events[0].orgId).toBe('my-org');
      expect(result.events[0].actorId).toBe('user-42');
      expect(result.events[0].metadata.correlationId).toBe(command.metadata.correlationId);
      expect(result.events[0].metadata.source).toBe('test');
    });

    it('returns failure on database error', async () => {
      const failPrisma = {
        $transaction: jest.fn(() => { throw new Error('DB connection failed'); }),
        domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
      } as any;
      const { bus } = mockEventBus();
      const handler = new CreateOrderCommandHandler(failPrisma, bus);

      const result = await handler.execute(
        createTestCommand(CREATE_ORDER, { orderData: { orderNumber: 'X', customerId: 'c' }, status: 'pending' })
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('DB connection failed');
      expect(result.events).toHaveLength(0);
    });
  });

  describe('UpdateOrderCommandHandler', () => {
    it('updates order and emits ORDER_UPDATED event', async () => {
      const { bus } = mockEventBus();
      const handler = new UpdateOrderCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(UPDATE_ORDER, {
          id: 'order-1',
          data: { notes: 'Updated notes' },
        })
      );

      expect(result.success).toBe(true);
      expect(result.events.length).toBeGreaterThanOrEqual(1);
      expect(result.events[0].type).toBe(EVENT_TYPES.ORDER_UPDATED);
    });

    it('emits ORDER_STATUS_CHANGED when status changes', async () => {
      const { bus } = mockEventBus();
      const handler = new UpdateOrderCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(UPDATE_ORDER, {
          id: 'order-1',
          data: { status: 'validated' },
        })
      );

      expect(result.success).toBe(true);
      const statusEvent = result.events.find((e) => e.type === EVENT_TYPES.ORDER_STATUS_CHANGED);
      expect(statusEvent).toBeDefined();
      expect(statusEvent!.payload).toEqual(
        expect.objectContaining({
          previousStatus: 'pending',
          newStatus: 'validated',
        })
      );
    });
  });

  describe('ArchiveOrderCommandHandler', () => {
    it('archives order and emits ORDER_ARCHIVED event', async () => {
      mockTx.order.update.mockResolvedValueOnce({ ...mockOrder, archived: true, status: 'archived' });
      const { bus } = mockEventBus();
      const handler = new ArchiveOrderCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(ARCHIVE_ORDER, { id: 'order-1' })
      );

      expect(result.success).toBe(true);
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(EVENT_TYPES.ORDER_ARCHIVED);
    });
  });
});
