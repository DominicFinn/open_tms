import { CreateCustomerCommandHandler, CREATE_CUSTOMER } from '../../commands/customers/CreateCustomerCommand';
import { UpdateCustomerCommandHandler, UPDATE_CUSTOMER } from '../../commands/customers/UpdateCustomerCommand';
import { ArchiveCustomerCommandHandler, ARCHIVE_CUSTOMER } from '../../commands/customers/ArchiveCustomerCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

const mockCustomer = {
  id: 'cust-1', name: 'Acme Corp', contactEmail: 'orders@acme.com',
  archived: false, createdAt: new Date(), updatedAt: new Date(),
};

const mockTx = {
  customer: {
    create: jest.fn().mockResolvedValue(mockCustomer),
    update: jest.fn().mockResolvedValue(mockCustomer),
  },
  domainEventLog: { create: jest.fn().mockResolvedValue({}) },
} as any;

const mockPrisma = {
  $transaction: jest.fn((fn: Function) => fn(mockTx)),
  domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
} as any;

describe('Customer Command Handlers', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('CreateCustomerCommandHandler', () => {
    it('creates customer and emits CUSTOMER_CREATED', async () => {
      const { bus } = mockEventBus();
      const handler = new CreateCustomerCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(CREATE_CUSTOMER, { name: 'Acme Corp', contactEmail: 'orders@acme.com' })
      );

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('Acme Corp');
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(EVENT_TYPES.CUSTOMER_CREATED);
    });
  });

  describe('UpdateCustomerCommandHandler', () => {
    it('updates customer and emits CUSTOMER_UPDATED', async () => {
      const { bus } = mockEventBus();
      const handler = new UpdateCustomerCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(UPDATE_CUSTOMER, {
          id: 'cust-1',
          data: { contactEmail: 'new@acme.com' },
        })
      );

      expect(result.success).toBe(true);
      expect(result.events[0].type).toBe(EVENT_TYPES.CUSTOMER_UPDATED);
    });
  });

  describe('ArchiveCustomerCommandHandler', () => {
    it('archives customer and emits CUSTOMER_ARCHIVED', async () => {
      mockTx.customer.update.mockResolvedValueOnce({ ...mockCustomer, archived: true });
      const { bus } = mockEventBus();
      const handler = new ArchiveCustomerCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(ARCHIVE_CUSTOMER, { id: 'cust-1' })
      );

      expect(result.success).toBe(true);
      expect(result.events[0].type).toBe(EVENT_TYPES.CUSTOMER_ARCHIVED);
    });
  });
});
