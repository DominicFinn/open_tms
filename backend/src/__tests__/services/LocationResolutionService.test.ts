/**
 * Tests for LocationResolutionService — audit event emission on location
 * auto-creation via resolution.
 */

import { LocationResolutionService } from '../../services/LocationResolutionService';
import { EVENT_TYPES } from '../../events/eventTypes';

const mockLocation = {
  id: 'loc-new-1',
  name: 'Test Warehouse',
  address1: '123 Main St',
  city: 'Chicago',
  state: 'IL',
  country: 'US',
  lat: 41.8,
  lng: -87.6,
  archived: false,
};

const mockLocationsRepo = {
  create: jest.fn().mockResolvedValue(mockLocation),
  findById: jest.fn().mockResolvedValue(mockLocation),
} as any;

const mockArrivalCriteriaRepo = {
  findByLocationId: jest.fn().mockResolvedValue([]),
  createDefaultGeofence: jest.fn().mockResolvedValue({}),
} as any;

const mockPrisma = {
  location: {
    findFirst: jest.fn().mockResolvedValue(null),
  },
  organization: {
    findFirst: jest.fn().mockResolvedValue({ id: 'org-1', defaultGeofenceRadiusMeters: 200 }),
  },
} as any;

const mockEventBus = {
  publish: jest.fn().mockResolvedValue(undefined),
  publishBatch: jest.fn().mockResolvedValue(undefined),
  subscribe: jest.fn(),
  start: jest.fn(),
  stop: jest.fn(),
} as any;

describe('LocationResolutionService — Audit Events', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.location.findFirst.mockResolvedValue(null);
    mockLocationsRepo.create.mockResolvedValue(mockLocation);
  });

  it('emits LOCATION_CREATED event when a new location is created', async () => {
    const service = new LocationResolutionService(
      mockPrisma,
      mockLocationsRepo,
      mockArrivalCriteriaRepo,
      mockEventBus,
    );

    const result = await service.resolveOrCreate({
      name: 'Test Warehouse',
      address1: '123 Main St',
      city: 'Chicago',
      country: 'US',
    }, 'user-1');

    expect(result.created).toBe(true);
    expect(mockEventBus.publish).toHaveBeenCalledTimes(1);

    const publishedEvent = mockEventBus.publish.mock.calls[0][0];
    expect(publishedEvent.type).toBe(EVENT_TYPES.LOCATION_CREATED);
    expect(publishedEvent.entityType).toBe('location');
    expect(publishedEvent.entityId).toBe('loc-new-1');
    expect(publishedEvent.payload).toEqual(expect.objectContaining({
      locationName: 'Test Warehouse',
      name: 'Test Warehouse',
      city: 'Chicago',
      country: 'US',
      source: 'resolution',
    }));
  });

  it('includes actorId in the emitted event', async () => {
    const service = new LocationResolutionService(
      mockPrisma,
      mockLocationsRepo,
      mockArrivalCriteriaRepo,
      mockEventBus,
    );

    await service.resolveOrCreate({
      name: 'Test Warehouse',
      address1: '123 Main St',
      city: 'Chicago',
      country: 'US',
    }, 'user-42');

    const publishedEvent = mockEventBus.publish.mock.calls[0][0];
    expect(publishedEvent.actorId).toBe('user-42');
  });

  it('includes orgId from the database in the emitted event', async () => {
    const service = new LocationResolutionService(
      mockPrisma,
      mockLocationsRepo,
      mockArrivalCriteriaRepo,
      mockEventBus,
    );

    await service.resolveOrCreate({
      name: 'Test Warehouse',
      address1: '123 Main St',
      city: 'Chicago',
      country: 'US',
    });

    const publishedEvent = mockEventBus.publish.mock.calls[0][0];
    expect(publishedEvent.orgId).toBe('org-1');
  });

  it('does NOT emit event when an existing location is matched', async () => {
    mockPrisma.location.findFirst.mockResolvedValue(mockLocation);

    const service = new LocationResolutionService(
      mockPrisma,
      mockLocationsRepo,
      mockArrivalCriteriaRepo,
      mockEventBus,
    );

    const result = await service.resolveOrCreate({
      name: 'Test Warehouse',
      address1: '123 Main St',
      city: 'Chicago',
      country: 'US',
    });

    expect(result.created).toBe(false);
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('still creates location successfully if event bus publish fails', async () => {
    mockEventBus.publish.mockRejectedValueOnce(new Error('Bus unavailable'));

    const service = new LocationResolutionService(
      mockPrisma,
      mockLocationsRepo,
      mockArrivalCriteriaRepo,
      mockEventBus,
    );

    const result = await service.resolveOrCreate({
      name: 'Test Warehouse',
      address1: '123 Main St',
      city: 'Chicago',
      country: 'US',
    });

    // Location creation should succeed despite event failure
    expect(result.created).toBe(true);
    expect(result.location.id).toBe('loc-new-1');
  });

  it('works without event bus (backward compatible)', async () => {
    const service = new LocationResolutionService(
      mockPrisma,
      mockLocationsRepo,
      mockArrivalCriteriaRepo,
      // No event bus provided
    );

    const result = await service.resolveOrCreate({
      name: 'Test Warehouse',
      address1: '123 Main St',
      city: 'Chicago',
      country: 'US',
    });

    expect(result.created).toBe(true);
    expect(result.location.id).toBe('loc-new-1');
    // No event bus → no publish call → no error
  });

  it('sets event metadata source to "resolution"', async () => {
    const service = new LocationResolutionService(
      mockPrisma,
      mockLocationsRepo,
      mockArrivalCriteriaRepo,
      mockEventBus,
    );

    await service.resolveOrCreate({
      name: 'Test Warehouse',
      address1: '123 Main St',
      city: 'Chicago',
      country: 'US',
    });

    const publishedEvent = mockEventBus.publish.mock.calls[0][0];
    expect(publishedEvent.metadata.source).toBe('resolution');
  });
});
