/**
 * The facility the inventory app is working in (#297).
 *
 * Inventory is read by facility, so the app picks a facility rather than a core Location. Earlier
 * builds stored a Location under `inventory_app_location`; that key is cleared here so a stale one
 * sends the user back to the picker instead of querying with the wrong kind of id.
 *
 * localStorage can throw (private windows, blocked storage), so every access is guarded and a
 * failure reads as "no facility picked".
 */

const KEY = 'inventory_app_facility';
const LEGACY_KEY = 'inventory_app_location';

export interface InventoryAppFacility {
  id: string;
  name: string;
}

export function getInventoryAppFacility(): InventoryAppFacility | null {
  try {
    localStorage.removeItem(LEGACY_KEY);
    const parsed = JSON.parse(localStorage.getItem(KEY) || 'null');
    return parsed && typeof parsed.id === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

export function saveInventoryAppFacility(facility: InventoryAppFacility): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ id: facility.id, name: facility.name }));
  } catch {
    // Storage unavailable: the picker will simply be shown again next time.
  }
}

export function clearInventoryAppFacility(): void {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // Nothing stored that we could clear.
  }
}
