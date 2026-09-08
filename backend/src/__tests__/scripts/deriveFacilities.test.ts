/**
 * Phase 2a leaves an install with warehouse Locations but no WMS rows with zero facilities, so
 * every WMS page shows "No facilities" after upgrading (#236). This step closes that.
 */

import { deriveFacilitiesFromLocations, WAREHOUSE_LOCATION_TYPES } from '../../scripts/deriveFacilities';

const LEEDS = {
  id: 'loc-1', orgId: 'org-a', name: 'Leeds DC',
  address1: '1 Depot Way', address2: null, city: 'Leeds',
  state: null, postalCode: 'LS1 1AA', country: 'GB',
};
const BRISTOL = { ...LEEDS, id: 'loc-2', orgId: 'org-b', name: 'Bristol DC', city: 'Bristol' };

function buildPrisma(locations: any[], existing: Record<string, boolean> = {}) {
  return {
    location: { findMany: jest.fn().mockResolvedValue(locations) },
    facility: {
      findUnique: jest.fn(({ where }: any) =>
        Promise.resolve(existing[where.orgId_sourceLocationId.sourceLocationId] ? { id: 'fac-existing' } : null)
      ),
      create: jest.fn().mockResolvedValue({ id: 'fac-new' }),
    },
  } as any;
}

describe('deriveFacilitiesFromLocations', () => {
  beforeEach(() => jest.clearAllMocks());

  it('derives one facility per warehouse location, carrying its address across', async () => {
    const prisma = buildPrisma([LEEDS]);

    expect(await deriveFacilitiesFromLocations(prisma)).toBe(1);
    expect(prisma.facility.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orgId: 'org-a', name: 'Leeds DC', sourceLocationId: 'loc-1',
        address1: '1 Depot Way', city: 'Leeds', postalCode: 'LS1 1AA', country: 'GB',
      }),
    });
  });

  it('takes each orgId from its own location rather than one resolved for the run', async () => {
    const prisma = buildPrisma([LEEDS, BRISTOL]);

    expect(await deriveFacilitiesFromLocations(prisma)).toBe(2);
    const orgs = prisma.facility.create.mock.calls.map((c: any) => c[0].data.orgId);
    expect(orgs).toEqual(['org-a', 'org-b']);
  });

  it('is idempotent: a second run creates nothing', async () => {
    const prisma = buildPrisma([LEEDS], { 'loc-1': true });

    expect(await deriveFacilitiesFromLocations(prisma)).toBe(0);
    expect(prisma.facility.create).not.toHaveBeenCalled();
  });

  it('looks the existing facility up within the location s own org', async () => {
    const prisma = buildPrisma([LEEDS]);
    await deriveFacilitiesFromLocations(prisma);

    expect(prisma.facility.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orgId_sourceLocationId: { orgId: 'org-a', sourceLocationId: 'loc-1' } },
      })
    );
  });

  it('selects warehouse types and untyped locations, and skips archived ones', async () => {
    const prisma = buildPrisma([]);
    await deriveFacilitiesFromLocations(prisma);

    expect(prisma.location.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          archived: false,
          OR: [{ locationType: { in: WAREHOUSE_LOCATION_TYPES } }, { locationType: null }],
        }),
      })
    );
    expect(WAREHOUSE_LOCATION_TYPES).toEqual(['warehouse', 'distribution_centre', 'cross_dock']);
  });
});
