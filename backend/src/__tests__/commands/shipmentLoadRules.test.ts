import { assertCanAdd, loadProfileFor, ShipmentLoadRuleError } from '../../commands/orders/shipmentLoadRules';

const order = (overrides: object = {}) => ({ orderNumber: 'ORD-1', serviceLevel: 'LTL', temperatureControl: 'ambient', requiresHazmat: false, ...overrides });

describe('shipmentLoadRules (#325)', () => {
  it('takes the service level and the strictest handling from the orders', () => {
    expect(loadProfileFor([order(), order({ temperatureControl: 'frozen' }), order({ requiresHazmat: true })]))
      .toEqual({ serviceLevel: 'LTL', tempControlled: true, hazmat: true });
  });

  it('refuses mixed FTL/LTL and more than one FTL order', () => {
    expect(() => loadProfileFor([order(), order({ serviceLevel: 'FTL' })])).toThrow(ShipmentLoadRuleError);
    expect(() => loadProfileFor([order({ serviceLevel: 'FTL' }), order({ serviceLevel: 'FTL' })])).toThrow(/FTL shipment carries one order/);
    expect(loadProfileFor([order({ serviceLevel: 'FTL' })]).serviceLevel).toBe('FTL');
  });

  it('refuses an order needing handling the shipment is not flagged for', () => {
    const shipment = { serviceLevel: 'LTL', tempControlled: false, hazmat: false };
    expect(() => assertCanAdd(shipment, 1, [order({ requiresHazmat: true })])).toThrow(/hazmat/);
    expect(() => assertCanAdd(shipment, 1, [order({ temperatureControl: 'refrigerated' })])).toThrow(/temperature control/);
    expect(assertCanAdd(shipment, 3, [order()])).toBe('LTL');
  });
});
