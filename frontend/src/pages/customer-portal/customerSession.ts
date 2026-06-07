import { createPortalSessionStore } from '../../portal-session';

export interface CustomerSessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
  customerId: string;
  customerName: string;
}

const store = createPortalSessionStore<CustomerSessionUser>(
  'customer',
  (u): u is CustomerSessionUser => !!u && typeof u === 'object' && typeof u.customerId === 'string',
);

export const saveCustomerSession = store.save;
export const getCustomerToken = store.getToken;
export const getCustomerUser = store.getUser;
export const clearCustomerSession = store.clear;
