import { ShipmentRoutePlanner } from '../../services/routing/ShipmentRoutePlanner';
import { SET_SHIPMENT_ROUTE } from '../../commands/shipments/SetShipmentRouteCommand';
import { ShipmentRouteRepository } from '../../repositories/ShipmentRouteRepository';
import { ShipmentRoutePlanningHandler } from '../../events/handlers/ShipmentRoutePlanningHandler';
import { createTestEvent } from '../helpers/testUtils';
import { EVENT_TYPES } from '../../events/eventTypes';

const stop = (locationId: string, lat: number | null = 40, lng: number | null = -74) => ({ locationId, lat, lng });

function setup(shipment: any, serverKey: string | null = 'server-key') {
  const routes = { findForPlanning: jest.fn().mockResolvedValue(shipment), findEffectiveRoute: jest.fn() };
  const organizations = { getSettings: jest.fn().mockResolvedValue({ googleMapsServerKey: serverKey }) } as any;
  const directions = {
    computeDirections: jest.fn().mockResolvedValue({
      encodedPolyline: 'abc', distanceMeters: 1000, durationSeconds: 600, summary: 'via I-90', waypoints: [{ lat: 1, lng: 2 }],
    }),
  };
  const commandBus = { dispatch: jest.fn().mockResolvedValue({ success: true, events: [] }) } as any;
  const planner = new ShipmentRoutePlanner(routes, organizations, directions, commandBus);
  return { planner, routes, organizations, directions, commandBus };
}

const custom = (overrides: object = {}) => ({
  status: 'draft', laneId: null, currentStopsKey: null,
  stops: [stop('a', 44, -88), stop('b', 44, -92), stop('c', 39, -104)],
  ...overrides,
});

describe('ShipmentRoutePlanner (#328)', () => {
  it('plans a custom route through the stops in order and stores it', async () => {
    const { planner, directions, commandBus } = setup(custom());

    expect(await planner.plan('org-1', 'ship-1')).toBe('planned');

    expect(directions.computeDirections).toHaveBeenCalledWith('server-key', {
      origin: { lat: 44, lng: -88 }, destination: { lat: 39, lng: -104 }, waypoints: [{ lat: 44, lng: -92 }],
    });
    expect(commandBus.dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: SET_SHIPMENT_ROUTE, orgId: 'org-1',
      payload: expect.objectContaining({ shipmentId: 'ship-1', route: expect.objectContaining({ encodedPolyline: 'abc', stopsKey: 'a,b,c' }) }),
    }));
  });

  it('skips the provider when the stops have not changed', async () => {
    const { planner, directions } = setup(custom({ currentStopsKey: 'a,b,c' }));
    expect(await planner.plan('org-1', 'ship-1')).toBe('unchanged');
    expect(directions.computeDirections).not.toHaveBeenCalled();
  });

  it('leaves a lane shipment on its lane, clearing any route of its own', async () => {
    const { planner, commandBus } = setup(custom({ laneId: 'lane-1', currentStopsKey: 'a,c' }));
    expect(await planner.plan('org-1', 'ship-1')).toBe('cleared');
    expect(commandBus.dispatch).toHaveBeenCalledWith(expect.objectContaining({ payload: { shipmentId: 'ship-1', route: null } }));

    const noOwnRoute = setup(custom({ laneId: 'lane-1' }));
    expect(await noOwnRoute.planner.plan('org-1', 'ship-1')).toBe('uses_lane');
    expect(noOwnRoute.commandBus.dispatch).not.toHaveBeenCalled();
  });

  it('does not re-plan a shipment that is already moving', async () => {
    const { planner, directions } = setup(custom({ status: 'in_progress' }));
    expect(await planner.plan('org-1', 'ship-1')).toBe('not_plannable_status');
    expect(directions.computeDirections).not.toHaveBeenCalled();
  });

  it('needs two located stops and a server key', async () => {
    expect(await setup(custom({ stops: [stop('a'), stop('b', null, null)] })).planner.plan('org-1', 's')).toBe('not_enough_stops');
    const noKey = setup(custom(), null);
    expect(await noKey.planner.plan('org-1', 's')).toBe('no_server_key');
    expect(noKey.directions.computeDirections).not.toHaveBeenCalled();
  });

  it('returns not_found for a shipment outside the org', async () => {
    expect(await setup(null).planner.plan('org-2', 'ship-1')).toBe('not_found');
  });
});

describe('ShipmentRouteRepository.findEffectiveRoute (#328)', () => {
  const route = (polyline: string) => ({ encodedPolyline: polyline, waypoints: [], distanceMeters: 1, durationSeconds: 1, summary: null, corridorMeters: 5000 });

  it("prefers the shipment's own route, falls back to the lane's, and is undefined outside the org", async () => {
    const findFirst = jest.fn()
      .mockResolvedValueOnce({ route: route('own'), lane: { route: route('lane') } })
      .mockResolvedValueOnce({ route: null, lane: { route: route('lane') } })
      .mockResolvedValueOnce({ route: null, lane: null })
      .mockResolvedValueOnce(null);
    const repo = new ShipmentRouteRepository({ shipment: { findFirst } } as any);

    expect(await repo.findEffectiveRoute('org-1', 's')).toMatchObject({ source: 'shipment', encodedPolyline: 'own' });
    expect(await repo.findEffectiveRoute('org-1', 's')).toMatchObject({ source: 'lane', encodedPolyline: 'lane' });
    expect(await repo.findEffectiveRoute('org-1', 's')).toBeNull();
    expect(await repo.findEffectiveRoute('org-2', 's')).toBeUndefined();
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 's', orgId: 'org-2' } }));
  });
});

describe('ShipmentRoutePlanningHandler (#328)', () => {
  it('plans on shipment created/updated and rethrows provider failures so the job retries', async () => {
    const planner = { plan: jest.fn().mockRejectedValue(new Error('provider down')) };
    const handler = new ShipmentRoutePlanningHandler(planner);
    expect(handler.eventPatterns).toEqual([EVENT_TYPES.SHIPMENT_CREATED, EVENT_TYPES.SHIPMENT_UPDATED]);

    await expect(handler.handle(createTestEvent(EVENT_TYPES.SHIPMENT_UPDATED, 'shipment', 'ship-1', {}))).rejects.toThrow('provider down');
    expect(planner.plan).toHaveBeenCalledWith('test-org', 'ship-1');
  });
});
