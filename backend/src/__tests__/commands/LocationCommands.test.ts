import { CreateLocationCommandHandler, CREATE_LOCATION } from '../../commands/locations/CreateLocationCommand';
import { UpdateLocationCommandHandler, UPDATE_LOCATION } from '../../commands/locations/UpdateLocationCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

const mockLocation = {
  id: 'loc-1', name: 'Chicago Warehouse', address1: '123 Main St',
  city: 'Chicago', state: 'IL', country: 'US', lat: 41.88, lng: -87.63,
  locationType: null, facilityCapabilities: null, operatingHours: null,
  appointmentRequired: false, dockCount: null, maxTrailerLengthFt: null,
  contactName: null, contactPhone: null, contactEmail: null,
  createdAt: new Date(), updatedAt: new Date(),
};

const mockLocationWithMetadata = {
  ...mockLocation,
  id: 'loc-2',
  name: 'Atlanta Cross Dock',
  locationType: 'cross_dock',
  facilityCapabilities: { crossDockCapable: true, hasColdStorage: false },
  appointmentRequired: true,
  dockCount: 12,
  maxTrailerLengthFt: 53,
  contactName: 'Jane Doe',
  contactPhone: '555-0100',
  contactEmail: 'jane@example.com',
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

    it('creates location with metadata and includes locationType in event', async () => {
      const { bus } = mockEventBus();
      mockTx.location.create.mockResolvedValueOnce(mockLocationWithMetadata);
      const handler = new CreateLocationCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(CREATE_LOCATION, {
          name: 'Atlanta Cross Dock',
          address1: '456 Logistics Pkwy',
          city: 'Atlanta',
          country: 'US',
          locationType: 'cross_dock',
          facilityCapabilities: { crossDockCapable: true, hasColdStorage: false },
          appointmentRequired: true,
          dockCount: 12,
          maxTrailerLengthFt: 53,
          contactName: 'Jane Doe',
          contactPhone: '555-0100',
          contactEmail: 'jane@example.com',
        })
      );

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('Atlanta Cross Dock');
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(EVENT_TYPES.LOCATION_CREATED);
      expect(result.events[0].payload).toEqual(
        expect.objectContaining({ locationType: 'cross_dock' })
      );
      // Verify all metadata fields were passed to Prisma create
      expect(mockTx.location.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          locationType: 'cross_dock',
          appointmentRequired: true,
          dockCount: 12,
          maxTrailerLengthFt: 53,
          contactName: 'Jane Doe',
        }),
      });
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

    it('updates location metadata fields', async () => {
      const { bus } = mockEventBus();
      mockTx.location.update.mockResolvedValueOnce({
        ...mockLocation,
        locationType: 'distribution_centre',
        appointmentRequired: true,
        dockCount: 8,
      });
      const handler = new UpdateLocationCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(UPDATE_LOCATION, {
          id: 'loc-1',
          data: {
            locationType: 'distribution_centre',
            appointmentRequired: true,
            dockCount: 8,
            facilityCapabilities: { hasColdStorage: true },
          },
        })
      );

      expect(result.success).toBe(true);
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(EVENT_TYPES.LOCATION_UPDATED);
      expect((result.events[0].payload as any).changes).toEqual(
        expect.arrayContaining(['locationType', 'appointmentRequired', 'dockCount', 'facilityCapabilities'])
      );
    });
  });
});
