import { RecordGeofenceArrivalCommandHandler, RECORD_GEOFENCE_ARRIVAL } from '../../commands/tracking/RecordGeofenceArrivalCommand';
import { RecordGeofenceDepartureCommandHandler, RECORD_GEOFENCE_DEPARTURE } from '../../commands/tracking/RecordGeofenceDepartureCommand';
import { RecordJourneyCheckpointCommandHandler, RECORD_JOURNEY_CHECKPOINT } from '../../commands/tracking/RecordJourneyCheckpointCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

function mockPrismaWithStop(stop: any) {
  const tx = {
    shipmentStop: {
      findUnique: jest.fn().mockResolvedValue(stop),
      update: jest.fn().mockResolvedValue({}),
    },
    domainEventLog: { create: jest.fn().mockResolvedValue({}) },
  } as any;
  const prisma = {
    $transaction: jest.fn((fn: Function) => fn(tx)),
    domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
  } as any;
  return { prisma, tx };
}

describe('RecordGeofenceArrivalCommandHandler', () => {
  const basePayload = {
    shipmentId: 'ship-1', stopId: 'stop-1', locationId: 'loc-1',
    lat: 40.1, lng: -74.2, eventTime: '2026-01-01T00:00:00.000Z', isDestination: false,
  };

  it('marks a pending stop arrived and emits TRACKING_GEOFENCE_ENTERED', async () => {
    const { prisma } = mockPrismaWithStop({ id: 'stop-1', status: 'pending' });
    const { bus } = mockEventBus();
    const handler = new RecordGeofenceArrivalCommandHandler(prisma, bus);

    const result = await handler.execute(createTestCommand(RECORD_GEOFENCE_ARRIVAL, basePayload));

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ arrived: true });
    expect(result.events).toHaveLength(1);
    expect(result.events[0].type).toBe(EVENT_TYPES.TRACKING_GEOFENCE_ENTERED);
    expect(result.events[0].payload).toEqual(
      expect.objectContaining({ shipmentId: 'ship-1', stopId: 'stop-1', locationId: 'loc-1' })
    );
  });

  it('also emits SHIPMENT_STOP_ARRIVED when the stop is the destination', async () => {
    const { prisma } = mockPrismaWithStop({ id: 'stop-1', status: 'pending' });
    const { bus } = mockEventBus();
    const handler = new RecordGeofenceArrivalCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(RECORD_GEOFENCE_ARRIVAL, { ...basePayload, isDestination: true })
    );

    expect(result.events.map((e) => e.type)).toEqual([
      EVENT_TYPES.TRACKING_GEOFENCE_ENTERED,
      EVENT_TYPES.SHIPMENT_STOP_ARRIVED,
    ]);
    expect(result.events[1].payload).toEqual({ stopId: 'stop-1', shipmentId: 'ship-1', eventTime: '2026-01-01T00:00:00.000Z' });
  });

  it('is a no-op when the stop is not pending (already arrived)', async () => {
    const { prisma, tx } = mockPrismaWithStop({ id: 'stop-1', status: 'arrived' });
    const { bus } = mockEventBus();
    const handler = new RecordGeofenceArrivalCommandHandler(prisma, bus);

    const result = await handler.execute(createTestCommand(RECORD_GEOFENCE_ARRIVAL, basePayload));

    expect(result.data).toEqual({ arrived: false });
    expect(result.events).toHaveLength(0);
    expect(tx.shipmentStop.update).not.toHaveBeenCalled();
  });
});

describe('RecordGeofenceDepartureCommandHandler', () => {
  const payload = {
    shipmentId: 'ship-1', stopId: 'stop-1', locationId: 'loc-1',
    lat: 40.1, lng: -74.2, eventTime: '2026-01-01T00:00:00.000Z',
  };

  it('marks an arrived stop completed and emits TRACKING_GEOFENCE_EXITED + SHIPMENT_STOP_COMPLETED', async () => {
    const { prisma } = mockPrismaWithStop({ id: 'stop-1', status: 'arrived' });
    const { bus } = mockEventBus();
    const handler = new RecordGeofenceDepartureCommandHandler(prisma, bus);

    const result = await handler.execute(createTestCommand(RECORD_GEOFENCE_DEPARTURE, payload));

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ departed: true });
    expect(result.events.map((e) => e.type)).toEqual([
      EVENT_TYPES.TRACKING_GEOFENCE_EXITED,
      EVENT_TYPES.SHIPMENT_STOP_COMPLETED,
    ]);
  });

  it('is a no-op when the stop is not currently arrived', async () => {
    const { prisma, tx } = mockPrismaWithStop({ id: 'stop-1', status: 'pending' });
    const { bus } = mockEventBus();
    const handler = new RecordGeofenceDepartureCommandHandler(prisma, bus);

    const result = await handler.execute(createTestCommand(RECORD_GEOFENCE_DEPARTURE, payload));

    expect(result.data).toEqual({ departed: false });
    expect(result.events).toHaveLength(0);
    expect(tx.shipmentStop.update).not.toHaveBeenCalled();
  });
});

describe('RecordJourneyCheckpointCommandHandler', () => {
  const payload = {
    shipmentId: 'ship-1', stopId: 'stop-dest', locationId: 'loc-dest',
    lat: 40.5, lng: -74.0, eventTime: '2026-01-01T00:00:00.000Z',
    checkpointIndex: 3, distanceAlongRouteMeters: 5000, fractionComplete: 0.3,
  };

  function mockPrismaForCheckpoint(latestIndex: number | null) {
    const tx = {
      shipmentJourneyCheckpoint: {
        findFirst: jest.fn().mockResolvedValue(latestIndex === null ? null : { checkpointIndex: latestIndex }),
        create: jest.fn().mockResolvedValue({ id: 'chk-1' }),
      },
      shipmentStop: { findFirst: jest.fn().mockResolvedValue(null) },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    return { prisma, tx };
  }

  it('records a new checkpoint and emits TRACKING_JOURNEY_CHECKPOINT', async () => {
    const { prisma } = mockPrismaForCheckpoint(null);
    const { bus } = mockEventBus();
    const handler = new RecordJourneyCheckpointCommandHandler(prisma, bus);

    const result = await handler.execute(createTestCommand(RECORD_JOURNEY_CHECKPOINT, payload));

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ recorded: true });
    expect(result.events[0].type).toBe(EVENT_TYPES.TRACKING_JOURNEY_CHECKPOINT);
    expect(result.events[0].payload).toEqual(
      expect.objectContaining({ checkpointIndex: 3, totalCheckpoints: 10 })
    );
  });

  it('is a no-op when the checkpoint index is not greater than the latest recorded', async () => {
    const { prisma, tx } = mockPrismaForCheckpoint(5);
    const { bus } = mockEventBus();
    const handler = new RecordJourneyCheckpointCommandHandler(prisma, bus);

    const result = await handler.execute(createTestCommand(RECORD_JOURNEY_CHECKPOINT, payload));

    expect(result.data).toEqual({ recorded: false });
    expect(result.events).toHaveLength(0);
    expect(tx.shipmentJourneyCheckpoint.create).not.toHaveBeenCalled();
  });

  describe('filling in checkpoints passed between pings', () => {
    const passed = [1, 2, 3, 4, 5].map((i) => ({
      checkpointIndex: i, lat: 40 + i / 100, lng: -74, distanceAlongRouteMeters: i * 1000, fractionComplete: i / 10,
    }));
    const jump = {
      ...payload,
      checkpointIndex: 6, distanceAlongRouteMeters: 6200, fractionComplete: 0.62,
      eventTime: '2026-01-01T06:00:00.000Z', passed,
    };

    function withLatest(latest: object | null) {
      const { prisma, tx } = mockPrismaForCheckpoint(null);
      tx.shipmentJourneyCheckpoint.findFirst.mockResolvedValue(latest);
      return { prisma, tx };
    }

    it('records every skipped checkpoint after the latest, marked inferred, then the reached one', async () => {
      const { prisma, tx } = withLatest({
        checkpointIndex: 2, distanceAlongRouteMeters: 2000, eventTime: new Date('2026-01-01T02:00:00.000Z'),
      });
      const { bus } = mockEventBus();
      const handler = new RecordJourneyCheckpointCommandHandler(prisma, bus);

      const result = await handler.execute(createTestCommand(RECORD_JOURNEY_CHECKPOINT, jump));

      const written = tx.shipmentJourneyCheckpoint.create.mock.calls.map((c: any) => c[0].data.checkpointIndex);
      expect(written).toEqual([3, 4, 5, 6]);
      expect(result.events.map((e: any) => [e.payload.checkpointIndex, !!e.payload.inferred])).toEqual([
        [3, true], [4, true], [5, true], [6, false],
      ]);
      // Interpolated by distance between the 02:00 checkpoint at 2000m and the 06:00 ping at 6200m.
      const fourth = tx.shipmentJourneyCheckpoint.create.mock.calls[1][0].data;
      expect(fourth.eventTime.toISOString()).toBe(new Date(Date.parse('2026-01-01T02:00:00.000Z') + (2000 / 4200) * 4 * 3600_000).toISOString());
      expect(fourth.lat).toBe(40.04);
    });

    it('times the first checkpoints from the origin departure when none is recorded yet', async () => {
      const { prisma, tx } = withLatest(null);
      tx.shipmentStop.findFirst.mockResolvedValue({ actualDeparture: new Date('2026-01-01T00:00:00.000Z') });
      const { bus } = mockEventBus();
      const handler = new RecordJourneyCheckpointCommandHandler(prisma, bus);

      await handler.execute(createTestCommand(RECORD_JOURNEY_CHECKPOINT, jump));

      const rows = tx.shipmentJourneyCheckpoint.create.mock.calls.map((c: any) => c[0].data);
      expect(rows.map((r: any) => r.checkpointIndex)).toEqual([1, 2, 3, 4, 5, 6]);
      // Departed at 00:00 (0m), reached 6200m at 06:00, so checkpoint 1 (1000m) is ~00:58.
      expect(rows[0].eventTime.toISOString()).toBe(new Date((1000 / 6200) * 6 * 3600_000 + Date.parse('2026-01-01T00:00:00.000Z')).toISOString());
      const times = rows.map((r: any) => r.eventTime.getTime());
      expect([...times].sort((a, b) => a - b)).toEqual(times);
      expect(new Set(times).size).toBe(times.length);
    });

    it('fills from checkpoint 1 at the ping time when neither a checkpoint nor a departure is recorded', async () => {
      const { prisma, tx } = withLatest(null);
      const { bus } = mockEventBus();
      const handler = new RecordJourneyCheckpointCommandHandler(prisma, bus);

      await handler.execute(createTestCommand(RECORD_JOURNEY_CHECKPOINT, jump));

      const rows = tx.shipmentJourneyCheckpoint.create.mock.calls.map((c: any) => c[0].data);
      expect(rows.map((r: any) => r.checkpointIndex)).toEqual([1, 2, 3, 4, 5, 6]);
      expect(rows.every((r: any) => r.eventTime.toISOString() === jump.eventTime)).toBe(true);
    });
  });
});

