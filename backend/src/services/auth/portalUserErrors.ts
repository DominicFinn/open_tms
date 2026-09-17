/** The carrier or customer a portal user is being created under is not in the caller's org. */
export class PortalAccountNotFoundError extends Error {
  constructor(accountType: 'carrier' | 'customer') {
    super(accountType === 'carrier' ? 'Carrier not found' : 'Customer not found');
    this.name = 'PortalAccountNotFoundError';
  }
}

/** The portal user does not exist in the caller's org. */
export class PortalUserNotFoundError extends Error {
  constructor() {
    super('User not found');
    this.name = 'PortalUserNotFoundError';
  }
}
