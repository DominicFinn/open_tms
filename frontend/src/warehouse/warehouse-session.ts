import { createPortalSessionStore } from '../portal-session';

/**
 * Warehouse PWA session storage.
 *
 * Same `warehouse_token` / `warehouse_user` localStorage keys the warehouse
 * pages have always read directly — this just centralises writing them
 * together (see #137: login previously stored the user but dropped the
 * session token, so every operational request went out unauthenticated).
 */
export interface WarehouseSessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  permissions: string[];
  organizationId: string | null;
  preferredLocationId: string | null;
}

const store = createPortalSessionStore<WarehouseSessionUser>(
  'warehouse',
  (u): u is WarehouseSessionUser => !!u && typeof u === 'object' && typeof u.id === 'string',
);

export const saveWarehouseSession = store.save;
export const getWarehouseToken = store.getToken;
export const getWarehouseUser = store.getUser;
export const clearWarehouseSession = store.clear;
