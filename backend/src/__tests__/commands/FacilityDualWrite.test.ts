/**
 * Phase 2a (#217 then #248): storage topology creates.
 *
 * The command used to take a locationId and derive the facility from it. It now takes the
 * facilityId directly, looks it up within the caller's org, and writes locationId from the
 * facility's source location until 6c drops that column.
 */

import { CreateWarehouseZoneCommandHandler, CREATE_WAREHOUSE_ZONE } from '../../commands/warehouse/CreateWarehouseZoneCommand';
import { CreateWarehouseBinCommandHandler, CREATE_WAREHOUSE_BIN } from '../../commands/warehouse/CreateWarehouseBinCommand';
import { BulkCreateBinsCommandHandler, BULK_CREATE_BINS } from '../../commands/warehouse/BulkCreateBinsCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

function buildPrisma(opts: { facility?: { id: string; sourceLocationId: string | null } | null } = {}) {
  const facility = 'facility' in opts ? opts.facility : { id: 'fac-1', sourceLocationId: 'loc-1' };
  const tx = {
    facility: { findFirst: jest.fn().mockResolvedValue(facility) },
    warehouseZone: {
      create: jest.fn().mockResolvedValue({ id: 'zone-1', name: 'Bulk A', zoneType: 'bulk_storage', locationId: 'loc-1', temperatureZone: null, hazmatCertified: false }),
      findUnique: jest.fn().mockResolvedValue({ id: 'zone-1', orgId: 'test-org' }),
    },
    warehouseBin: {
      create: jest.fn().mockResolvedValue({ id: 'bin-1', label: 'BULK-A-01-01', binType: 'pallet', zoneId: 'zone-1', locationId: 'loc-1' }),
      createMany: jest.fn().mockResolvedValue({ count: 4 }),
      findFirst: jest.fn().mockResolvedValue(null),
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

const zonePayload = { facilityId: 'fac-1', name: 'Bulk A', zoneType: 'bulk_storage' };
const binPayload = { zoneId: 'zone-1', facilityId: 'fac-1', label: 'BULK-A-01-01', binType: 'pallet' };
const bulkPayload = {
  zoneId: 'zone-1', facilityId: 'fac-1', labelPattern: 'BULK-{aisle}-{row}-{level}',
  binType: 'pallet', aisles: ['A'], rowStart: 1, rowEnd: 2, levelStart: 1, levelEnd: 2,
};

describe('Storage topology creates file rows under the named facility', () => {
  beforeEach(() => jest.clearAllMocks());

  it('writes the facility and its source location on a zone', async () => {
    const { prisma, tx } = buildPrisma();
    const { bus } = mockEventBus();

    const result = await new CreateWarehouseZoneCommandHandler(prisma, bus)
      .execute(createTestCommand(CREATE_WAREHOUSE_ZONE, zonePayload));

    expect(result.success).toBe(true);
    expect(tx.warehouseZone.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ facilityId: 'fac-1', locationId: 'loc-1' }) })
    );
    expect(result.events!.map(e => e.type)).toEqual([EVENT_TYPES.WAREHOUSE_ZONE_CREATED]);
  });

  it('looks the facility up within the calling org, so another tenant s cannot be named', async () => {
    const { prisma, tx } = buildPrisma();
    const { bus } = mockEventBus();

    await new CreateWarehouseZoneCommandHandler(prisma, bus)
      .execute(createTestCommand(CREATE_WAREHOUSE_ZONE, zonePayload));

    expect(tx.facility.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'fac-1', orgId: 'test-org', archived: false } })
    );
  });

  it('fails the whole command when the facility belongs to another tenant', async () => {
    const { prisma, tx } = buildPrisma({ facility: null });
    const { bus } = mockEventBus();

    const result = await new CreateWarehouseZoneCommandHandler(prisma, bus)
      .execute(createTestCommand(CREATE_WAREHOUSE_ZONE, zonePayload));

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
    expect(tx.warehouseZone.create).not.toHaveBeenCalled();
  });

  it('writes a null locationId for a facility with no source location', async () => {
    const { prisma, tx } = buildPrisma({ facility: { id: 'fac-wms', sourceLocationId: null } });
    const { bus } = mockEventBus();

    const result = await new CreateWarehouseZoneCommandHandler(prisma, bus)
      .execute(createTestCommand(CREATE_WAREHOUSE_ZONE, { ...zonePayload, facilityId: 'fac-wms' }));

    expect(result.success).toBe(true);
    expect(tx.warehouseZone.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ facilityId: 'fac-wms', locationId: null }) })
    );
  });

  it('files a single bin under the facility', async () => {
    const { prisma, tx } = buildPrisma();
    const { bus } = mockEventBus();

    const result = await new CreateWarehouseBinCommandHandler(prisma, bus)
      .execute(createTestCommand(CREATE_WAREHOUSE_BIN, binPayload));

    expect(result.success).toBe(true);
    expect(tx.warehouseBin.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ facilityId: 'fac-1', locationId: 'loc-1' }) })
    );
  });

  it('resolves the facility once for a bulk batch and stamps every bin', async () => {
    const { prisma, tx } = buildPrisma();
    const { bus } = mockEventBus();

    const result = await new BulkCreateBinsCommandHandler(prisma, bus)
      .execute(createTestCommand(BULK_CREATE_BINS, bulkPayload));

    expect(result.success).toBe(true);
    expect(tx.facility.findFirst).toHaveBeenCalledTimes(1);
    const created = tx.warehouseBin.createMany.mock.calls[0][0].data;
    expect(created).toHaveLength(4);
    expect(created.every((b: any) => b.facilityId === 'fac-1' && b.locationId === 'loc-1')).toBe(true);
  });
});
