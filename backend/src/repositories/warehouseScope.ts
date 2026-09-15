/**
 * Which warehouse a WMS list read is about (#231).
 *
 * Phase 2a moved WMS off the conflated core `Location` and onto its own `Facility`. The
 * `locationId` alternative went with the `Location` foreign keys in #280, once nothing sent it.
 *
 * `facilityId` is a real column on every WMS model this is used with, so the scope spreads straight
 * into a Prisma `where`. It never widens the query: `orgId` is always applied alongside.
 */
export type WarehouseScope = { facilityId: string };

/**
 * Builds the `where` fragment for a scoped list read. Always call it with the caller's `orgId`
 * rather than assembling the filter by hand, so no read can be written that narrows by warehouse
 * without also narrowing by tenant.
 */
export function scopedWhere(orgId: string, scope: WarehouseScope): { orgId: string } & WarehouseScope {
  return { orgId, ...scope };
}

/**
 * The querystring fragment every scoped WMS list endpoint shares. Kept as a `oneOf` with a single
 * branch rather than a bare `required`, so the zone and bin endpoints can add their own alternative
 * (a zoneId) without diverging from this shape.
 */
export const WAREHOUSE_SCOPE_QUERY = {
  facilityId: { type: 'string', format: 'uuid' },
} as const;

export const WAREHOUSE_SCOPE_ONE_OF = [
  { required: ['facilityId'] },
] as const;

/**
 * Reads the scope out of a validated querystring. The schema guarantees the facility is present.
 */
export function warehouseScopeFrom(query: { facilityId?: string }): WarehouseScope {
  return { facilityId: query.facilityId! };
}
