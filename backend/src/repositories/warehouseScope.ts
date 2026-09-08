/**
 * Which warehouse a WMS list read is about (#231).
 *
 * Phase 2a is moving WMS off the conflated core `Location` and onto its own `Facility`. Every WMS
 * model now carries both ids, so a caller may narrow by either. New callers should send
 * `facilityId`; `locationId` stays until the frontend has migrated (#232) and a soak has passed,
 * then it goes with the `Location` FKs in batch 6.
 *
 * Both members are real columns on every WMS model this is used with, so the scope spreads
 * straight into a Prisma `where`. It never widens the query: `orgId` is always applied alongside.
 */
export type WarehouseScope = { facilityId: string } | { locationId: string };

/**
 * Builds the `where` fragment for a scoped list read. Always call it with the caller's `orgId`
 * rather than assembling the filter by hand, so no read can be written that narrows by warehouse
 * without also narrowing by tenant.
 */
export function scopedWhere(orgId: string, scope: WarehouseScope): { orgId: string } & WarehouseScope {
  return { orgId, ...scope };
}

/**
 * The querystring fragment every scoped WMS list endpoint shares. `oneOf` makes exactly one of the
 * two ids required, so Fastify rejects both a request that names neither and a request that names
 * both, before the handler runs.
 */
export const WAREHOUSE_SCOPE_QUERY = {
  facilityId: { type: 'string', format: 'uuid' },
  locationId: { type: 'string', format: 'uuid' },
} as const;

export const WAREHOUSE_SCOPE_ONE_OF = [
  { required: ['facilityId'] },
  { required: ['locationId'] },
] as const;

/**
 * Reads the scope out of a validated querystring. The schema guarantees exactly one is present,
 * so the facility branch is simply preferred.
 */
export function warehouseScopeFrom(query: { facilityId?: string; locationId?: string }): WarehouseScope {
  return query.facilityId
    ? { facilityId: query.facilityId }
    : { locationId: query.locationId! };
}
