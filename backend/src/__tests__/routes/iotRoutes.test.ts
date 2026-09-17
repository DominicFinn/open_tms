/**
 * Route-level checks for the device, telemetry and IoT vendor routes (#291).
 *
 * The real plugins, repositories and services run against an org-aware prisma mock, so these
 * cover the HTTP status mapping, the response serialisation (which must not strip included
 * relations) and the generated OpenAPI document.
 */

import Fastify from 'fastify';
import swagger from '@fastify/swagger';

const mockRegistry = new Map<string, unknown>();

jest.mock('../../di/index.js', () => ({
  container: { resolve: jest.fn((token: symbol) => mockRegistry.get(token.description!)) },
  TOKENS: new Proxy({}, { get: (_t, prop) => Symbol.for(String(prop)) }),
}));

import deviceRoutes from '../../routes/devices.js';
import telemetryRoutes from '../../routes/telemetry.js';
import { iotVendorRoutes } from '../../routes/iotVendors.js';
import { SensorReadingRepository } from '../../repositories/SensorReadingRepository.js';
import { DeviceRepository } from '../../repositories/DeviceRepository.js';
import { IotVendorRepository } from '../../repositories/IotVendorRepository.js';
import { TelemetryService } from '../../services/iot/TelemetryService.js';
import { IotVendorSettingsService } from '../../services/iot/IotVendorSettingsService.js';
import { DEVICE_NOT_FOUND } from '../../commands/devices/errors.js';

const eventTime = new Date('2026-09-10T12:00:00Z');

const readingRow = {
  id: 'r1', deviceId: 'dev-a', shipmentId: 'ship-a', orderId: null, eventTime,
  temperature: 4.5, batteryLevel: 80, atmosphericPressure: 1012, isAlert: false,
  device: { id: 'dev-a', name: 'Tracker A', displayId: 'HG-1', model: 'HGx' },
};

const deviceRow = {
  id: 'dev-a', orgId: 'org-a', externalId: 'EXT-A', name: 'Tracker A', provider: 'system_loco',
  status: 'active', createdAt: eventTime, updatedAt: eventTime,
  assignments: [{ id: 'asn-1', deviceId: 'dev-a', shipmentId: 'ship-a', active: true, assignedAt: eventTime, shipment: { id: 'ship-a', reference: 'SH-1', status: 'in_transit' } }],
  _count: { sensorReadings: 1, deviceEvents: 0 },
};

function ownedBy(rows: Record<string, string>) {
  return jest.fn().mockImplementation(({ where }: any) =>
    Promise.resolve(rows[where.id] === where.orgId ? { id: where.id } : null));
}

function buildPrisma() {
  return {
    shipment: { findFirst: ownedBy({ 'ship-a': 'org-a', 'ship-b': 'org-b' }) },
    order: { findFirst: ownedBy({ 'order-a': 'org-a' }) },
    device: {
      findFirst: jest.fn().mockImplementation(({ where, include }: any) => {
        if (where.id !== 'dev-a' || where.orgId !== 'org-a') return Promise.resolve(null);
        return Promise.resolve(include ? deviceRow : { id: 'dev-a' });
      }),
      findMany: jest.fn().mockResolvedValue([deviceRow]),
      count: jest.fn().mockResolvedValue(1),
    },
    sensorReading: {
      findMany: jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve(where.device?.orgId === 'org-b' ? [] : [readingRow])),
    },
    iotVendor: { findMany: jest.fn().mockResolvedValue([]) },
  } as any;
}

const commandBus = { dispatch: jest.fn() };

async function buildApp() {
  const prisma = buildPrisma();
  const readings = new SensorReadingRepository(prisma);
  mockRegistry.set('ICommandBus', commandBus);
  mockRegistry.set('IDeviceRepository', new DeviceRepository(prisma));
  mockRegistry.set('ISensorReadingRepository', readings);
  mockRegistry.set('ITelemetryService', new TelemetryService(readings));
  mockRegistry.set('IIotVendorSettingsService', new IotVendorSettingsService(new IotVendorRepository(prisma)));

  const app = Fastify();
  await app.register(swagger, { openapi: { info: { title: 'test', version: '0' } } });
  app.decorate('prisma', prisma);
  app.addHook('preHandler', async (req) => {
    (req as any).orgId = (req.headers['x-test-org'] as string) || 'org-a';
    (req as any).user = { sub: 'user-1', permissions: ['*'] };
  });
  await app.register(deviceRoutes);
  await app.register(telemetryRoutes);
  await app.register(iotVendorRoutes);
  await app.ready();
  return app;
}

describe('IoT routes', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    commandBus.dispatch.mockReset();
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('telemetry', () => {
    it('rejects an id that is not a uuid', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/shipments/not-a-uuid/telemetry' });
      expect(res.statusCode).toBe(400);
    });

    it('returns readings and a summary for a shipment in the org', async () => {
      const prisma = (app as any).prisma;
      prisma.shipment.findFirst.mockResolvedValueOnce({ id: 'ship-a' });
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/shipments/00000000-0000-4000-8000-00000000000a/telemetry?limit=50',
      });
      expect(res.statusCode).toBe(200);
      const { data } = res.json();
      expect(data.readings[0].device).toEqual({ id: 'dev-a', name: 'Tracker A', displayId: 'HG-1', model: 'HGx' });
      expect(data.readings[0].eventTime).toBe(eventTime.toISOString());
      expect(data.summary).toEqual({
        readingCount: 1, alertCount: 0,
        temperature: { min: 4.5, max: 4.5, avg: 4.5, latest: 4.5 },
        latestBattery: 80, latestPressure: 1012, devices: 1,
      });
      expect(prisma.sensorReading.findMany.mock.calls[0][0].take).toBe(50);
    });

    it('returns 404 for a shipment in another org', async () => {
      const id = '00000000-0000-4000-8000-00000000000b';
      const res = await app.inject({ method: 'GET', url: `/api/v1/shipments/${id}/telemetry` });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ data: null, error: 'Shipment not found' });
    });
  });

  describe('devices', () => {
    it('keeps included relations and counts in the list response', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/devices?limit=10' });
      expect(res.statusCode).toBe(200);
      expect(res.headers['x-total-count']).toBe('1');
      const body = res.json();
      expect(body.meta).toEqual({ total: 1, limit: 10, offset: 0 });
      expect(body.data[0].assignments[0].shipment).toEqual({ id: 'ship-a', reference: 'SH-1', status: 'in_transit' });
      expect(body.data[0]._count).toEqual({ sensorReadings: 1, deviceEvents: 0 });
    });

    it('returns 404 for a device outside the org', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/devices/00000000-0000-4000-8000-000000000001',
      });
      expect(res.statusCode).toBe(404);
    });

    it('rejects an unknown assignment purpose', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/devices/00000000-0000-4000-8000-000000000001/assign',
        payload: { purpose: 'surveillance' },
      });
      expect(res.statusCode).toBe(400);
      expect(commandBus.dispatch).not.toHaveBeenCalled();
    });

    it('maps a command error code onto its status', async () => {
      commandBus.dispatch.mockResolvedValue({ success: false, error: DEVICE_NOT_FOUND, events: [] });
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/devices/00000000-0000-4000-8000-000000000001/assign',
      });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ data: null, error: DEVICE_NOT_FOUND });
    });

    it('dispatches assign with the device id from the path and org from the request', async () => {
      commandBus.dispatch.mockResolvedValue({
        success: true,
        events: [],
        data: { id: 'asn-2', deviceId: 'dev-a', shipmentId: 'x', orderId: null, trackableUnitId: null, purpose: 'general', active: true, assignedAt: eventTime, unassignedAt: null },
      });
      const deviceId = '00000000-0000-4000-8000-000000000001';
      const shipmentId = '00000000-0000-4000-8000-000000000002';
      // Fastify strips body fields the schema doesn't list, so a deviceId in the body can't
      // redirect the command to a different device.
      const ok = await app.inject({
        method: 'POST',
        url: `/api/v1/devices/${deviceId}/assign`,
        payload: { shipmentId, purpose: 'general', deviceId: 'someone-elses-device', orgId: 'org-b' },
      });
      expect(ok.statusCode).toBe(201);
      expect(commandBus.dispatch).toHaveBeenCalledWith(expect.objectContaining({
        orgId: 'org-a',
        actorId: 'user-1',
        payload: { shipmentId, purpose: 'general', deviceId },
      }));
      expect(ok.json().data).toEqual(expect.objectContaining({ id: 'asn-2', purpose: 'general', active: true }));
    });
  });

  describe('IoT vendors', () => {
    it('lists the default vendor without writing', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/settings/iot-vendors' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        data: [{ vendorKey: 'system_loco', name: 'System Loco', enabled: true, hasWebhookSecret: false }],
        error: null,
      });
    });
  });

  describe('OpenAPI document', () => {
    it('documents every IoT endpoint with tags and response shapes', () => {
      const spec = app.swagger() as any;
      const expected: Array<[string, string]> = [
        ['/api/v1/devices', 'get'],
        ['/api/v1/devices', 'post'],
        ['/api/v1/devices/{id}', 'get'],
        ['/api/v1/devices/{id}', 'put'],
        ['/api/v1/devices/{id}/assign', 'post'],
        ['/api/v1/devices/{id}/assign', 'delete'],
        ['/api/v1/devices/{id}/readings', 'get'],
        ['/api/v1/shipments/{id}/telemetry', 'get'],
        ['/api/v1/orders/{id}/telemetry', 'get'],
        ['/api/v1/settings/iot-vendors', 'get'],
        ['/api/v1/settings/iot-vendors/{vendorKey}', 'put'],
      ];
      for (const [path, method] of expected) {
        const op = spec.paths[path]?.[method];
        expect({ path, method, tags: op?.tags?.length > 0 }).toEqual({ path, method, tags: true });
        expect(Object.keys(op.responses).length).toBeGreaterThan(0);
      }
      const summary = spec.paths['/api/v1/shipments/{id}/telemetry'].get
        .responses['200'].content['application/json'].schema.properties.data.properties.summary;
      expect(Object.keys(summary.properties)).toEqual(
        expect.arrayContaining(['readingCount', 'alertCount', 'temperature', 'devices']),
      );
    });
  });
});
