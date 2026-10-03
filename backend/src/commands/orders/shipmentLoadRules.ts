/**
 * What can share a shipment (#325).
 *
 * BUSINESS RULES:
 * - FTL is a dedicated truck: an FTL shipment carries exactly one order.
 * - FTL and LTL orders never share a shipment.
 * - LTL consolidates freight, so its orders may belong to different customers.
 * - A shipment is temperature-controlled / hazmat if any order on it needs that.
 *
 * Enforced inside the add/combine/convert/split commands, so a race between two requests can't
 * get round them; OrderConversionService runs the same checks first only to report per order.
 */

export interface LoadOrder {
  orderNumber: string;
  serviceLevel: string;
  temperatureControl: string;
  requiresHazmat: boolean;
}

export interface ShipmentLoadProfile {
  serviceLevel: string;
  tempControlled: boolean;
  hazmat: boolean;
}

export class ShipmentLoadRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShipmentLoadRuleError';
  }
}

/** The profile a new shipment takes from the orders it's created for. */
export function loadProfileFor(orders: LoadOrder[]): ShipmentLoadProfile {
  const serviceLevel = singleServiceLevel(orders);
  if (serviceLevel === 'FTL' && orders.length > 1) {
    throw new ShipmentLoadRuleError(`An FTL shipment carries one order; got ${orders.length} FTL orders`);
  }
  return {
    serviceLevel,
    tempControlled: orders.some((o) => o.temperatureControl !== 'ambient'),
    hazmat: orders.some((o) => o.requiresHazmat),
  };
}

/**
 * Checks that `orders` can join a shipment already carrying `existingOrderCount` orders, and returns
 * the service level the shipment should have afterwards (its own, or the orders' when it has none).
 */
export function assertCanAdd(
  shipment: { serviceLevel: string | null; tempControlled: boolean; hazmat: boolean },
  existingOrderCount: number,
  orders: LoadOrder[],
): string {
  const ordersLevel = singleServiceLevel(orders);
  const serviceLevel = shipment.serviceLevel ?? ordersLevel;
  if (ordersLevel !== serviceLevel) {
    throw new ShipmentLoadRuleError(`${ordersLevel} orders can't join a ${serviceLevel} shipment`);
  }
  if (serviceLevel === 'FTL' && existingOrderCount + orders.length > 1) {
    throw new ShipmentLoadRuleError('An FTL shipment carries one order and this one would have more');
  }
  const needsHazmat = orders.find((o) => o.requiresHazmat && !shipment.hazmat);
  if (needsHazmat) throw new ShipmentLoadRuleError(`${needsHazmat.orderNumber} requires hazmat handling, which this shipment isn't flagged for`);
  const needsTemp = orders.find((o) => o.temperatureControl !== 'ambient' && !shipment.tempControlled);
  if (needsTemp) throw new ShipmentLoadRuleError(`${needsTemp.orderNumber} requires temperature control, which this shipment isn't flagged for`);
  return serviceLevel;
}

function singleServiceLevel(orders: LoadOrder[]): string {
  const levels = new Set(orders.map((o) => o.serviceLevel));
  if (levels.size !== 1) {
    throw new ShipmentLoadRuleError(levels.size === 0 ? 'No orders given' : 'FTL and LTL orders can\'t share a shipment');
  }
  return [...levels][0];
}
