import { linkOrdersToShipment } from '../../commands/shipments/linkOrdersToShipment';

/** An in-memory stop table for one shipment. */
function mockTx(stops: Array<{ id: string; locationId: string; stopType: string }>) {
  let rows = stops.map((s, i) => ({ ...s, sequenceNumber: i + 1 }));
  let nextId = 1;
  const matches = (r: any, where: any) =>
    (!where.locationId || r.locationId === where.locationId)
    && (!where.stopType || where.stopType.in.includes(r.stopType))
    && (!where.sequenceNumber || r.sequenceNumber >= where.sequenceNumber.gte);
  const sorted = (orderBy: any) => [...rows].sort((a, b) => (orderBy?.sequenceNumber === 'desc' ? b.sequenceNumber - a.sequenceNumber : a.sequenceNumber - b.sequenceNumber));
  const tx = {
    shipment: { update: jest.fn().mockResolvedValue({}) },
    shipmentStop: {
      findFirst: jest.fn(async ({ where, orderBy }: any) => sorted(orderBy).find((r) => matches(r, where)) ?? null),
      findMany: jest.fn(async ({ where, orderBy }: any) => sorted(orderBy).filter((r) => matches(r, where))),
      update: jest.fn(async ({ where, data }: any) => { Object.assign(rows.find((r) => r.id === where.id)!, data); return {}; }),
      create: jest.fn(async ({ data }: any) => { const row = { id: `new-${nextId++}`, ...data }; rows.push(row); return row; }),
      aggregate: jest.fn(async () => ({ _max: { sequenceNumber: Math.max(0, ...rows.map((r) => r.sequenceNumber)) } })),
    },
    orderShipment: { create: jest.fn().mockResolvedValue({}) },
    order: { update: jest.fn().mockResolvedValue({}) },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  } as any;
  const route = () => sorted(null).map((r) => `${r.sequenceNumber}:${r.locationId}:${r.stopType}`);
  return { tx, route };
}

const order = (id: string, originId: string, destinationId: string) => ({ id, orderNumber: id, status: 'verified', originId, destinationId, trackableUnits: [], lineItems: [] });

describe('linkOrdersToShipment pickups (#329)', () => {
  it("adds a pickup for an order from a new origin after the existing pickups and before the drops", async () => {
    const { tx, route } = mockTx([
      { id: 'p1', locationId: 'A', stopType: 'pickup' },
      { id: 'd1', locationId: 'X', stopType: 'delivery' },
    ]);

    const { stopsCreated } = await linkOrdersToShipment(tx, { id: 'ship-1', reference: 'S', items: [] }, [order('o2', 'B', 'Y')], { orgId: 'org-1', actorId: null }, () => 'linked', jest.fn());

    expect(stopsCreated).toBe(2);
    expect(route()).toEqual(['1:A:pickup', '2:B:pickup', '3:X:delivery', '4:Y:delivery']);
    expect(tx.order.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ pickupStopId: 'new-1', deliveryStopId: 'new-2' }),
    }));
  });

  it('reuses the pickup and drop already at those places', async () => {
    const { tx, route } = mockTx([
      { id: 'p1', locationId: 'A', stopType: 'pickup' },
      { id: 'd1', locationId: 'X', stopType: 'delivery' },
    ]);

    const { stopsCreated } = await linkOrdersToShipment(tx, { id: 'ship-1', reference: 'S', items: [] }, [order('o1', 'A', 'X')], { orgId: 'org-1', actorId: null }, () => 'linked', jest.fn());

    expect(stopsCreated).toBe(0);
    expect(route()).toEqual(['1:A:pickup', '2:X:delivery']);
    expect(tx.order.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ pickupStopId: 'p1', deliveryStopId: 'd1' }) }));
  });
});
