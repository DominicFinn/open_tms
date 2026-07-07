import { CreateLaneCommandHandler, CREATE_LANE } from '../../commands/lanes/CreateLaneCommand';
import { UpdateLaneCommandHandler, UPDATE_LANE } from '../../commands/lanes/UpdateLaneCommand';
import { ArchiveLaneCommandHandler, ARCHIVE_LANE } from '../../commands/lanes/ArchiveLaneCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

const mockLane = {
  id: 'lane-1', name: 'Chicago → New York', originId: 'loc-1', destinationId: 'loc-2',
  distance: 1200, serviceLevel: 'FTL', status: 'active',
  archived: false, createdAt: new Date(), updatedAt: new Date(),
};

const mockTx = {
  lane: {
    create: jest.fn().mockResolvedValue(mockLane),
    update: jest.fn().mockResolvedValue(mockLane),
  },
  laneStop: {
    createMany: jest.fn().mockResolvedValue({ count: 2 }),
  },
  domainEventLog: { create: jest.fn().mockResolvedValue({}) },
} as any;

const mockPrisma = {
  $transaction: jest.fn((fn: Function) => fn(mockTx)),
  domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
} as any;

describe('Lane Command Handlers', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('CreateLaneCommandHandler', () => {
    it('creates lane and emits LANE_CREATED', async () => {
      const { bus } = mockEventBus();
      const handler = new CreateLaneCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(CREATE_LANE, {
          name: 'Chicago → New York',
          originId: 'loc-1',
          destinationId: 'loc-2',
          distance: 1200,
        })
      );

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('Chicago → New York');
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(EVENT_TYPES.LANE_CREATED);
      expect(result.events[0].payload).toEqual(
        expect.objectContaining({ originId: 'loc-1', destinationId: 'loc-2' })
      );
    });

    it('creates lane stops when provided', async () => {
      const { bus } = mockEventBus();
      const handler = new CreateLaneCommandHandler(mockPrisma, bus);

      await handler.execute(
        createTestCommand(CREATE_LANE, {
          name: 'Multi-stop',
          originId: 'loc-1',
          destinationId: 'loc-2',
          stops: [
            { locationId: 'loc-3', order: 1 },
            { locationId: 'loc-4', order: 2 },
          ],
        })
      );

      expect(mockTx.laneStop.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ locationId: 'loc-3', order: 1 }),
          expect.objectContaining({ locationId: 'loc-4', order: 2 }),
        ]),
      });
    });

    it('passes stop purpose through when provided', async () => {
      const { bus } = mockEventBus();
      const handler = new CreateLaneCommandHandler(mockPrisma, bus);

      await handler.execute(
        createTestCommand(CREATE_LANE, {
          name: 'Multi-stop',
          originId: 'loc-1',
          destinationId: 'loc-2',
          stops: [
            { locationId: 'loc-3', order: 1, purpose: 'cross_dock' },
          ],
        })
      );

      expect(mockTx.laneStop.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ locationId: 'loc-3', order: 1, purpose: 'cross_dock' }),
        ]),
      });
    });
  });

  describe('ArchiveLaneCommandHandler', () => {
    it('archives lane and emits LANE_ARCHIVED', async () => {
      mockTx.lane.update.mockResolvedValueOnce({ ...mockLane, archived: true });
      const { bus } = mockEventBus();
      const handler = new ArchiveLaneCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(ARCHIVE_LANE, { id: 'lane-1' })
      );

      expect(result.success).toBe(true);
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(EVENT_TYPES.LANE_ARCHIVED);
    });
  });
});
