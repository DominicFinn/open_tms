import { createPortalSessionStore } from '../portal-session';

/**
 * Inventory-app session storage (#233).
 *
 * A lighter, separately-scoped sibling of the warehouse PWA session: the backend mints a
 * narrower `scope: 'inventory'` JWT for this surface (read levels + record observations only —
 * see backend/src/middleware/jwtAuth.ts), so it gets its own storage keys rather than reusing
 * `warehouse_token`/`warehouse_user`.
 */
export interface InventoryAppSessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  permissions: string[];
  organizationId: string | null;
  preferredLocationId: string | null;
}

const store = createPortalSessionStore<InventoryAppSessionUser>(
  'inventory_app',
  (u): u is InventoryAppSessionUser => !!u && typeof u === 'object' && typeof u.id === 'string',
);

export const saveInventoryAppSession = store.save;
export const getInventoryAppToken = store.getToken;
export const getInventoryAppUser = store.getUser;
export const clearInventoryAppSession = store.clear;
