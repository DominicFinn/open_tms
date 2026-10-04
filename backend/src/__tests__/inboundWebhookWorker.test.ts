const fakeEventBus = { publish: jest.fn().mockResolvedValue(undefined) };

jest.mock('../di/container.js', () => ({
  container: { resolve: jest.fn(() => fakeEventBus) },
}));
jest.mock('../di/tokens.js', () => ({
  TOKENS: new Proxy({}, { get: (_t, prop) => Symbol.for(String(prop)) }),
}));

import { createInboundWebhookWorker, WebhookTenantUnresolvedError } from '../workers/inboundWebhookWorker.js';
import { EVENT_TYPES } from '../events/eventTypes.js';
import { QueueMessage } from '../queue/IQueueAdapter.js';
import { WebhookEvent } from '../queue/events.js';

function buildPrisma(overrides: any = {}) {
  return {
    webhookLog: {
      findUnique: jest.fn().mockResolvedValue({ id: 'log-1' }),
      update: jest.fn().mockResolvedValue({}),
    },
    apiKey: { findUnique: jest.fn().mockResolvedValue({ orgId: 'org-from-key' }) },
    iotVendor: { findUnique: jest.fn().mockResolvedValue(null) },
    deviceEvent: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() },
    device: { findFirst: jest.fn().mockResolvedValue(null), findUnique: jest.fn().mockResolvedValue(null), update: jest.fn() },
    sensorReading: { create: jest.fn(), createMany: jest.fn(({ data }: any) => Promise.resolve({ count: data.length })) },
    shipment: {
      findFirst: jest.fn().mockResolvedValue({ id: 'shipment-1', reference: 'TRUCK-1' }),
      findUnique: jest.fn().mockResolvedValue({ id: 'shipment-1', reference: 'TRUCK-1' }),
    },
    order: { findFirst: jest.fn().mockResolvedValue(null) },
    orderShipment: { findFirst: jest.fn().mockResolvedValue(null) },
    shipmentEvent: {
      create: jest.fn().mockResolvedValue({ id: 'shipment-event-1' }),
    },
    ...overrides,
  } as any;
}

function buildDeliveryService() {
  return { checkGeofenceAndUpdateOrders: jest.fn().mockResolvedValue(0) } as any;
}

function legacyMessage(overrides: any = {}): QueueMessage<WebhookEvent> {
  return {
    type: 'inbound.webhook',
    payload: {
      webhookLogId: 'log-1',
      apiKeyId: 'key-1',
      ipAddress: '127.0.0.1',
      orgId: 'org-1',
      rawPayload: {
        event: {
          device: { id: 'dev-1', name: 'TRUCK-1' },
          type: 'location',
          location: { lat: 40.1, lng: -74.2 },
          startTime: '2026-01-01T00:00:00.000Z',
        },
      },
      ...overrides,
    },
  };
}

describe('createInboundWebhookWorker — legacy format path', () => {
  beforeEach(() => {
    fakeEventBus.publish.mockClear();
  });

  it('publishes TRACKING_LOCATION_RECEIVED when a legacy-shape payload resolves a shipment with location data', async () => {
    const prisma = buildPrisma();
    const worker = createInboundWebhookWorker(prisma, buildDeliveryService());

    await worker(legacyMessage());

    expect(prisma.shipmentEvent.create).toHaveBeenCalled();
    expect(fakeEventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: EVENT_TYPES.TRACKING_LOCATION_RECEIVED,
        orgId: 'org-1',
        entityType: 'shipment',
        entityId: 'shipment-1',
        payload: {
          shipmentId: 'shipment-1',
          lat: 40.1,
          lng: -74.2,
          eventTime: '2026-01-01T00:00:00.000Z',
        },
      }),
    );
  });

  it('does not publish when the legacy-shape payload has no location data', async () => {
    const prisma = buildPrisma();
    const worker = createInboundWebhookWorker(prisma, buildDeliveryService());

    await worker(legacyMessage({
      rawPayload: {
        event: {
          device: { id: 'dev-1', name: 'TRUCK-1' },
          type: 'status',
        },
      },
    }));

    expect(fakeEventBus.publish).not.toHaveBeenCalled();
  });

  it('does not publish when no shipment is resolved for the device', async () => {
    const prisma = buildPrisma({
      shipment: { findFirst: jest.fn().mockResolvedValue(null), findUnique: jest.fn().mockResolvedValue(null) },
    });
    const worker = createInboundWebhookWorker(prisma, buildDeliveryService());

    await worker(legacyMessage());

    expect(prisma.shipmentEvent.create).not.toHaveBeenCalled();
    expect(fakeEventBus.publish).not.toHaveBeenCalled();
  });
});

describe('createInboundWebhookWorker — tenancy', () => {
  beforeEach(() => {
    fakeEventBus.publish.mockClear();
  });

  it('resolves legacy devices, shipments and orders only within the message org', async () => {
    const prisma = buildPrisma();
    const worker = createInboundWebhookWorker(prisma, buildDeliveryService());

    await worker(legacyMessage({ orgId: 'org-b' }));

    expect(prisma.device.findFirst.mock.calls[0][0].where.orgId).toBe('org-b');
    expect(prisma.shipment.findFirst.mock.calls[0][0].where.orgId).toBe('org-b');
    expect(fakeEventBus.publish).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'org-b' }));
  });

  it('derives the org from the API key for a message queued before orgId existed', async () => {
    const prisma = buildPrisma();
    const worker = createInboundWebhookWorker(prisma, buildDeliveryService());

    await worker(legacyMessage({ orgId: undefined }));

    expect(prisma.apiKey.findUnique).toHaveBeenCalledWith({ where: { id: 'key-1' }, select: { orgId: true } });
    expect(prisma.shipment.findFirst.mock.calls[0][0].where.orgId).toBe('org-from-key');
  });

  it('fails a message with neither an orgId nor an API key, so it dead-letters, and writes nothing', async () => {
    const prisma = buildPrisma();
    const worker = createInboundWebhookWorker(prisma, buildDeliveryService());

    await expect(worker(legacyMessage({ orgId: undefined, apiKeyId: null }))).rejects.toBeInstanceOf(
      WebhookTenantUnresolvedError,
    );

    // Without an org the log row cannot be read or written in scope, so it is left for the dead letter.
    expect(prisma.webhookLog.findUnique).not.toHaveBeenCalled();
    expect(prisma.webhookLog.update).not.toHaveBeenCalled();
    expect(prisma.shipment.findFirst).not.toHaveBeenCalled();
    expect(prisma.shipmentEvent.create).not.toHaveBeenCalled();
  });

  it('reads and writes the webhook log only inside the message org', async () => {
    const prisma = buildPrisma();
    const worker = createInboundWebhookWorker(prisma, buildDeliveryService());

    await worker(legacyMessage({ orgId: 'org-b' }));

    expect(prisma.webhookLog.findUnique).toHaveBeenCalledWith({ where: { id: 'log-1', orgId: 'org-b' } });
    expect(prisma.webhookLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'log-1', orgId: 'org-b' } }),
    );
  });

  it('skips a log row that belongs to another org as if it were missing', async () => {
    const prisma = buildPrisma({
      webhookLog: { findUnique: jest.fn().mockResolvedValue(null), update: jest.fn() },
    });
    const worker = createInboundWebhookWorker(prisma, buildDeliveryService());

    await worker(legacyMessage({ orgId: 'org-b' }));

    expect(prisma.shipment.findFirst).not.toHaveBeenCalled();
    expect(prisma.webhookLog.update).not.toHaveBeenCalled();
  });

  it('checks the System Loco vendor switch for the message org', async () => {
    const prisma = buildPrisma({
      iotVendor: { findUnique: jest.fn().mockResolvedValue({ enabled: false }) },
    });
    const worker = createInboundWebhookWorker(prisma, buildDeliveryService());

    await worker(legacyMessage({
      orgId: 'org-b',
      rawPayload: { id: 'evt-1', type: 'temperature', owner: 'o', device: { id: 'ext-1', name: 'T1' } },
    }));

    expect(prisma.iotVendor.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { orgId_vendorKey: { orgId: 'org-b', vendorKey: 'system_loco' } },
    }));
    expect(prisma.webhookLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'disabled' }) }),
    );
  });

  it('rejects a System Loco feed for a device another org owns, without retrying', async () => {
    const prisma = buildPrisma({
      device: {
        findFirst: jest.fn(),
        findUnique: jest.fn().mockResolvedValue({ id: 'dev-a', orgId: 'org-a' }),
        update: jest.fn(),
      },
    });
    const worker = createInboundWebhookWorker(prisma, buildDeliveryService());

    await worker(legacyMessage({
      orgId: 'org-b',
      rawPayload: { id: 'evt-2', type: 'temperature', owner: 'o', device: { id: 'ext-1', name: 'T1' } },
    }));

    expect(prisma.device.update).not.toHaveBeenCalled();
    expect(prisma.sensorReading.create).not.toHaveBeenCalled();
    expect(prisma.webhookLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'rejected' }) }),
    );
  });
});

describe('createInboundWebhookWorker — generic ping telemetry and timing', () => {
  const telemetryPayload = {
    event: {
      device: { id: 'dev-1', name: 'TRUCK-1' },
      type: 'location',
      startTime: '2026-01-01T08:00:00.000Z',
      location: { global: { lat: 40.1, lon: -74.2 } },
      readingsCount: 3,
      readings: [
        { time: '2026-01-01T07:50:00.000Z', temperature: 4.1, batteryLevel: 88 },
        { time: '2026-01-01T07:55:00.000Z', temperature: 4.4 },
        { time: '2026-01-01T08:00:00.000Z', temperature: 4.6, batteryLevel: 87 },
      ],
    },
  };

  beforeEach(() => fakeEventBus.publish.mockClear());

  it('stores every reading in the ping against the registered device, keyed for idempotent retries', async () => {
    const prisma = buildPrisma({
      device: { findFirst: jest.fn().mockResolvedValue({ id: 'device-1', assignments: [] }), findUnique: jest.fn(), update: jest.fn() },
    });
    const worker = createInboundWebhookWorker(prisma, buildDeliveryService());

    await worker(legacyMessage({ rawPayload: telemetryPayload }));

    const { data, skipDuplicates } = prisma.sensorReading.createMany.mock.calls[0][0];
    expect(skipDuplicates).toBe(true);
    expect(data).toHaveLength(3);
    expect(data[0]).toEqual(expect.objectContaining({
      deviceId: 'device-1', shipmentId: 'shipment-1', temperature: 4.1, batteryLevel: 88,
      eventTime: new Date('2026-01-01T07:50:00.000Z'), sourceReportId: 'webhook:log-1:0',
    }));
    expect(prisma.webhookLog.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        responseBody: expect.objectContaining({ readingsReceived: 3, readingsStored: 3 }),
      }),
    }));
  });

  it('keeps telemetry only in the raw log when the device is not registered to the org', async () => {
    const prisma = buildPrisma();
    const worker = createInboundWebhookWorker(prisma, buildDeliveryService());

    await worker(legacyMessage({ rawPayload: telemetryPayload }));

    expect(prisma.sensorReading.createMany).not.toHaveBeenCalled();
  });

  it('runs arrival and checkpoint evaluation for generic pings, stamped with the device time', async () => {
    const prisma = buildPrisma();
    const arrivalCriteriaService = { evaluateAndUpdateOrders: jest.fn().mockResolvedValue([]) } as any;
    const worker = createInboundWebhookWorker(prisma, buildDeliveryService(), arrivalCriteriaService);

    await worker(legacyMessage({ rawPayload: telemetryPayload }));

    expect(arrivalCriteriaService.evaluateAndUpdateOrders).toHaveBeenCalledWith(expect.objectContaining({
      orgId: 'org-1', shipmentId: 'shipment-1', lat: 40.1, lng: -74.2, eventTime: '2026-01-01T08:00:00.000Z',
    }));
  });
});

describe('createInboundWebhookWorker — consolidation fan-out (#329)', () => {
  it('applies a ping on a consolidation\'s device to each shipment on it, with its own copy of the readings', async () => {
    const prisma = buildPrisma({
      device: {
        findFirst: jest.fn().mockResolvedValue({ id: 'device-1', assignments: [{ shipmentId: null, consolidationId: 'con-1' }] }),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      consolidationShipment: { findMany: jest.fn().mockResolvedValue([{ shipmentId: 'ship-a' }, { shipmentId: 'ship-b' }]) },
      shipment: {
        findMany: jest.fn().mockResolvedValue([{ id: 'ship-b', reference: 'SH-B' }, { id: 'ship-a', reference: 'SH-A' }]),
        findFirst: jest.fn(),
      },
    });
    const arrivalCriteriaService = { evaluateAndUpdateOrders: jest.fn().mockResolvedValue([]) } as any;
    const worker = createInboundWebhookWorker(prisma, buildDeliveryService(), arrivalCriteriaService);

    await worker(legacyMessage({
      rawPayload: {
        event: {
          device: { id: 'dev-1', name: 'RUN-TRACKER' },
          type: 'location',
          startTime: '2026-01-01T08:00:00.000Z',
          location: { global: { lat: 40.1, lon: -74.2 } },
          readings: [{ time: '2026-01-01T08:00:00.000Z', temperature: 4.6 }],
        },
      },
    }));

    expect(prisma.consolidationShipment.findMany.mock.calls[0][0].where).toMatchObject({ consolidationId: 'con-1', consolidation: { orgId: 'org-1' } });
    expect(arrivalCriteriaService.evaluateAndUpdateOrders.mock.calls.map((c: any[]) => c[0].shipmentId)).toEqual(['ship-a', 'ship-b']);
    expect(prisma.shipmentEvent.create.mock.calls.map((c: any[]) => c[0].data.shipmentId)).toEqual(['ship-a', 'ship-b']);
    const copies = prisma.sensorReading.createMany.mock.calls.map((c: any[]) => [c[0].data[0].shipmentId, c[0].data[0].sourceReportId]);
    expect(copies).toEqual([['ship-a', 'webhook:log-1:0'], ['ship-b', 'webhook:log-1:0:ship-b']]);
    expect(prisma.webhookLog.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ shipmentId: 'ship-a', responseBody: expect.objectContaining({ readingsStored: 2 }) }),
    }));
  });
});

describe('createInboundWebhookWorker — standalone worker wiring (#287)', () => {
  it('publishes through an injected event bus instead of the DI container', async () => {
    fakeEventBus.publish.mockClear();
    const injectedBus = { publish: jest.fn().mockResolvedValue(undefined) } as any;
    const prisma = buildPrisma();
    const worker = createInboundWebhookWorker(prisma, buildDeliveryService(), undefined, injectedBus);

    await worker(legacyMessage());

    expect(injectedBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: EVENT_TYPES.TRACKING_LOCATION_RECEIVED }),
    );
    expect(fakeEventBus.publish).not.toHaveBeenCalled();
  });
});

