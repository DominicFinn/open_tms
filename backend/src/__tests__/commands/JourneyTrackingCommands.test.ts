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
    expect(result.events[1].payload).toEqual({ stopId: 'stop-1', shipmentId: 'ship-1' });
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
});
