import { CreateGeofenceCommandHandler, CREATE_GEOFENCE } from '../../commands/geofences/CreateGeofenceCommand';
import { UpdateGeofenceCommandHandler, UPDATE_GEOFENCE } from '../../commands/geofences/UpdateGeofenceCommand';
import { ArchiveGeofenceCommandHandler, ARCHIVE_GEOFENCE } from '../../commands/geofences/ArchiveGeofenceCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

const radialGeofence = {
  id: 'geo-1',
  orgId: 'test-org',
  entityType: 'location',
  entityId: 'loc-1',
  name: null,
  shapeType: 'radial',
  geometry: { centerLat: 41.88, centerLng: -87.63, radiusMeters: 200 },
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  archivedAt: null,
};

const polygonGeofence = {
  ...radialGeofence,
  id: 'geo-2',
  shapeType: 'polygon',
  geometry: {
    points: [
      { lat: 41.88, lng: -87.63 },
      { lat: 41.89, lng: -87.63 },
      { lat: 41.89, lng: -87.62 },
    ],
  },
};

const mockTx = {
  geofence: {
    create: jest.fn().mockResolvedValue(radialGeofence),
    update: jest.fn().mockResolvedValue(radialGeofence),
    findFirst: jest.fn().mockResolvedValue({ id: 'geo-1', active: true }),
  },
  domainEventLog: { create: jest.fn().mockResolvedValue({}) },
} as any;

const mockPrisma = {
  $transaction: jest.fn((fn: Function) => fn(mockTx)),
  domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
} as any;

describe('Geofence Command Handlers', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('CreateGeofenceCommandHandler', () => {
    it('creates a radial geofence and emits GEOFENCE_CREATED', async () => {
      const { bus } = mockEventBus();
      const handler = new CreateGeofenceCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(CREATE_GEOFENCE, {
          entityType: 'location',
          entityId: 'loc-1',
          shapeType: 'radial' as const,
          geometry: { centerLat: 41.88, centerLng: -87.63, radiusMeters: 200 },
        })
      );

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('geo-1');
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(EVENT_TYPES.GEOFENCE_CREATED);
      expect(result.events[0].payload).toEqual(
        expect.objectContaining({ entityType: 'location', entityId: 'loc-1', shapeType: 'radial' })
      );
      expect(result.events[0].orgId).toBe('test-org');
      expect(result.events[0].actorId).toBe('test-user');
    });

    it('creates a polygon geofence and emits GEOFENCE_CREATED', async () => {
      const { bus } = mockEventBus();
      mockTx.geofence.create.mockResolvedValueOnce(polygonGeofence);
      const handler = new CreateGeofenceCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(CREATE_GEOFENCE, {
          entityType: 'location',
          entityId: 'loc-1',
          shapeType: 'polygon' as const,
          geometry: {
            points: [
              { lat: 41.88, lng: -87.63 },
              { lat: 41.89, lng: -87.63 },
              { lat: 41.89, lng: -87.62 },
            ],
          },
        })
      );

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('geo-2');
      expect(result.events[0].type).toBe(EVENT_TYPES.GEOFENCE_CREATED);
      expect(result.events[0].payload).toEqual(
        expect.objectContaining({ shapeType: 'polygon' })
      );
    });

    it('fails when orgId is missing', async () => {
      const { bus } = mockEventBus();
      const handler = new CreateGeofenceCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(
          CREATE_GEOFENCE,
          {
            entityType: 'location',
            entityId: 'loc-1',
            shapeType: 'radial' as const,
            geometry: { centerLat: 41.88, centerLng: -87.63, radiusMeters: 200 },
          },
          { orgId: '' }
        )
      );

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/orgId is required/);
    });
  });

  describe('UpdateGeofenceCommandHandler', () => {
    it('updates a geofence and emits GEOFENCE_UPDATED', async () => {
      const { bus } = mockEventBus();
      const handler = new UpdateGeofenceCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(UPDATE_GEOFENCE, {
          geofenceId: 'geo-1',
          geometry: { centerLat: 41.9, centerLng: -87.6, radiusMeters: 300 },
        })
      );

      expect(result.success).toBe(true);
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(EVENT_TYPES.GEOFENCE_UPDATED);
    });

    it('fails when the geofence does not exist for this org', async () => {
      const { bus } = mockEventBus();
      mockTx.geofence.findFirst.mockResolvedValueOnce(null);
      const handler = new UpdateGeofenceCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(UPDATE_GEOFENCE, {
          geofenceId: 'missing-geo',
          name: 'New name',
        })
      );

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not found/);
    });
  });

  describe('ArchiveGeofenceCommandHandler', () => {
    it('archives a geofence and emits GEOFENCE_ARCHIVED', async () => {
      const { bus } = mockEventBus();
      const handler = new ArchiveGeofenceCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(ARCHIVE_GEOFENCE, { geofenceId: 'geo-1' })
      );

      expect(result.success).toBe(true);
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(EVENT_TYPES.GEOFENCE_ARCHIVED);
    });

    it('is idempotent when the geofence is already archived', async () => {
      const { bus } = mockEventBus();
      mockTx.geofence.findFirst.mockResolvedValueOnce({ id: 'geo-1', active: false });
      const handler = new ArchiveGeofenceCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(ARCHIVE_GEOFENCE, { geofenceId: 'geo-1' })
      );

      expect(result.success).toBe(true);
      expect(result.events).toHaveLength(0);
    });

    it('fails when the geofence does not exist for this org', async () => {
      const { bus } = mockEventBus();
      mockTx.geofence.findFirst.mockResolvedValueOnce(null);
      const handler = new ArchiveGeofenceCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(ARCHIVE_GEOFENCE, { geofenceId: 'missing-geo' })
      );

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not found/);
    });
  });
});
