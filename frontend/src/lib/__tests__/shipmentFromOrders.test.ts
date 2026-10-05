import { applyOrders, canJoin, dropStops, orderConflicts, shipTogetherMode, shipTogetherProblem, waypointsForApi, RouteForm, OrderForShipment } from '../shipmentFromOrders';

const emptyForm: RouteForm = {
  customerId: '', mode: '', useCustomRoute: true, originId: '', destinationId: '', pickupWaypoints: [], waypoints: [],
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

describe('applyOrders with several origins (#329)', () => {
  it('makes each further origin a pickup after the first, and accepts the result', () => {
    const orders = [order(), order({ id: 'o2', orderNumber: 'ORD-2', originId: 'origin-b', destinationId: 'drop-b' })];
    const form = applyOrders(emptyForm, orders);
    expect(form).toMatchObject({ originId: 'origin', pickupWaypoints: ['origin-b'], waypoints: ['drop-a'], destinationId: 'drop-b' });
    expect(orderConflicts(form, orders)).toEqual([]);
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
    expect(orderConflicts({ ...filled, originId: 'elsewhere' }, [order()])).toEqual(["ORD-1's pickup isn't a stop on this route."]);
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
  it('only offers LTL orders for the same customer, not already attached, from any origin (#329)', () => {
    const attached = [order()];
    expect(canJoin(order({ id: 'o2' }), attached)).toBe(true);
    expect(canJoin(order({ id: 'o1' }), attached)).toBe(false);
    expect(canJoin(order({ id: 'o2', customerId: 'cust-2' }), attached)).toBe(false);
    expect(canJoin(order({ id: 'o2', originId: 'other' }), attached)).toBe(true);
    expect(canJoin(order({ id: 'o2', serviceLevel: 'FTL' }), [order({ serviceLevel: 'FTL' })])).toBe(false);
    expect(canJoin(order({ serviceLevel: 'FTL' }), [])).toBe(true);
  });
});

describe('shipTogetherProblem', () => {
  const available = (overrides: Partial<OrderForShipment> = {}) => ({ ...order(overrides), status: 'verified' });

  it('allows two or more available LTL orders for one customer from one origin', () => {
    expect(shipTogetherProblem([available(), available({ id: 'o2', destinationId: 'drop-b' })])).toBeNull();
  });

  it('explains why a selection cannot be shipped together', () => {
    expect(shipTogetherProblem([available()])).toBe('Select two or more orders to ship together.');
    expect(shipTogetherProblem([available(), { ...available({ id: 'o2' }), status: 'assigned' }])).toBe('Only available orders can be shipped.');
    expect(shipTogetherProblem([available(), available({ id: 'o2', serviceLevel: 'FTL' })])).toBe('FTL orders ship on their own shipment.');
    expect(shipTogetherProblem([available(), available({ id: 'o2', customerId: 'cust-2' })])).toBeNull();
    expect(shipTogetherProblem([available(), available({ id: 'o2', originId: 'other' })])).toBeNull();
  });
});


describe('shipTogetherMode (#329)', () => {
  it('makes one shipment for one customer and a consolidation across customers', () => {
    expect(shipTogetherMode([order(), order({ id: 'o2' })])).toEqual({ kind: 'shipment' });
    expect(shipTogetherMode([order(), order({ id: 'o2', customerId: 'cust-2' }), order({ id: 'o3', customerId: 'cust-3' })]))
      .toEqual({ kind: 'consolidation', customers: 3 });
  });
});

describe('other stops (#345)', () => {
  it('never counts a fuel or rest stop as somewhere an order can drop', () => {
    const form = { ...emptyForm, originId: 'origin', destinationId: 'drop-b', waypoints: ['fuel-1', 'drop-a'], otherStops: { 'fuel-1': { purpose: 'fuel', label: '' } } };
    expect(dropStops(form)).toEqual(['drop-a', 'drop-b']);
    expect(orderConflicts(form, [order({ destinationId: 'fuel-1' })])).toEqual(["ORD-1's drop isn't a stop on this route."]);
  });

  it('sends other stops to the API with their purpose and name', () => {
    expect(waypointsForApi(['a', '', 'f'], { f: { purpose: 'customs', label: ' Laredo ' } }))
      .toEqual(['a', { locationId: 'f', stopType: 'other', purpose: 'customs', label: 'Laredo' }]);
  });
});
