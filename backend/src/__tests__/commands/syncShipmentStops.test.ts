import { syncShipmentStops } from '../../commands/shipments/syncShipmentStops';

function mockTx() {
  const created: any[] = [];
  return {
    created,
    tx: {
      shipmentStop: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockImplementation(({ data }: any) => { created.push(...data); return Promise.resolve({ count: data.length }); }),
      },
    } as any,
  };
}

describe('syncShipmentStops', () => {
  it('builds origin -> waypoints -> destination in order', async () => {
    const { tx, created } = mockTx();
    await syncShipmentStops(tx, { shipmentId: 's1', originId: 'O', waypoints: ['W1', 'W2'], destinationId: 'D' });
    expect(tx.shipmentStop.deleteMany).toHaveBeenCalledWith({ where: { shipmentId: 's1' } });
    expect(created.map((r) => `${r.sequenceNumber}:${r.locationId}:${r.stopType}`)).toEqual([
      '1:O:pickup', '2:W1:delivery', '3:W2:delivery', '4:D:delivery',
    ]);
  });

  it('collapses to origin + destination when there are no waypoints', async () => {
    const { tx, created } = mockTx();
    await syncShipmentStops(tx, { shipmentId: 's1', originId: 'O', waypoints: [], destinationId: 'D' });
    expect(created.map((r) => r.locationId)).toEqual(['O', 'D']);
    expect(created.map((r) => r.sequenceNumber)).toEqual([1, 2]);
  });

  it('skips falsy waypoint entries and handles a partial route', async () => {
    const { tx, created } = mockTx();
    await syncShipmentStops(tx, { shipmentId: 's1', originId: 'O', waypoints: ['', 'W1'], destinationId: null });
    expect(created.map((r) => r.locationId)).toEqual(['O', 'W1']);
  });

  it('creates nothing when there is no route at all', async () => {
    const { tx, created } = mockTx();
    await syncShipmentStops(tx, { shipmentId: 's1', originId: null, waypoints: undefined, destinationId: null });
    expect(tx.shipmentStop.deleteMany).toHaveBeenCalled();
    expect(tx.shipmentStop.createMany).not.toHaveBeenCalled();
    expect(created).toHaveLength(0);
  });
});
