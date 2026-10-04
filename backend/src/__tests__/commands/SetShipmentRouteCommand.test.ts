import { SetShipmentRouteCommandHandler, SET_SHIPMENT_ROUTE } from '../../commands/shipments/SetShipmentRouteCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

function setup(shipment: object | null = { id: 'ship-1' }) {
  const tx = {
    shipment: { findFirst: jest.fn().mockResolvedValue(shipment) },
    shipmentRoute: { upsert: jest.fn().mockResolvedValue({}), deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
    domainEventLog: { create: jest.fn().mockResolvedValue({}) },
  } as any;
  const prisma = { $transaction: jest.fn((fn: Function) => fn(tx)), domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) } } as any;
  return { tx, handler: new SetShipmentRouteCommandHandler(prisma, mockEventBus().bus) };
}

const route = {
  encodedPolyline: 'abc', waypoints: [{ lat: 1, lng: 2 }], distanceMeters: 1000, durationSeconds: 600,
  summary: 'via I-90', provider: 'google', stopsKey: 'a,b,c',
};

describe('SetShipmentRouteCommandHandler (#328)', () => {
  it('stores the route under the command org and emits shipment.route_planned', async () => {
    const { tx, handler } = setup();
    const command = createTestCommand(SET_SHIPMENT_ROUTE, { shipmentId: 'ship-1', route }, { orgId: 'org-1' });

    const result = await handler.execute(command);

    expect(result.data).toEqual({ changed: true });
    expect(tx.shipmentRoute.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { shipmentId: 'ship-1', orgId: 'org-1' },
      create: expect.objectContaining({ shipmentId: 'ship-1', orgId: 'org-1', stopsKey: 'a,b,c' }),
    }));
    expect(result.events[0]).toMatchObject({
      type: EVENT_TYPES.SHIPMENT_ROUTE_PLANNED,
      entityId: 'ship-1',
      payload: { shipmentId: 'ship-1', distanceMeters: 1000, stopCount: 3 },
    });
  });

  it('removes the route when given null, without an event', async () => {
    const { tx, handler } = setup();
    const result = await handler.execute(createTestCommand(SET_SHIPMENT_ROUTE, { shipmentId: 'ship-1', route: null }));
    expect(tx.shipmentRoute.deleteMany).toHaveBeenCalledWith({ where: { shipmentId: 'ship-1', orgId: 'test-org' } });
    expect(result.events).toHaveLength(0);
  });

  it('fails for a shipment outside the org', async () => {
    const { tx, handler } = setup(null);
    const result = await handler.execute(createTestCommand(SET_SHIPMENT_ROUTE, { shipmentId: 'ship-x', route }));
    expect(result.success).toBe(false);
    expect(result.error).toBe('Shipment not found');
    expect(tx.shipmentRoute.upsert).not.toHaveBeenCalled();
  });
});
