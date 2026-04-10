import { CreateCarrierCommandHandler, CREATE_CARRIER } from '../../commands/carriers/CreateCarrierCommand';
import { UpdateCarrierCommandHandler, UPDATE_CARRIER } from '../../commands/carriers/UpdateCarrierCommand';
import { ArchiveCarrierCommandHandler, ARCHIVE_CARRIER } from '../../commands/carriers/ArchiveCarrierCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

const mockCarrier = {
  id: 'carrier-1', name: 'FastFreight', mcNumber: 'MC123', dotNumber: null,
  contactEmail: 'ops@fast.com', archived: false, createdAt: new Date(), updatedAt: new Date(),
};

const mockTx = {
  carrier: {
    create: jest.fn().mockResolvedValue(mockCarrier),
    update: jest.fn().mockResolvedValue(mockCarrier),
  },
  domainEventLog: { create: jest.fn().mockResolvedValue({}) },
} as any;

const mockPrisma = {
  $transaction: jest.fn((fn: Function) => fn(mockTx)),
  domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
} as any;

describe('Carrier Command Handlers', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('CreateCarrierCommandHandler', () => {
    it('creates carrier and emits CARRIER_CREATED', async () => {
      const { bus } = mockEventBus();
      const handler = new CreateCarrierCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(CREATE_CARRIER, { name: 'FastFreight', mcNumber: 'MC123' })
      );

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('FastFreight');
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(EVENT_TYPES.CARRIER_CREATED);
      expect(result.events[0].entityType).toBe('carrier');
    });
  });

  describe('UpdateCarrierCommandHandler', () => {
    it('updates carrier and emits CARRIER_UPDATED', async () => {
      const { bus } = mockEventBus();
      const handler = new UpdateCarrierCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(UPDATE_CARRIER, { id: 'carrier-1', data: { name: 'SuperFreight' } })
      );

      expect(result.success).toBe(true);
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(EVENT_TYPES.CARRIER_UPDATED);
      expect(result.events[0].payload).toEqual(
        expect.objectContaining({ changes: ['name'] })
      );
    });
  });

  describe('ArchiveCarrierCommandHandler', () => {
    it('archives carrier and emits CARRIER_ARCHIVED', async () => {
      mockTx.carrier.update.mockResolvedValueOnce({ ...mockCarrier, archived: true });
      const { bus } = mockEventBus();
      const handler = new ArchiveCarrierCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(ARCHIVE_CARRIER, { id: 'carrier-1' })
      );

      expect(result.success).toBe(true);
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(EVENT_TYPES.CARRIER_ARCHIVED);
    });
  });
});
