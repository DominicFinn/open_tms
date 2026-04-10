import { LaneProjection } from '../../events/projections/LaneProjection';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestEvent } from '../helpers/testUtils';

const mockLane = {
  id: 'lane-1', name: 'Chicago → New York', status: 'active',
  serviceLevel: 'FTL', distance: 1200,
  createdAt: new Date(), updatedAt: new Date(),
  origin: { name: 'Chicago WH', city: 'Chicago' },
  destination: { name: 'NY Depot', city: 'New York' },
  laneCarriers: [{ id: 'lc1' }, { id: 'lc2' }],
  shipments: [{ id: 's1' }],
};

const mockPrisma = {
  lane: { findUnique: jest.fn().mockResolvedValue(mockLane) },
  laneReadModel: {
    upsert: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({}),
  },
} as any;

describe('LaneProjection', () => {
  let projection: LaneProjection;

  beforeEach(() => {
    jest.clearAllMocks();
    projection = new LaneProjection(mockPrisma);
  });

  it('has correct name and patterns', () => {
    expect(projection.name).toBe('projection.lane');
    expect(projection.eventPatterns).toContain('lane.*');
  });

  it('creates LaneReadModel on LANE_CREATED', async () => {
    const event = createTestEvent(
      EVENT_TYPES.LANE_CREATED, 'lane', 'lane-1',
      { name: 'Chicago → New York', originId: 'loc-1', destinationId: 'loc-2' }
    );

    await projection.handle(event);

    expect(mockPrisma.laneReadModel.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'lane-1' },
        create: expect.objectContaining({
          name: 'Chicago → New York',
          originCity: 'Chicago',
          destinationCity: 'New York',
          carrierCount: 2,
          activeShipmentCount: 1,
        }),
      })
    );
  });

  it('updates LaneReadModel on LANE_UPDATED', async () => {
    const event = createTestEvent(
      EVENT_TYPES.LANE_UPDATED, 'lane', 'lane-1', {}
    );

    await projection.handle(event);

    expect(mockPrisma.laneReadModel.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'lane-1' },
        data: expect.objectContaining({
          serviceLevel: 'FTL',
          carrierCount: 2,
        }),
      })
    );
  });

  it('marks as archived on LANE_ARCHIVED', async () => {
    const event = createTestEvent(
      EVENT_TYPES.LANE_ARCHIVED, 'lane', 'lane-1', {}
    );

    await projection.handle(event);

    expect(mockPrisma.laneReadModel.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'archived' }),
      })
    );
  });
});
