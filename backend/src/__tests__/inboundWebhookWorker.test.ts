const fakeEventBus = { publish: jest.fn().mockResolvedValue(undefined) };

jest.mock('../di/container.js', () => ({
  container: { resolve: jest.fn(() => fakeEventBus) },
}));
jest.mock('../di/tokens.js', () => ({
  TOKENS: new Proxy({}, { get: (_t, prop) => Symbol.for(String(prop)) }),
}));

import { createInboundWebhookWorker } from '../workers/inboundWebhookWorker.js';
import { EVENT_TYPES } from '../events/eventTypes.js';
import { QueueMessage } from '../queue/IQueueAdapter.js';
import { WebhookEvent } from '../queue/events.js';

function buildPrisma(overrides: any = {}) {
  return {
    webhookLog: {
      findUnique: jest.fn().mockResolvedValue({ id: 'log-1' }),
      update: jest.fn().mockResolvedValue({}),
    },
    organization: { findFirst: jest.fn().mockResolvedValue({ id: 'org-1' }) },
    iotVendor: { findUnique: jest.fn().mockResolvedValue(null) },
    deviceEvent: { findUnique: jest.fn().mockResolvedValue(null) },
    device: { findFirst: jest.fn().mockResolvedValue(null) },
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
