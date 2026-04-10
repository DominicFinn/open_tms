import { CreateShipmentCommandHandler, CREATE_SHIPMENT } from '../../commands/shipments/CreateShipmentCommand';
import { UpdateShipmentCommandHandler, UPDATE_SHIPMENT } from '../../commands/shipments/UpdateShipmentCommand';
import { ArchiveShipmentCommandHandler, ARCHIVE_SHIPMENT } from '../../commands/shipments/ArchiveShipmentCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

const mockShipment = {
  id: 'ship-1',
  reference: 'SH-001',
  status: 'draft',
  customerId: 'cust-1',
  carrierId: null,
  laneId: null,
  originId: 'loc-1',
  destinationId: 'loc-2',
  proNumber: null,
  pickupDate: null,
  deliveryDate: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  customer: { id: 'cust-1', name: 'Acme' },
  origin: { id: 'loc-1', name: 'Chicago WH', city: 'Chicago', state: 'IL' },
  destination: { id: 'loc-2', name: 'NY Depot', city: 'New York', state: 'NY' },
  carrier: null,
  lane: null,
};

const mockTx = {
  shipment: {
    create: jest.fn().mockResolvedValue(mockShipment),
    update: jest.fn().mockResolvedValue(mockShipment),
    findFirstOrThrow: jest.fn().mockResolvedValue(mockShipment),
  },
  lane: {
    findFirst: jest.fn(),
    findFirstOrThrow: jest.fn(),
  },
  domainEventLog: {
    create: jest.fn().mockResolvedValue({}),
  },
} as any;

const mockPrisma = {
  $transaction: jest.fn((fn: Function) => fn(mockTx)),
  domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
} as any;

const mockQueue = {
  publish: jest.fn().mockResolvedValue('job-1'),
} as any;

describe('Shipment Command Handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('CreateShipmentCommandHandler', () => {
    it('creates shipment with direct origin/destination and emits SHIPMENT_CREATED', async () => {
      const { bus } = mockEventBus();
      const handler = new CreateShipmentCommandHandler(mockPrisma, bus, mockQueue);

      const result = await handler.execute(
        createTestCommand(CREATE_SHIPMENT, {
          reference: 'SH-001',
          customerId: 'cust-1',
          originId: 'loc-1',
          destinationId: 'loc-2',
          items: [],
        })
      );

      expect(result.success).toBe(true);
      expect(result.data?.reference).toBe('SH-001');
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(EVENT_TYPES.SHIPMENT_CREATED);
    });

    it('resolves origin/destination from lane', async () => {
      mockTx.lane.findFirst.mockResolvedValueOnce({
        id: 'lane-1',
        originId: 'loc-3',
        destinationId: 'loc-4',
        archived: false,
        origin: { id: 'loc-3' },
        destination: { id: 'loc-4' },
      });

      const { bus } = mockEventBus();
      const handler = new CreateShipmentCommandHandler(mockPrisma, bus, mockQueue);

      const result = await handler.execute(
        createTestCommand(CREATE_SHIPMENT, {
          reference: 'SH-002',
          customerId: 'cust-1',
          laneId: 'lane-1',
          items: [],
        })
      );

      expect(result.success).toBe(true);
      expect(result.data?.originId).toBe('loc-3');
      expect(result.data?.destinationId).toBe('loc-4');
    });

    it('publishes to outbound queues after successful creation', async () => {
      const { bus } = mockEventBus();
      const handler = new CreateShipmentCommandHandler(mockPrisma, bus, mockQueue);

      await handler.execute(
        createTestCommand(CREATE_SHIPMENT, {
          reference: 'SH-003',
          customerId: 'cust-1',
          originId: 'loc-1',
          destinationId: 'loc-2',
          items: [],
        })
      );

      expect(mockQueue.publish).toHaveBeenCalledTimes(2);
    });

    it('fails when lane not found', async () => {
      mockTx.lane.findFirst.mockResolvedValueOnce(null);
      const { bus } = mockEventBus();
      const handler = new CreateShipmentCommandHandler(mockPrisma, bus, mockQueue);

      const result = await handler.execute(
        createTestCommand(CREATE_SHIPMENT, {
          reference: 'SH-004',
          customerId: 'cust-1',
          laneId: 'nonexistent',
          items: [],
        })
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Lane not found');
    });
  });

  describe('UpdateShipmentCommandHandler', () => {
    it('updates shipment and emits SHIPMENT_UPDATED', async () => {
      const { bus } = mockEventBus();
      const handler = new UpdateShipmentCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(UPDATE_SHIPMENT, {
          id: 'ship-1',
          data: { proNumber: 'PRO-123' },
        })
      );

      expect(result.success).toBe(true);
      expect(result.events.some((e) => e.type === EVENT_TYPES.SHIPMENT_UPDATED)).toBe(true);
    });

    it('emits SHIPMENT_STATUS_CHANGED when status changes', async () => {
      mockTx.shipment.update.mockResolvedValueOnce({ ...mockShipment, status: 'in_transit' });
      const { bus } = mockEventBus();
      const handler = new UpdateShipmentCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(UPDATE_SHIPMENT, {
          id: 'ship-1',
          data: { status: 'in_transit' },
        })
      );

      const statusEvent = result.events.find((e) => e.type === EVENT_TYPES.SHIPMENT_STATUS_CHANGED);
      expect(statusEvent).toBeDefined();
      expect(statusEvent!.payload).toEqual(
        expect.objectContaining({ previousStatus: 'draft', newStatus: 'in_transit' })
      );
    });

    it('emits SHIPMENT_CARRIER_ASSIGNED when carrier changes', async () => {
      mockTx.shipment.update.mockResolvedValueOnce({ ...mockShipment, carrierId: 'carrier-1' });
      const { bus } = mockEventBus();
      const handler = new UpdateShipmentCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(UPDATE_SHIPMENT, {
          id: 'ship-1',
          data: { carrierId: 'carrier-1' },
        })
      );

      const carrierEvent = result.events.find((e) => e.type === EVENT_TYPES.SHIPMENT_CARRIER_ASSIGNED);
      expect(carrierEvent).toBeDefined();
    });
  });

  describe('ArchiveShipmentCommandHandler', () => {
    it('archives shipment and emits SHIPMENT_ARCHIVED', async () => {
      mockTx.shipment.update.mockResolvedValueOnce({ ...mockShipment, archived: true });
      const { bus } = mockEventBus();
      const handler = new ArchiveShipmentCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(ARCHIVE_SHIPMENT, { id: 'ship-1' })
      );

      expect(result.success).toBe(true);
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(EVENT_TYPES.SHIPMENT_ARCHIVED);
    });
  });
});
