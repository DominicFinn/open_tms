import { CreateLocationCommandHandler, CREATE_LOCATION } from '../../commands/locations/CreateLocationCommand';
import { UpdateLocationCommandHandler, UPDATE_LOCATION } from '../../commands/locations/UpdateLocationCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

const mockLocation = {
  id: 'loc-1', name: 'Chicago Warehouse', address1: '123 Main St',
  city: 'Chicago', state: 'IL', country: 'US', lat: 41.88, lng: -87.63,
  createdAt: new Date(), updatedAt: new Date(),
};

const mockTx = {
  location: {
    create: jest.fn().mockResolvedValue(mockLocation),
    update: jest.fn().mockResolvedValue(mockLocation),
    findUniqueOrThrow: jest.fn().mockResolvedValue(mockLocation),
  },
  domainEventLog: { create: jest.fn().mockResolvedValue({}) },
} as any;

const mockPrisma = {
  $transaction: jest.fn((fn: Function) => fn(mockTx)),
  domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
} as any;

describe('Location Command Handlers', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('CreateLocationCommandHandler', () => {
    it('creates location and emits LOCATION_CREATED', async () => {
      const { bus } = mockEventBus();
      const handler = new CreateLocationCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(CREATE_LOCATION, {
          name: 'Chicago Warehouse',
          address1: '123 Main St',
          city: 'Chicago',
          country: 'US',
          lat: 41.88,
          lng: -87.63,
        })
      );

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('Chicago Warehouse');
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(EVENT_TYPES.LOCATION_CREATED);
      expect(result.events[0].payload).toEqual(
        expect.objectContaining({ name: 'Chicago Warehouse', city: 'Chicago' })
      );
    });
  });

  describe('UpdateLocationCommandHandler', () => {
    it('updates location and emits LOCATION_UPDATED', async () => {
      const { bus } = mockEventBus();
      const handler = new UpdateLocationCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(UPDATE_LOCATION, {
          id: 'loc-1',
          data: { name: 'Chicago Main Warehouse' },
        })
      );

      expect(result.success).toBe(true);
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(EVENT_TYPES.LOCATION_UPDATED);
    });
  });
});
