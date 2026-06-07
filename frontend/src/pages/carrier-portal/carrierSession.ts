import { createPortalSessionStore } from '../../portal-session';

export interface CarrierSessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
  carrierId: string;
  carrierName: string;
}

const store = createPortalSessionStore<CarrierSessionUser>(
  'carrier',
  (u): u is CarrierSessionUser => !!u && typeof u === 'object' && typeof u.carrierId === 'string',
);

export const saveCarrierSession = store.save;
export const getCarrierToken = store.getToken;
export const getCarrierUser = store.getUser;
export const clearCarrierSession = store.clear;
