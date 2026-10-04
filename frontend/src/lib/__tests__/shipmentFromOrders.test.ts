import { applyOrders, canJoin, orderConflicts, RouteForm, OrderForShipment } from '../shipmentFromOrders';

const emptyForm: RouteForm = {
  customerId: '', mode: '', useCustomRoute: true, originId: '', destinationId: '', waypoints: [],
  pickupDate: '', deliveryDate: '', tempControlled: false, hazmat: false,
};

const order = (overrides: Partial<OrderForShipment> = {}): OrderForShipment => ({
  id: 'o1', orderNumber: 'ORD-1', customerId: 'cust-1', originId: 'origin', destinationId: 'drop-a',
  serviceLevel: 'LTL', temperatureControl: 'ambient', requiresHazmat: false,
  requestedPickupDate: '2026-10-05T00:00:00.000Z', requestedDeliveryDate: '2026-10-08T00:00:00.000Z',
  ...overrides,
});

describe('applyOrders', () => {
  it('fills an empty custom-route form from the orders, ending at the last drop', () => {
    const form = applyOrders(emptyForm, [
      order(),
      order({ id: 'o2', orderNumber: 'ORD-2', destinationId: 'drop-b', requestedPickupDate: '2026-10-04', requestedDeliveryDate: '2026-10-09', temperatureControl: 'frozen' }),
    ]);
    expect(form).toMatchObject({
      customerId: 'cust-1', mode: 'LTL', originId: 'origin', destinationId: 'drop-b', waypoints: ['drop-a'],
      pickupDate: '2026-10-04', deliveryDate: '2026-10-09', tempControlled: true, hazmat: false,
    });
  });

  it('never overwrites what the user set, and adds a later order’s drop before the destination', () => {
    const edited = { ...emptyForm, customerId: 'cust-1', mode: 'LTL', originId: 'origin', destinationId: 'final', pickupDate: '2026-10-06' };
    const form = applyOrders(edited, [order({ destinationId: 'drop-a', requestedPickupDate: '2026-10-07' })]);
    expect(form).toMatchObject({ destinationId: 'final', waypoints: ['drop-a'], pickupDate: '2026-10-06' });
  });

  it('on a lane, adds only the drops the lane does not already cover', () => {
    const onLane = { ...emptyForm, useCustomRoute: false, laneOriginId: 'origin', laneDestinationId: 'drop-b', waypoints: ['hub'] };
    const form = applyOrders(onLane, [order({ destinationId: 'drop-b' }), order({ id: 'o2', destinationId: 'drop-c' })]);
    expect(form.waypoints).toEqual(['hub', 'drop-c']);
    expect(form.originId).toBe('');
  });
});

describe('orderConflicts', () => {
  const filled = applyOrders(emptyForm, [order()]);

  it('is empty for a form the orders filled in', () => {
    expect(orderConflicts(filled, [order()])).toEqual([]);
  });

  it('flags edits that no longer fit the orders', () => {
    expect(orderConflicts({ ...filled, customerId: 'cust-2' }, [order()])).toEqual(["The shipment's customer isn't the orders' customer."]);
    expect(orderConflicts({ ...filled, mode: 'FTL' }, [order()])).toEqual(["The orders are LTL, but the shipment's mode is FTL."]);
    expect(orderConflicts({ ...filled, originId: 'elsewhere' }, [order()])).toEqual(["The route doesn't start at the orders' origin."]);
    expect(orderConflicts({ ...filled, destinationId: 'elsewhere' }, [order()])).toEqual(["ORD-1's drop isn't a stop on this route."]);
  });

  it('flags orders that cannot share a shipment', () => {
    const problems = orderConflicts(emptyForm, [order({ serviceLevel: 'FTL' }), order({ id: 'o2', serviceLevel: 'FTL', customerId: 'cust-2' })]);
    expect(problems).toEqual(expect.arrayContaining([
      'The orders belong to different customers, and a shipment has one customer.',
      'An FTL shipment carries one order.',
    ]));
  });
});

describe('canJoin', () => {
  it('only offers LTL orders for the same customer and origin, not already attached', () => {
    const attached = [order()];
    expect(canJoin(order({ id: 'o2' }), attached)).toBe(true);
    expect(canJoin(order({ id: 'o1' }), attached)).toBe(false);
    expect(canJoin(order({ id: 'o2', customerId: 'cust-2' }), attached)).toBe(false);
    expect(canJoin(order({ id: 'o2', originId: 'other' }), attached)).toBe(false);
    expect(canJoin(order({ id: 'o2', serviceLevel: 'FTL' }), [order({ serviceLevel: 'FTL' })])).toBe(false);
    expect(canJoin(order({ serviceLevel: 'FTL' }), [])).toBe(true);
  });
});
