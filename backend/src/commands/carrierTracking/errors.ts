/**
 * The carrier or integration a command names is not in the command's org. Routes check first and
 * answer 404; this is the same check repeated inside the transaction.
 */
export class CarrierTrackingNotFoundError extends Error {
  constructor(entity: 'carrier' | 'integration', id: string) {
    super(`Carrier tracking ${entity} ${id} not found`);
    this.name = 'CarrierTrackingNotFoundError';
  }
}
