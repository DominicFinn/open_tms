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
  packagingType: {
    findUnique: jest.fn().mockResolvedValue({ kind: 'pallet' }),
  },
  // Phase 1+4 review fix: CreateOrderCommand verifies customer belongs to org.
  customer: {
    findFirst: jest.fn().mockResolvedValue({ id: 'cust-1' }),
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
          orgId: 'test-org',
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
        orderData: { orgId: 'my-org', orderNumber: 'ORD-002', customerId: 'cust-1' },
        status: 'pending',
      }, { orgId: 'my-org', actorId: 'user-42' });

      const result = await handler.execute(command);

      expect(result.events[0].orgId).toBe('my-org');
      expect(result.events[0].actorId).toBe('user-42');
      expect(result.events[0].metadata.correlationId).toBe(command.metadata.correlationId);
      expect(result.events[0].metadata.source).toBe('test');
    });

    it('passes Phase 1 line fields (hazmat detail, customs, temp range) to the create call', async () => {
      mockTx.order.create.mockClear();
      const { bus } = mockEventBus();
      const handler = new CreateOrderCommandHandler(mockPrisma, bus);

      await handler.execute(
        createTestCommand(CREATE_ORDER, {
          orderData: {
            orgId: 'test-org',
            orderNumber: 'ORD-HAZ-1',
            customerId: 'cust-1',
            lineItems: [
              {
                sku: 'GAS-CAN',
                description: 'Gasoline can',
                quantity: 2,
                weight: 5,
                weightUnit: 'kg',
                length: 30, width: 20, height: 40, dimUnit: 'cm',
                unitOfMeasure: 'pieces',
                hazmat: true,
                unNumber: 'UN1203',
                hazmatClass: '3',
                packingGroup: 'II',
                properShippingName: 'Gasoline',
                hsCode: '2710.12',
                countryOfOrigin: 'US',
                tempMinC: -10,
                tempMaxC: 30,
                freightClass: '85',
                nmfcCode: '49500',
              },
            ],
          },
          status: 'pending',
        })
      );

      expect(mockTx.order.create).toHaveBeenCalledTimes(1);
      const dataArg = mockTx.order.create.mock.calls[0][0].data;
      const createdLineItems = dataArg.lineItems.create;
      expect(createdLineItems).toHaveLength(1);
      const line = createdLineItems[0];
      expect(line).toEqual(expect.objectContaining({
        sku: 'GAS-CAN',
        unitOfMeasure: 'pieces',
        unNumber: 'UN1203',
        hazmatClass: '3',
        packingGroup: 'II',
        properShippingName: 'Gasoline',
        hsCode: '2710.12',
        countryOfOrigin: 'US',
        tempMinC: -10,
        tempMaxC: 30,
        freightClass: '85',
        nmfcCode: '49500',
      }));
    });

    it('auto-generates N TrackableUnits when packingSummary is supplied', async () => {
      mockTx.order.create.mockClear();
      mockTx.packagingType.findUnique.mockResolvedValueOnce({ kind: 'pallet' });
      const { bus } = mockEventBus();
      const handler = new CreateOrderCommandHandler(mockPrisma, bus);

      await handler.execute(
        createTestCommand(CREATE_ORDER, {
          orderData: {
            orgId: 'test-org',
            orderNumber: 'ORD-PACK-1',
            customerId: 'cust-1',
            lineItems: [
              { sku: 'WIDGET', description: 'widget', quantity: 100, weight: 0.5 },
            ],
            packingSummary: {
              packagingTypeId: 'pt-eur1',
              unitCount: 3,
              stackable: true,
            },
          },
          status: 'pending',
        })
      );

      const dataArg = mockTx.order.create.mock.calls[0][0].data;
      expect(dataArg.trackableUnits).toBeDefined();
      const units = dataArg.trackableUnits.create;
      expect(units).toHaveLength(3);
      expect(units[0]).toEqual(expect.objectContaining({
        unitType: 'pallet',
        sequenceNumber: 1,
        packagingTypeId: 'pt-eur1',
      }));
      expect(units[2].sequenceNumber).toBe(3);
    });

    it('passes packingSummary through to the ORDER_CREATED event payload', async () => {
      mockTx.order.create.mockClear();
      mockTx.packagingType.findUnique.mockResolvedValueOnce({ kind: 'carton' });
      const { bus } = mockEventBus();
      const handler = new CreateOrderCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(CREATE_ORDER, {
          orderData: {
            orgId: 'test-org',
            orderNumber: 'ORD-PACK-EVT-1',
            customerId: 'cust-1',
            packingSummary: { packagingTypeId: 'pt-carton-m', unitCount: 12, stackable: false },
          },
          status: 'pending',
        })
      );

      const event = result.events[0];
      expect(event.payload).toEqual(expect.objectContaining({
        packingSummary: {
          packagingTypeId: 'pt-carton-m',
          unitCount: 12,
          stackable: false,
        },
      }));
    });

    it('returns failure on database error', async () => {
      const failPrisma = {
        $transaction: jest.fn(() => { throw new Error('DB connection failed'); }),
        domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
      } as any;
      const { bus } = mockEventBus();
      const handler = new CreateOrderCommandHandler(failPrisma, bus);

      const result = await handler.execute(
        createTestCommand(CREATE_ORDER, { orderData: { orgId: 'test-org', orderNumber: 'X', customerId: 'c' }, status: 'pending' })
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
