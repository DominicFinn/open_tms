import { CreateFacilityCommandHandler, CREATE_FACILITY } from '../../commands/facilities/CreateFacilityCommand';
import { UpdateFacilityCommandHandler, UPDATE_FACILITY } from '../../commands/facilities/UpdateFacilityCommand';
import { ArchiveFacilityCommandHandler, ARCHIVE_FACILITY } from '../../commands/facilities/ArchiveFacilityCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

const mockFacility = {
  id: 'fac-1', orgId: 'test-org', name: 'Leeds DC', code: 'LEE1',
  sourceLocationId: 'loc-1', address1: '1 Depot Way', address2: null,
  city: 'Leeds', state: null, postalCode: 'LS1 1AA', country: 'GB',
  timezone: null, active: true, archived: false, archivedAt: null,
  createdAt: new Date(), updatedAt: new Date(),
};

function buildPrisma(overrides: any = {}) {
  const tx = {
    facility: {
      create: jest.fn().mockResolvedValue(mockFacility),
      update: jest.fn().mockResolvedValue(mockFacility),
      findUnique: jest.fn().mockResolvedValue(overrides.findUnique ?? null),
      findFirst: jest.fn().mockResolvedValue('findFirst' in overrides ? overrides.findFirst : mockFacility),
    },
    warehouseZone: {
      count: jest.fn().mockResolvedValue(overrides.activeZones ?? 0),
    },
    domainEventLog: { create: jest.fn().mockResolvedValue({}) },
  } as any;
  const prisma = {
    $transaction: jest.fn((fn: Function) => fn(tx)),
    domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
  } as any;
  return { prisma, tx };
}

describe('Facility command handlers', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('CreateFacilityCommandHandler', () => {
    it('creates the facility and emits FACILITY_CREATED', async () => {
      const { prisma, tx } = buildPrisma();
      const { bus } = mockEventBus();
      const handler = new CreateFacilityCommandHandler(prisma, bus);

      const result = await handler.execute(
        createTestCommand(CREATE_FACILITY, { name: 'Leeds DC', code: 'LEE1', sourceLocationId: 'loc-1' })
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: 'fac-1', name: 'Leeds DC' });
      expect(tx.facility.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ orgId: 'test-org', name: 'Leeds DC' }) })
      );
      expect(result.events).toHaveLength(1);
      expect(result.events![0].type).toBe(EVENT_TYPES.FACILITY_CREATED);
      expect(result.events![0].payload).toEqual({ sourceLocationId: 'loc-1', derived: false });
    });

    it('carries command metadata onto the event', async () => {
      const { prisma } = buildPrisma();
      const { bus } = mockEventBus();
      const handler = new CreateFacilityCommandHandler(prisma, bus);

      const command = createTestCommand(CREATE_FACILITY, { name: 'Leeds DC' });
      const result = await handler.execute(command);

      expect(result.events![0].orgId).toBe('test-org');
      expect(result.events![0].actorId).toBe('test-user');
      expect(result.events![0].metadata.correlationId).toBe(command.metadata.correlationId);
      expect(result.events![0].metadata.source).toBe('test');
    });

    it('refuses a second facility for the same source location', async () => {
      const { prisma, tx } = buildPrisma({ findUnique: { id: 'fac-existing' } });
      const { bus } = mockEventBus();
      const handler = new CreateFacilityCommandHandler(prisma, bus);

      const result = await handler.execute(
        createTestCommand(CREATE_FACILITY, { name: 'Leeds DC', sourceLocationId: 'loc-1' })
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
      expect(tx.facility.create).not.toHaveBeenCalled();
    });
  });

  describe('UpdateFacilityCommandHandler', () => {
    it('updates and emits FACILITY_UPDATED with the changed keys', async () => {
      const { prisma, tx } = buildPrisma();
      const { bus } = mockEventBus();
      const handler = new UpdateFacilityCommandHandler(prisma, bus);

      const result = await handler.execute(
        createTestCommand(UPDATE_FACILITY, { facilityId: 'fac-1', name: 'Leeds DC North' })
      );

      expect(result.success).toBe(true);
      expect(tx.facility.update).toHaveBeenCalledWith({ where: { id: 'fac-1' }, data: { name: 'Leeds DC North' } });
      expect(result.events![0].type).toBe(EVENT_TYPES.FACILITY_UPDATED);
      expect((result.events![0].payload as any).changes).toEqual(['name']);
    });

    it('scopes the lookup by org so a cross-tenant id misses', async () => {
      const { prisma, tx } = buildPrisma({ findFirst: null });
      const { bus } = mockEventBus();
      const handler = new UpdateFacilityCommandHandler(prisma, bus);

      const result = await handler.execute(
        createTestCommand(UPDATE_FACILITY, { facilityId: 'other-org-facility', name: 'Nope' })
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
      expect(tx.facility.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'other-org-facility', orgId: 'test-org' } })
      );
      expect(tx.facility.update).not.toHaveBeenCalled();
    });
  });

  describe('ArchiveFacilityCommandHandler', () => {
    it('archives an empty facility and emits FACILITY_ARCHIVED', async () => {
      const { prisma, tx } = buildPrisma({ findFirst: { id: 'fac-1', archived: false } });
      const { bus } = mockEventBus();
      const handler = new ArchiveFacilityCommandHandler(prisma, bus);

      const result = await handler.execute(createTestCommand(ARCHIVE_FACILITY, { facilityId: 'fac-1' }));

      expect(result.success).toBe(true);
      expect(tx.facility.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ archived: true, active: false }) })
      );
      expect(result.events![0].type).toBe(EVENT_TYPES.FACILITY_ARCHIVED);
    });

    it('refuses while active zones still hang off it', async () => {
      const { prisma, tx } = buildPrisma({ findFirst: { id: 'fac-1', archived: false }, activeZones: 3 });
      const { bus } = mockEventBus();
      const handler = new ArchiveFacilityCommandHandler(prisma, bus);

      const result = await handler.execute(createTestCommand(ARCHIVE_FACILITY, { facilityId: 'fac-1' }));

      expect(result.success).toBe(false);
      expect(result.error).toContain('active zones');
      expect(tx.facility.update).not.toHaveBeenCalled();
    });

    it('is a no-op on an already archived facility', async () => {
      const { prisma, tx } = buildPrisma({ findFirst: { id: 'fac-1', archived: true } });
      const { bus } = mockEventBus();
      const handler = new ArchiveFacilityCommandHandler(prisma, bus);

      const result = await handler.execute(createTestCommand(ARCHIVE_FACILITY, { facilityId: 'fac-1' }));

      expect(result.success).toBe(true);
      expect(tx.facility.update).not.toHaveBeenCalled();
      expect(result.events).toHaveLength(0);
    });
  });
});
