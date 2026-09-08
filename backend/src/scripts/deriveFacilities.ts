/**
 * Derives a Facility for every warehouse Location that does not have one (#236).
 *
 * Split out of the backfill script itself, the same way step selection is, so it can be tested
 * without importing a module whose side effect is to run a backfill.
 */

import { PrismaClient } from '@prisma/client';

/**
 * Warehouse roots. Phase 2a's migrations derive a Facility per Location that a WMS row already
 * points at, which leaves an install with warehouse Locations but no zones, receiving or waves yet
 * with none at all: every WMS page then shows "No facilities" (#236).
 *
 * Warehouse-ish means the location types the WMS surfaces have always filtered on, plus locations
 * with no type set, which is how the seed leaves them.
 *
 * Not a read model: Facility is authoritative. It is here because this is the script an upgrade
 * already runs, and the (orgId, sourceLocationId) unique constraint makes it idempotent.
 */
export const WAREHOUSE_LOCATION_TYPES = ['warehouse', 'distribution_centre', 'cross_dock'];

export async function deriveFacilitiesFromLocations(prisma: PrismaClient): Promise<number> {
  const locations = await prisma.location.findMany({
    where: {
      archived: false,
      OR: [{ locationType: { in: WAREHOUSE_LOCATION_TYPES } }, { locationType: null }],
    },
    select: {
      id: true, orgId: true, name: true,
      address1: true, address2: true, city: true, state: true, postalCode: true, country: true,
    },
  });

  let count = 0;
  for (const location of locations) {
    // Each facility takes its orgId from its own location, never one resolved for the whole run.
    const existing = await prisma.facility.findUnique({
      where: { orgId_sourceLocationId: { orgId: location.orgId, sourceLocationId: location.id } },
      select: { id: true },
    });
    if (existing) continue;

    await prisma.facility.create({
      data: {
        orgId: location.orgId,
        name: location.name,
        sourceLocationId: location.id,
        address1: location.address1,
        address2: location.address2,
        city: location.city,
        state: location.state,
        postalCode: location.postalCode,
        country: location.country,
      },
    });
    count++;
  }
  return count;
}
