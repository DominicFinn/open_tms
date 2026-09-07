/**
 * Phase 2a dual-write (#217): every storage topology row created against a Location must also
 * carry the facilityId derived from it, so the read switchover in a later chunk finds no orphans.
 */

import { CreateWarehouseZoneCommandHandler, CREATE_WAREHOUSE_ZONE } from '../../commands/warehouse/CreateWarehouseZoneCommand';
import { CreateWarehouseBinCommandHandler, CREATE_WAREHOUSE_BIN } from '../../commands/warehouse/CreateWarehouseBinCommand';
import { BulkCreateBinsCommandHandler, BULK_CREATE_BINS } from '../../commands/warehouse/BulkCreateBinsCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

const mockLocation = {
  name: 'Leeds DC', address1: '1 Depot Way', address2: null,
  city: 'Leeds', state: null, postalCode: 'LS1 1AA', country: 'GB',
};

function buildPrisma(opts: { existingFacility?: { id: string } | null; location?: any } = {}) {
  const tx = {
    facility: {
      findUnique: jest.fn().mockResolvedValue(opts.existingFacility ?? null),
      create: jest.fn().mockResolvedValue({ id: 'fac-new', sourceLocationId: 'loc-1' }),
    },
    location: {
      findFirst: jest.fn().mockResolvedValue('location' in opts ? opts.location : mockLocation),
    },
    warehouseZone: {
      create: jest.fn().mockResolvedValue({ id: 'zone-1', name: 'Bulk A', zoneType: 'bulk_storage', locationId: 'loc-1', temperatureZone: null, hazmatCertified: false }),
      findUnique: jest.fn().mockResolvedValue({ id: 'zone-1', orgId: 'test-org' }),
    },
    warehouseBin: {
      create: jest.fn().mockResolvedValue({ id: 'bin-1', label: 'BULK-A-01-01', binType: 'pallet', zoneId: 'zone-1', locationId: 'loc-1' }),
      createMany: jest.fn().mockResolvedValue({ count: 4 }),
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    domainEventLog: { create: jest.fn().mockResolvedValue({}) },
  } as any;
  const prisma = {
    $transaction: jest.fn((fn: Function) => fn(tx)),
    domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
  } as any;
  return { prisma, tx };
}

const zonePayload = { locationId: 'loc-1', name: 'Bulk A', zoneType: 'bulk_storage' };
const binPayload = { zoneId: 'zone-1', locationId: 'loc-1', label: 'BULK-A-01-01', binType: 'pallet' };
const bulkPayload = {
  zoneId: 'zone-1', locationId: 'loc-1', labelPattern: 'BULK-{aisle}-{row}-{level}',
  binType: 'pallet', aisles: ['A'], rowStart: 1, rowEnd: 2, levelStart: 1, levelEnd: 2,
};

describe('Facility dual-write on storage topology creates', () => {
  beforeEach(() => jest.clearAllMocks());

  it('derives a facility from the location when none exists yet, and files the zone under it', async () => {
    const { prisma, tx } = buildPrisma();
    const { bus } = mockEventBus();

    const result = await new CreateWarehouseZoneCommandHandler(prisma, bus)
      .execute(createTestCommand(CREATE_WAREHOUSE_ZONE, zonePayload));

    expect(result.success).toBe(true);
    expect(tx.facility.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ orgId: 'test-org', sourceLocationId: 'loc-1', name: 'Leeds DC' }),
      })
    );
    expect(tx.warehouseZone.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ facilityId: 'fac-new', locationId: 'loc-1' }) })
    );
    const types = result.events!.map(e => e.type);
    expect(types).toEqual([EVENT_TYPES.FACILITY_CREATED, EVENT_TYPES.WAREHOUSE_ZONE_CREATED]);
  });

  it('reuses the existing facility rather than creating a second one', async () => {
    const { prisma, tx } = buildPrisma({ existingFacility: { id: 'fac-1' } });
    const { bus } = mockEventBus();

    const result = await new CreateWarehouseZoneCommandHandler(prisma, bus)
      .execute(createTestCommand(CREATE_WAREHOUSE_ZONE, zonePayload));

    expect(result.success).toBe(true);
    expect(tx.facility.create).not.toHaveBeenCalled();
    expect(tx.warehouseZone.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ facilityId: 'fac-1' }) })
    );
    expect(result.events!.map(e => e.type)).toEqual([EVENT_TYPES.WAREHOUSE_ZONE_CREATED]);
  });

  it('resolves the facility within the calling org, so another tenant s location cannot be reused', async () => {
    const { prisma, tx } = buildPrisma({ existingFacility: { id: 'fac-1' } });
    const { bus } = mockEventBus();

    await new CreateWarehouseZoneCommandHandler(prisma, bus)
      .execute(createTestCommand(CREATE_WAREHOUSE_ZONE, zonePayload));

    expect(tx.facility.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orgId_sourceLocationId: { orgId: 'test-org', sourceLocationId: 'loc-1' } },
      })
    );
  });

  it('fails the whole command when the location belongs to another tenant', async () => {
    const { prisma, tx } = buildPrisma({ location: null });
    const { bus } = mockEventBus();

    const result = await new CreateWarehouseZoneCommandHandler(prisma, bus)
      .execute(createTestCommand(CREATE_WAREHOUSE_ZONE, zonePayload));

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
    expect(tx.warehouseZone.create).not.toHaveBeenCalled();
  });

  it('files a single bin under the facility', async () => {
    const { prisma, tx } = buildPrisma({ existingFacility: { id: 'fac-1' } });
    const { bus } = mockEventBus();

    const result = await new CreateWarehouseBinCommandHandler(prisma, bus)
      .execute(createTestCommand(CREATE_WAREHOUSE_BIN, binPayload));

    expect(result.success).toBe(true);
    expect(tx.warehouseBin.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ facilityId: 'fac-1' }) })
    );
  });

  it('resolves the facility once for a bulk batch and stamps every bin', async () => {
    const { prisma, tx } = buildPrisma({ existingFacility: { id: 'fac-1' } });
    const { bus } = mockEventBus();

    const result = await new BulkCreateBinsCommandHandler(prisma, bus)
      .execute(createTestCommand(BULK_CREATE_BINS, bulkPayload));

    expect(result.success).toBe(true);
    expect(tx.facility.findUnique).toHaveBeenCalledTimes(1);
    const created = tx.warehouseBin.createMany.mock.calls[0][0].data;
    expect(created).toHaveLength(4);
    expect(created.every((b: any) => b.facilityId === 'fac-1')).toBe(true);
  });
});
