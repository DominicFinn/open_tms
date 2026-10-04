import { assignMatchingLane } from '../../commands/shipments/assignMatchingLane';

function tx(stops: string[], lanes: Array<{ id: string; serviceLevel: string; stops: string[] }>) {
  return {
    shipmentStop: { findMany: jest.fn().mockResolvedValue(stops.map((locationId) => ({ locationId }))) },
    lane: { findMany: jest.fn().mockResolvedValue(lanes.map((l) => ({ ...l, stops: l.stops.map((locationId) => ({ locationId })) }))) },
    shipment: { update: jest.fn().mockResolvedValue({}) },
  } as any;
}

describe('assignMatchingLane (#328)', () => {
  it('puts the shipment on a lane whose endpoints, service level and middle stops match exactly', async () => {
    const t = tx(['gb', 'roch', 'den'], [
      { id: 'loose', serviceLevel: 'LTL', stops: [] },
      { id: 'exact', serviceLevel: 'Both', stops: ['roch'] },
    ]);

    expect(await assignMatchingLane(t, 'org-1', { id: 'ship-1', serviceLevel: 'LTL' })).toBe('exact');
    expect(t.lane.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { orgId: 'org-1', archived: false, originId: 'gb', destinationId: 'den' },
    }));
    expect(t.shipment.update).toHaveBeenCalledWith({ where: { id: 'ship-1', orgId: 'org-1' }, data: { laneId: 'exact' } });
  });

  it('leaves the shipment on a custom route when no lane fits', async () => {
    const wrongLevel = tx(['gb', 'den'], [{ id: 'ftl', serviceLevel: 'FTL', stops: [] }]);
    expect(await assignMatchingLane(wrongLevel, 'org-1', { id: 'ship-1', serviceLevel: 'LTL' })).toBeNull();

    const skipsAStop = tx(['gb', 'roch', 'den'], [{ id: 'direct', serviceLevel: 'LTL', stops: [] }]);
    expect(await assignMatchingLane(skipsAStop, 'org-1', { id: 'ship-1', serviceLevel: 'LTL' })).toBeNull();
    expect(skipsAStop.shipment.update).not.toHaveBeenCalled();
  });
});
