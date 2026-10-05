import { syncShipmentStops, StopStillHasOrdersError } from '../../commands/shipments/syncShipmentStops';

interface StoredStop { id: string; locationId: string; orders?: number; stopType?: string }

/** An in-memory stop table: tracks creates, updates and deletes so the final route can be read back. */
function mockTx(stored: StoredStop[] = []) {
  let rows: any[] = stored.map((s, i) => ({ id: s.id, locationId: s.locationId, sequenceNumber: i + 1, stopType: s.stopType ?? 'delivery', orders: s.orders ?? 0 }));
  let nextId = 1;
  const tx = {
    shipmentStop: {
      findMany: jest.fn(async () => rows.map((r) => ({ id: r.id, locationId: r.locationId, stopType: r.stopType, _count: { orders: r.orders, pickupOrders: 0 } }))),
      deleteMany: jest.fn(async ({ where }: any) => { rows = rows.filter((r) => !where.id.in.includes(r.id)); return { count: 0 }; }),
      updateMany: jest.fn(async () => { rows.forEach((r) => { r.sequenceNumber += 100000; }); return { count: rows.length }; }),
      update: jest.fn(async ({ where, data }: any) => { Object.assign(rows.find((r) => r.id === where.id)!, data); return {}; }),
      create: jest.fn(async ({ data }: any) => { rows.push({ id: `new-${nextId++}`, orders: 0, ...data }); return {}; }),
    },
  } as any;
  const route = () => [...rows].sort((a, b) => a.sequenceNumber - b.sequenceNumber).map((r) => `${r.sequenceNumber}:${r.locationId}:${r.stopType}`);
  const idAt = (locationId: string) => rows.find((r) => r.locationId === locationId)?.id;
  return { tx, route, idAt };
}

describe('syncShipmentStops', () => {
  it('builds origin -> waypoints -> destination in order', async () => {
    const { tx, route } = mockTx();
    await syncShipmentStops(tx, { orgId: 'org-1', shipmentId: 's1', originId: 'O', waypoints: ['W1', 'W2'], destinationId: 'D' });
    expect(route()).toEqual(['1:O:pickup', '2:W1:delivery', '3:W2:delivery', '4:D:delivery']);
  });

  it('collapses to origin + destination when there are no waypoints, and skips falsy entries', async () => {
    const a = mockTx();
    await syncShipmentStops(a.tx, { orgId: 'org-1', shipmentId: 's1', originId: 'O', waypoints: ['', 'W1'], destinationId: null });
    expect(a.route()).toEqual(['1:O:pickup', '2:W1:delivery']);
  });

  it('keeps the stop rows still on the route, so the orders dropping there keep their stop (#328)', async () => {
    const { tx, route, idAt } = mockTx([{ id: 'stop-o', locationId: 'O' }, { id: 'stop-d', locationId: 'D', orders: 2 }]);

    await syncShipmentStops(tx, { orgId: 'org-1', shipmentId: 's1', originId: 'O', waypoints: ['W1'], destinationId: 'D' });

    expect(route()).toEqual(['1:O:pickup', '2:W1:delivery', '3:D:delivery']);
    expect(idAt('D')).toBe('stop-d');
    expect(idAt('O')).toBe('stop-o');
    expect(tx.shipmentStop.deleteMany).not.toHaveBeenCalled();
  });

  it('deletes stops that leave the route when nothing drops there', async () => {
    const { tx, route } = mockTx([{ id: 'stop-o', locationId: 'O' }, { id: 'stop-old', locationId: 'OLD' }, { id: 'stop-d', locationId: 'D' }]);
    await syncShipmentStops(tx, { orgId: 'org-1', shipmentId: 's1', originId: 'O', waypoints: [], destinationId: 'D' });
    expect(route()).toEqual(['1:O:pickup', '2:D:delivery']);
    expect(tx.shipmentStop.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['stop-old'] }, shipment: { orgId: 'org-1' } } });
  });

  it('refuses to remove a stop that orders still drop at', async () => {
    const { tx } = mockTx([{ id: 'stop-o', locationId: 'O' }, { id: 'stop-w', locationId: 'W1', orders: 1 }, { id: 'stop-d', locationId: 'D' }]);
    await expect(syncShipmentStops(tx, { orgId: 'org-1', shipmentId: 's1', originId: 'O', waypoints: [], destinationId: 'D' }))
      .rejects.toBeInstanceOf(StopStillHasOrdersError);
    expect(tx.shipmentStop.deleteMany).not.toHaveBeenCalled();
  });

  describe('other stops (#345)', () => {
    const fuel = (locationId: string, label?: string) => ({ locationId, stopType: 'other' as const, purpose: 'fuel', label });

    it('places other stops where they are listed, with their purpose and name', async () => {
      const { tx, route } = mockTx();
      await syncShipmentStops(tx, { orgId: 'org-1', shipmentId: 's1', originId: 'O', pickupWaypoints: [fuel('F1', '  Truck stop  ')], waypoints: ['W1', fuel('F2')], destinationId: 'D' });
      expect(route()).toEqual(['1:O:pickup', '2:F1:other', '3:W1:delivery', '4:F2:other', '5:D:delivery']);
      expect(tx.shipmentStop.create).toHaveBeenCalledWith({ data: expect.objectContaining({ locationId: 'F1', stopType: 'other', purpose: 'fuel', label: 'Truck stop' }) });
      expect(tx.shipmentStop.create).toHaveBeenCalledWith({ data: expect.objectContaining({ locationId: 'W1', stopType: 'delivery', purpose: null, label: null }) });
    });

    it('never turns a drop that orders still use into an other stop', async () => {
      const { tx } = mockTx([{ id: 'stop-o', locationId: 'O' }, { id: 'stop-w', locationId: 'W1', orders: 2 }, { id: 'stop-d', locationId: 'D' }]);
      await expect(syncShipmentStops(tx, { orgId: 'org-1', shipmentId: 's1', originId: 'O', waypoints: [fuel('W1')], destinationId: 'D' }))
        .rejects.toBeInstanceOf(StopStillHasOrdersError);
    });

    it('keeps an existing other stop and updates its details', async () => {
      const { tx, idAt } = mockTx([{ id: 'stop-o', locationId: 'O' }, { id: 'stop-f', locationId: 'F1', stopType: 'other' }, { id: 'stop-d', locationId: 'D' }]);
      await syncShipmentStops(tx, { orgId: 'org-1', shipmentId: 's1', originId: 'O', waypoints: [{ locationId: 'F1', stopType: 'other', purpose: 'customs', label: null }], destinationId: 'D' });
      expect(idAt('F1')).toBe('stop-f');
      expect(tx.shipmentStop.update).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'stop-f' }), data: expect.objectContaining({ stopType: 'other', purpose: 'customs' }) }));
    });
  });
});
