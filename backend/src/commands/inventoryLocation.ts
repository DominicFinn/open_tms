/**
 * Inventory still keys off `Location`, not `Facility` (#245).
 *
 * Module: inventory, which both tms and wms may depend on. It cannot live beside the facility
 * helpers, because those are wms and the returns flow that needs this is tms.
 */
/**
 * Inventory still keys off `Location`, not `Facility` (#245).
 *
 * `InventoryRecord.locationId` is NOT NULL and the inventory module has no facility reference, so
 * a warehouse row whose `locationId` is null cannot have stock written against it. That only
 * happens in a standalone FinnWMS, which has no Location at all, and giving inventory a facility
 * is Phase 4 work. Until then this fails loudly rather than inventing a location.
 */
export function requireLocationForInventory(locationId: string | null, context: string): string {
  if (!locationId) {
    throw new Error(
      `${context} has no locationId, and inventory is still keyed on Location. ` +
      'A warehouse-only install needs InventoryRecord to carry a facility first.'
    );
  }
  return locationId;
}
