/**
 * Cross-tenant checks for the WMS and inventory routes (#303).
 *
 * These plugins used to read `(req as any).orgId || 'default-org'` and look rows up by bare id, so
 * one tenant could read or change another tenant's stock, UOMs, cartons, pack audits, manifests,
 * zones and bins by guessing an id. The prisma mock below behaves like the database would once
 * the lookup is scoped: a row comes back only when the where clause names its id and its orgId.
 * Every request is made as org-a against org-b ids, and must read as 404 without writing or
 * dispatching anything.
 */

import Fastify from 'fastify';

const mockDeps: { prisma: any; bus: any; zoneRepo: any } = { prisma: null, bus: null, zoneRepo: null };

jest.mock('../../di/index.js', () => ({
  container: {
    resolve: jest.fn((token: symbol) => {
      const name = Symbol.keyFor(token);
      if (name === 'PrismaClient') return mockDeps.prisma;
      if (name === 'ICommandBus') return mockDeps.bus;
      if (name === 'IWarehouseZoneRepository') return mockDeps.zoneRepo;
      throw new Error(`unexpected token ${name}`);
    }),
  },
  TOKENS: new Proxy({}, { get: (_t, prop) => Symbol.for(String(prop)) }),
}));

import { inventoryRoutes } from '../../routes/inventory.js';
import { productUomRoutes } from '../../routes/productUom.js';
import { cartonCatalogueRoutes } from '../../routes/cartonCatalogue.js';
import { packAuditRoutes } from '../../routes/packAudit.js';
import { manifestIngestionRoutes } from '../../routes/manifestIngestion.js';
import { warehouseZoneRoutes } from '../../routes/warehouseZones.js';

const ORG_A = 'org-a';
const ORG_B = 'org-b';

// Rows owned by org-b, which the org-a caller must never reach.
const B = {
  inventory: '00000000-0000-4000-8000-0000000000b1',
  bin: '00000000-0000-4000-8000-0000000000b2',
  zone: '00000000-0000-4000-8000-0000000000b3',
  packTask: '00000000-0000-4000-8000-0000000000b4',
  carton: '00000000-0000-4000-8000-0000000000b5',
  uom: 'uom-b',
  packAudit: 'pa-b',
  template: 'mt-b',
  upload: 'mu-b',
};
const A = {
  inventory: '00000000-0000-4000-8000-0000000000a1',
  packTask: '00000000-0000-4000-8000-0000000000a4',
};

function orgAwareModel(rows: Array<{ id: string; orgId: string }>) {
  const find = jest.fn(({ where }: any) =>
    Promise.resolve(rows.find((r) => r.id === where.id && r.orgId === where.orgId) ?? null));
  return {
    findFirst: find,
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    groupBy: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
}

function buildPrisma() {
  return {
    inventoryRecord: orgAwareModel([{ id: B.inventory, orgId: ORG_B }, { id: A.inventory, orgId: ORG_A }]),
    inventoryTransaction: orgAwareModel([]),
    warehouseBin: orgAwareModel([{ id: B.bin, orgId: ORG_B }]),
    productUom: orgAwareModel([{ id: B.uom, orgId: ORG_B }]),
    cartonCatalogue: orgAwareModel([{ id: B.carton, orgId: ORG_B }]),
    packAudit: orgAwareModel([{ id: B.packAudit, orgId: ORG_B }]),
    packTask: {
      ...orgAwareModel([{ id: B.packTask, orgId: ORG_B }, { id: A.packTask, orgId: ORG_A }]),
    },
    manifestTemplate: orgAwareModel([{ id: B.template, orgId: ORG_B }]),
    manifestUpload: orgAwareModel([{ id: B.upload, orgId: ORG_B }]),
    organization: { findMany: jest.fn().mockResolvedValue([]) },
  } as any;
}

function buildZoneRepo() {
  const zones = [{ id: B.zone, orgId: ORG_B }];
  const bins = [{ id: B.bin, orgId: ORG_B }];
  return {
    findZoneById: jest.fn((orgId: string, id: string) =>
      Promise.resolve(zones.find((z) => z.id === id && z.orgId === orgId) ?? null)),
    findBinById: jest.fn((orgId: string, id: string) =>
      Promise.resolve(bins.find((b) => b.id === id && b.orgId === orgId) ?? null)),
  };
}

async function buildApp() {
  mockDeps.prisma = buildPrisma();
  mockDeps.zoneRepo = buildZoneRepo();
  mockDeps.bus = { dispatch: jest.fn().mockResolvedValue({ success: true, data: { id: 'x' }, events: [] }) };

  const app = Fastify();
  app.decorate('prisma', mockDeps.prisma);
  // Stand in for authenticateJWT and the strict org scope that index.ts applies.
  app.addHook('onRequest', async (req) => {
    (req as any).user = { sub: 'user-a', permissions: ['*'], organizationId: ORG_A };
    (req as any).orgId = ORG_A;
  });
  for (const plugin of [inventoryRoutes, productUomRoutes, cartonCatalogueRoutes, packAuditRoutes,
    manifestIngestionRoutes, warehouseZoneRoutes]) {
    await app.register(plugin);
  }
  return app;
}

describe('WMS and inventory routes: cross-tenant ids read as 404 (#303)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  const cases: Array<[string, { method: any; url: string; payload?: any }]> = [
    ['inventory detail', { method: 'GET', url: `/api/v1/inventory/${B.inventory}` }],
    ['inventory adjust', {
      method: 'POST', url: `/api/v1/inventory/${B.inventory}/adjust`,
      payload: { quantityChange: 1, reasonCode: 'found' },
    }],
    ['inventory transfer from a foreign record', {
      method: 'POST', url: `/api/v1/inventory/${B.inventory}/transfer`,
      payload: { targetBinId: B.bin, quantity: 1 },
    }],
    ['inventory transfer into a foreign bin', {
      method: 'POST', url: `/api/v1/inventory/${A.inventory}/transfer`,
      payload: { targetBinId: B.bin, quantity: 1 },
    }],
    ['product UOM detail', { method: 'GET', url: `/api/v1/product-uom/${B.uom}` }],
    ['product UOM update', { method: 'PUT', url: `/api/v1/product-uom/${B.uom}`, payload: { weightGrams: 1 } }],
    ['product UOM delete', { method: 'DELETE', url: `/api/v1/product-uom/${B.uom}` }],
    ['carton update', { method: 'PUT', url: `/api/v1/carton-catalogue/${B.carton}`, payload: { name: 'x' } }],
    ['carton delete', { method: 'DELETE', url: `/api/v1/carton-catalogue/${B.carton}` }],
    ['pack audit detail', { method: 'GET', url: `/api/v1/pack-audits/${B.packAudit}` }],
    ['pack audit record against a foreign pack task', {
      method: 'POST', url: '/api/v1/pack-audits',
      payload: { packTaskId: B.packTask, actualWeightGrams: 100 },
    }],
    ['pack audit record with a foreign carton', {
      method: 'POST', url: '/api/v1/pack-audits',
      payload: { packTaskId: A.packTask, cartonCatalogueId: B.carton, actualWeightGrams: 100 },
    }],
    ['pack audit context', { method: 'GET', url: `/api/v1/warehouse/pack-tasks/${B.packTask}/audit-context` }],
    ['manifest template delete', { method: 'DELETE', url: `/api/v1/manifest/templates/${B.template}` }],
    ['manifest process', {
      method: 'POST', url: `/api/v1/manifest/${B.upload}/process`,
      payload: { columnMapping: { sku: 'SKU', quantity: 'QTY' }, csvContent: 'SKU,QTY\nA,1' },
    }],
    ['zone update', { method: 'PUT', url: `/api/v1/warehouse/zones/${B.zone}`, payload: { name: 'x' } }],
    ['bin create in a foreign zone', {
      method: 'POST', url: '/api/v1/warehouse/bins',
      payload: { zoneId: B.zone, facilityId: B.zone, label: 'X-1', binType: 'pallet' },
    }],
    ['bin update', { method: 'PUT', url: `/api/v1/warehouse/bins/${B.bin}`, payload: { label: 'x' } }],
    ['bulk bin create in a foreign zone', {
      method: 'POST', url: '/api/v1/warehouse/bins/bulk',
      payload: {
        zoneId: B.zone, facilityId: B.zone, labelPattern: 'B-{aisle}-{row}-{level}', binType: 'pallet',
        aisles: ['A'], rowStart: 1, rowEnd: 1, levelStart: 1, levelEnd: 1,
      },
    }],
  ];

  it.each(cases)('%s', async (_name, request) => {
    const res = await app.inject(request);

    expect(res.statusCode).toBe(404);
    expect(mockDeps.bus.dispatch).not.toHaveBeenCalled();
    for (const model of Object.values(mockDeps.prisma) as any[]) {
      for (const write of ['create', 'update', 'delete']) {
        if (model[write]) expect(model[write]).not.toHaveBeenCalled();
      }
    }
  });

  it('inventory lists, summary and ledger filter by the caller org', async () => {
    const loc = '00000000-0000-4000-8000-00000000000c';
    await app.inject({ method: 'GET', url: `/api/v1/inventory?locationId=${loc}` });
    await app.inject({ method: 'GET', url: `/api/v1/inventory/summary?locationId=${loc}` });
    await app.inject({ method: 'GET', url: `/api/v1/inventory/transactions?locationId=${loc}` });

    const { inventoryRecord, inventoryTransaction } = mockDeps.prisma;
    expect(inventoryRecord.findMany.mock.calls[0][0].where.orgId).toBe(ORG_A);
    expect(inventoryRecord.groupBy.mock.calls[0][0].where.orgId).toBe(ORG_A);
    expect(inventoryTransaction.findMany.mock.calls[0][0].where.orgId).toBe(ORG_A);
  });

  it('dispatches writes with the caller org and the authenticated actor', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/pack-audits',
      payload: { packTaskId: A.packTask, actualWeightGrams: 100 },
    });

    expect(res.statusCode).toBe(200);
    expect(mockDeps.bus.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: ORG_A, actorId: 'user-a' }),
    );
  });
});
