import { scopeShipmentToCustomer } from '../../services/portal/customerShipmentView';

const stop = (stopType: string, locationId: string, customers: string[]) => ({
  stopType, locationId, location: { name: locationId }, orders: customers.map((customerId) => ({ customerId })),
});

const shared = {
  id: 'ship-1',
  destinationId: 'denver',
  destination: { name: 'denver' },
  items: [{ orderId: 'a', description: 'frozen peas' }, { orderId: 'b', description: 'insulin' }],
  stops: [stop('pickup', 'green-bay', []), stop('delivery', 'rochester', ['nordic']), stop('delivery', 'denver', ['axiom'])],
  orderShipments: [{ order: { id: 'a', customerId: 'nordic' } }, { order: { id: 'b', customerId: 'axiom' } }],
};

describe('scopeShipmentToCustomer (#325)', () => {
  it("hides other customers' drops and items, and shows the customer's own last drop as the destination", () => {
    const view = scopeShipmentToCustomer(shared, 'nordic');

    expect(view.stops.map((s) => s.locationId)).toEqual(['green-bay', 'rochester']);
    expect(view.items).toEqual([{ orderId: 'a', description: 'frozen peas' }]);
    expect(view).toMatchObject({ destinationId: 'rochester', destination: { name: 'rochester' } });
    expect(JSON.stringify(view)).not.toContain('axiom');
    expect(view).not.toHaveProperty('orderShipments');
  });

  it('leaves a single-customer shipment as it is, apart from dropping the internal order links', () => {
    const own = { ...shared, stops: [stop('pickup', 'green-bay', []), stop('delivery', 'denver', ['nordic'])], orderShipments: [{ order: { id: 'a', customerId: 'nordic' } }], items: [{ orderId: 'a' }] };
    const view = scopeShipmentToCustomer(own, 'nordic');

    expect(view.stops.map((s) => s.locationId)).toEqual(['green-bay', 'denver']);
    expect(view).toMatchObject({ destinationId: 'denver', items: [{ orderId: 'a' }] });
  });

  it('keeps stops that have no orders on them', () => {
    const view = scopeShipmentToCustomer({ ...shared, stops: [...shared.stops, stop('delivery', 'depot', [])] }, 'nordic');
    expect(view.stops.map((s) => s.locationId)).toContain('depot');
  });
});

describe('scopeShipmentToCustomer on a consolidation (#329)', () => {
  it('never exposes the run the shipment rides on', () => {
    const onRun = {
      ...shared,
      stops: shared.stops.map((s, i) => ({ ...s, consolidationStopId: `run-stop-${i}` })),
    };
    const view = scopeShipmentToCustomer(onRun, 'nordic');
    expect(view.stops.every((s) => !('consolidationStopId' in s))).toBe(true);
    expect(JSON.stringify(view)).not.toContain('run-stop');
  });
});

describe('scopeShipmentToCustomer with other stops (#345)', () => {
  it('leaves fuel, rest and customs stops out of the customer view', () => {
    const view = scopeShipmentToCustomer({ ...shared, stops: [shared.stops[0], { ...stop('other', 'truck-stop', []), purpose: 'fuel' }, shared.stops[1]] }, 'nordic');
    expect(view.stops.map((s) => s.locationId)).toEqual(['green-bay', 'rochester']);
  });
});
