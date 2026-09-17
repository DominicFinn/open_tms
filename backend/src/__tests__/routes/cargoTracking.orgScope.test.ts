/**
 * Org-scoping checks for the cargo tracking routes (#295).
 *
 * The routes used to pass ids straight to the repository with no org filter, so any tenant could
 * read another's manifest, scans and discrepancies, and write scans against another's shipment.
 * These tests run the real plugin and the real CargoTrackingRepository over a mocked prisma whose
 * finders only return a row when the where clause carries its orgId, then inject requests as org-a
 * against org-b's ids.
 */

import Fastify from 'fastify';
import { CargoTrackingRepository } from '../../repositories/CargoTrackingRepository.js';

const mockDispatch = jest.fn();
let mockRepo: CargoTrackingRepository;

jest.mock('../../di/index.js', () => ({
  container: {
    resolve: jest.fn((token: symbol) =>
      token === Symbol.for('ICargoTrackingRepository') ? mockRepo : { dispatch: mockDispatch },
    ),
  },
  TOKENS: new Proxy({}, { get: (_t, prop) => Symbol.for(String(prop)) }),
}));

import { cargoTrackingRoutes } from '../../routes/cargoTracking.js';

const ids = {
  a: { ship: '00000000-0000-4000-8000-00000000000a', stop: '00000000-0000-4000-8000-0000000000a1', disc: '00000000-0000-4000-8000-0000000000ad', unit: '00000000-0000-4000-8000-0000000000af' },
  b: { ship: '00000000-0000-4000-8000-00000000000b', stop: '00000000-0000-4000-8000-0000000000b1', disc: '00000000-0000-4000-8000-0000000000bd', unit: '00000000-0000-4000-8000-0000000000bf' },
};

const orgOf = (where: any) => where.orgId ?? where.shipment?.orgId;

function table(rows: Array<Record<string, any>>) {
  const matches = (where: any) => (r: Record<string, any>) =>
    Object.entries(where).every(([k, v]) => {
      if (k === 'shipment') return r.orgId === (v as any).orgId;
      if (k === 'status') return (v as any).in.includes(r.status);
      return r[k] === v;
    });
  return {
    findFirst: jest.fn(({ where }: any) => Promise.resolve(orgOf(where) ? rows.find(matches(where)) ?? null : null)),
    findMany: jest.fn(({ where }: any) => Promise.resolve(rows.filter(matches(where)))),
  };
}

function buildPrisma() {
  const stops = (['a', 'b'] as const).map((o) => ({
    id: ids[o].stop, orgId: `org-${o}`, shipmentId: ids[o].ship, sequenceNumber: 1, stopType: 'delivery', status: 'pending',
    location: { name: `Depot ${o}` }, orders: [], cargoScans: [], discrepanciesExpected: [],
  }));
  return {
    shipment: table([{ id: ids.a.ship, orgId: 'org-a' }, { id: ids.b.ship, orgId: 'org-b' }]),
    shipmentStop: {
      findFirst: table(stops).findFirst,
      // The manifest query filters by shipmentId only, after the shipment has been scoped.
      findMany: jest.fn(({ where }: any) => Promise.resolve(stops.filter((s) => s.shipmentId === where.shipmentId))),
    },
    orderShipment: { findMany: jest.fn().mockResolvedValue([]) },
    cargoScan: table([
      { id: 'scan-a', orgId: 'org-a', shipmentId: ids.a.ship, shipmentStopId: ids.a.stop },
      { id: 'scan-b', orgId: 'org-b', shipmentId: ids.b.ship, shipmentStopId: ids.b.stop },
    ]),
    cargoDiscrepancy: table([
      { id: ids.a.disc, orgId: 'org-a', shipmentId: ids.a.ship, status: 'open' },
      { id: ids.b.disc, orgId: 'org-b', shipmentId: ids.b.ship, status: 'open' },
    ]),
  } as any;
}

async function buildApp() {
  const prisma = buildPrisma();
  mockRepo = new CargoTrackingRepository(prisma);
  const app = Fastify();
  app.decorate('prisma', prisma);
  // Stands in for the JWT: registerOrgScope's hook skips when req.orgId is already set.
  app.addHook('preHandler', async (req) => {
    (req as any).orgId = 'org-a';
    (req as any).user = { sub: 'user-a' };
  });
  await app.register(cargoTrackingRoutes);
  return app;
}

// Every row has four items, even with no body: jest.each reads a shorter row as a `done` callback.
type Case = [name: string, method: 'GET' | 'POST' | 'PATCH', url: (o: 'a' | 'b') => string, body: ((o: 'a' | 'b') => object) | undefined];

const reads: Case[] = [
  ['cargo manifest', 'GET', (o) => `/api/v1/shipments/${ids[o].ship}/cargo-manifest`, undefined],
  ['shipment scans', 'GET', (o) => `/api/v1/shipments/${ids[o].ship}/cargo-scans`, undefined],
  ['stop scans', 'GET', (o) => `/api/v1/shipment-stops/${ids[o].stop}/cargo-scans`, undefined],
  ['shipment discrepancies', 'GET', (o) => `/api/v1/shipments/${ids[o].ship}/cargo-discrepancies`, undefined],
  ['discrepancy detail', 'GET', (o) => `/api/v1/cargo-discrepancies/${ids[o].disc}`, undefined],
];

const writes: Case[] = [
  ['record scan', 'POST', () => '/api/v1/cargo-scans', (o) => ({
    shipmentId: ids[o].ship, shipmentStopId: ids[o].stop, trackableUnitId: ids[o].unit, scanType: 'load', scanMethod: 'barcode',
  })],
  ['update discrepancy', 'PATCH', (o) => `/api/v1/cargo-discrepancies/${ids[o].disc}`, () => ({ status: 'resolved' })],
  ['reconcile stop', 'POST', (o) => `/api/v1/shipment-stops/${ids[o].stop}/reconcile-cargo`, undefined],
  ['check left on vehicle', 'POST', (o) => `/api/v1/shipments/${ids[o].ship}/check-left-on-vehicle`, undefined],
];

describe('Cargo tracking org scoping', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    mockDispatch.mockReset().mockResolvedValue({ success: true, data: { ok: true }, events: [] });
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  const inject = (method: string, url: string, body?: object) =>
    app.inject({ method: method as any, url, ...(body ? { payload: body } : {}) });

  it.each(reads)('%s: another org\'s id reads as 404', async (_n, method, url) => {
    const res = await inject(method, url('b'));
    expect(res.statusCode).toBe(404);
  });

  it.each(reads)('%s: the owning org can read its own', async (_n, method, url) => {
    const res = await inject(method, url('a'));
    expect(res.statusCode).toBe(200);
    expect(JSON.stringify(res.json())).not.toContain('org-b');
  });

  it('open discrepancy list only holds the caller\'s rows', async () => {
    const res = await inject('GET', '/api/v1/cargo-discrepancies');
    expect(res.statusCode).toBe(200);
    expect(res.json().data.map((d: any) => d.id)).toEqual([ids.a.disc]);
  });

  it.each(writes)('%s: another org\'s id is 404 and nothing is dispatched', async (_n, method, url, body) => {
    const res = await inject(method, url('b'), body?.('b'));
    expect(res.statusCode).toBe(404);
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it.each(writes)('%s: the owning org dispatches under its own org and actor', async (_n, method, url, body) => {
    const res = await inject(method, url('a'), body?.('a'));
    expect(res.statusCode).toBeLessThan(300);
    expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'org-a', actorId: 'user-a' }));
  });

  it('a scan naming org-a\'s shipment with org-b\'s stop is 404', async () => {
    const res = await inject('POST', '/api/v1/cargo-scans', {
      shipmentId: ids.a.ship, shipmentStopId: ids.b.stop, trackableUnitId: ids.a.unit, scanType: 'load', scanMethod: 'barcode',
    });
    expect(res.statusCode).toBe(404);
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('a failed command is a 422, not a 200', async () => {
    mockDispatch.mockResolvedValue({ success: false, error: 'Trackable unit not found', events: [] });
    const res = await inject('POST', '/api/v1/cargo-scans', writes[0][3]!('a'));
    expect(res.statusCode).toBe(422);
    expect(res.json()).toEqual({ data: null, error: 'Trackable unit not found' });
  });
});
