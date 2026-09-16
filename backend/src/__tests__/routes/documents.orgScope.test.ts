/**
 * Org scoping for generated documents and templates (#294).
 *
 * Documents and templates had no orgId, so any internal user could list, read, download or
 * delete another tenant's BOLs and rate confirmations, and generate documents from another
 * tenant's shipment. These tests register the real plugin with the real repositories over an
 * in-memory prisma whose finders honour orgId, then assert that org-a reaching for org-b's ids
 * gets a 404 and never touches the data.
 */

import Fastify from 'fastify';
import { GeneratedDocumentRepository } from '../../repositories/GeneratedDocumentRepository';
import { DocumentTemplateRepository } from '../../repositories/DocumentTemplateRepository';
import { DocumentSourceNotFoundError } from '../../services/DocumentGenerationService';

type Row = Record<string, any>;

const DOC_A = 'aaaaaaaa-0000-4000-8000-000000000001';
const DOC_B = 'bbbbbbbb-0000-4000-8000-000000000001';
const TPL_A = 'aaaaaaaa-0000-4000-8000-000000000002';
const TPL_B = 'bbbbbbbb-0000-4000-8000-000000000002';
const CORR_A = 'aaaaaaaa-0000-4000-8000-000000000003';
const CORR_B = 'bbbbbbbb-0000-4000-8000-000000000003';

function matches(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (value === undefined) return true;
    if (key === 'metadata') return row.metadata?.[value.path[0]] === value.equals;
    if (value && typeof value === 'object' && 'not' in value) return row[key] !== value.not;
    return row[key] === value;
  });
}

function table(rows: Row[]) {
  return {
    rows,
    findFirst: jest.fn(async ({ where }: any) => rows.find((r) => matches(r, where)) ?? null),
    findMany: jest.fn(async ({ where }: any) => rows.filter((r) => matches(r, where))),
    updateMany: jest.fn(async ({ where, data }: any) => {
      const hit = rows.filter((r) => matches(r, where));
      hit.forEach((r) => Object.assign(r, data));
      return { count: hit.length };
    }),
    update: jest.fn(async ({ where, data }: any) => Object.assign(rows.find((r) => r.id === where.id)!, data)),
    deleteMany: jest.fn(async ({ where }: any) => {
      const hit = rows.filter((r) => matches(r, where));
      hit.forEach((r) => rows.splice(rows.indexOf(r), 1));
      return { count: hit.length };
    }),
    create: jest.fn(async ({ data }: any) => {
      const row = { id: `new-${rows.length}`, ...data };
      rows.push(row);
      return row;
    }),
  };
}

const readyCargo = [{ order: { lineItems: [{ description: 'Pallet', quantity: 1, weight: 100 }] } }];

function buildPrisma() {
  return {
    generatedDocument: table([
      { id: DOC_A, orgId: 'org-a', shipmentId: 'ship-a', documentType: 'bol', fileName: 'a.pdf', mimeType: 'application/pdf', fileContent: Buffer.from('A'), storageKey: null, metadata: { correlationId: CORR_A } },
      { id: DOC_B, orgId: 'org-b', shipmentId: 'ship-b', documentType: 'bol', fileName: 'b.pdf', mimeType: 'application/pdf', fileContent: Buffer.from('B'), storageKey: null, metadata: { correlationId: CORR_B } },
    ]),
    documentTemplate: table([
      { id: TPL_A, orgId: 'org-a', documentType: 'bol', name: 'A BOL', isDefault: true, active: true },
      { id: TPL_B, orgId: 'org-b', documentType: 'bol', name: 'B BOL', isDefault: true, active: true },
    ]),
    shipment: table([
      { id: 'ship-a', orgId: 'org-a', originId: 'l1', destinationId: 'l2', orderShipments: readyCargo },
      { id: 'ship-b', orgId: 'org-b', originId: 'l3', destinationId: 'l4', orderShipments: readyCargo },
    ]),
  };
}

// Stands in for DocumentGenerationService, honouring the same contract: a source outside the
// caller's org throws DocumentSourceNotFoundError. The service's own lookups are covered below.
function buildDocService(prisma: ReturnType<typeof buildPrisma>) {
  const generate = jest.fn(async (orgId: string, shipmentId: string) => {
    if (!prisma.shipment.rows.some((s) => s.id === shipmentId && s.orgId === orgId)) {
      throw new DocumentSourceNotFoundError('Shipment');
    }
    return { id: 'doc-new', fileName: 'new.pdf' };
  });
  return {
    generateBOL: generate,
    generateCustomsForm: generate,
    generateRateConfirmation: generate,
    generateLabels: jest.fn(async () => { throw new DocumentSourceNotFoundError('Order'); }),
  };
}

let services: Record<string, unknown> = {};

jest.mock('../../di/container.js', () => ({
  container: { resolve: jest.fn((token: symbol) => services[Symbol.keyFor(token)!]) },
}));
jest.mock('../../di/tokens.js', () => ({
  TOKENS: new Proxy({}, { get: (_t, prop) => Symbol.for(String(prop)) }),
}));

import { documentRoutes } from '../../routes/documents';

const SHIP_B = 'ship-b';

async function buildApp() {
  const prisma = buildPrisma();
  const docService = buildDocService(prisma);
  const queue = { publish: jest.fn().mockResolvedValue('job-1') };
  const storage = { retrieve: jest.fn(), delete: jest.fn() };
  services = {
    PrismaClient: prisma,
    IGeneratedDocumentRepository: new GeneratedDocumentRepository(prisma as any),
    IDocumentTemplateRepository: new DocumentTemplateRepository(prisma as any),
    IDocumentGenerationService: docService,
    IBinaryStorageProvider: storage,
    IQueueAdapter: queue,
  };

  const app = Fastify();
  app.decorate('prisma', prisma as any);
  app.addHook('preHandler', async (req) => {
    (req as any).user = { sub: 'u-a', organizationId: 'org-a', roles: ['x'], permissions: ['*'] };
  });
  await app.register(documentRoutes);
  return { app, prisma, docService, queue };
}

describe('document routes are scoped to the caller org (#294)', () => {
  let ctx: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => { ctx = await buildApp(); });
  afterEach(async () => { await ctx.app.close(); });

  it('lists only the caller org documents, even with no filters', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/api/v1/documents' });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.map((d: Row) => d.id)).toEqual([DOC_A]);
  });

  it.each([
    ['get', 'GET', `/api/v1/documents/${DOC_B}`],
    ['download', 'GET', `/api/v1/documents/${DOC_B}/download`],
    ['delete', 'DELETE', `/api/v1/documents/${DOC_B}`],
    ['template get', 'GET', `/api/v1/document-templates/${TPL_B}`],
    ['template update', 'PUT', `/api/v1/document-templates/${TPL_B}`],
    ['template delete', 'DELETE', `/api/v1/document-templates/${TPL_B}`],
  ])('%s of another org id returns 404', async (_name, method, url) => {
    const res = await ctx.app.inject({ method: method as any, url, payload: method === 'PUT' ? { name: 'Hijacked' } : undefined });
    expect(res.statusCode).toBe(404);
  });

  it('leaves the other org document and template untouched', async () => {
    await ctx.app.inject({ method: 'DELETE', url: `/api/v1/documents/${DOC_B}` });
    await ctx.app.inject({ method: 'PUT', url: `/api/v1/document-templates/${TPL_B}`, payload: { name: 'Hijacked' } });
    await ctx.app.inject({ method: 'DELETE', url: `/api/v1/document-templates/${TPL_B}` });
    expect(ctx.prisma.generatedDocument.rows.find((d) => d.id === DOC_B)).toBeDefined();
    expect(ctx.prisma.documentTemplate.rows.find((t) => t.id === TPL_B)).toMatchObject({ name: 'B BOL' });
  });

  it('the owning org can read, download and delete its own document', async () => {
    expect((await ctx.app.inject({ method: 'GET', url: `/api/v1/documents/${DOC_A}` })).statusCode).toBe(200);
    expect((await ctx.app.inject({ method: 'GET', url: `/api/v1/documents/${DOC_A}/download` })).body).toBe('A');
    expect((await ctx.app.inject({ method: 'DELETE', url: `/api/v1/documents/${DOC_A}` })).statusCode).toBe(200);
  });

  it('lists only the caller org templates, and a new default never unsets another org default', async () => {
    const list = await ctx.app.inject({ method: 'GET', url: '/api/v1/document-templates' });
    expect(list.json().data.map((t: Row) => t.id)).toEqual([TPL_A]);

    const created = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/document-templates',
      payload: { name: 'New BOL', documentType: 'bol', htmlTemplate: '<p/>', isDefault: true },
    });
    expect(created.statusCode).toBe(201);
    expect(ctx.prisma.documentTemplate.rows.find((t) => t.name === 'New BOL')).toMatchObject({ orgId: 'org-a', isDefault: true });
    expect(ctx.prisma.documentTemplate.rows.find((t) => t.id === TPL_A)!.isDefault).toBe(false);
    expect(ctx.prisma.documentTemplate.rows.find((t) => t.id === TPL_B)!.isDefault).toBe(true);
  });

  it('job status never returns another org document by correlation id', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: `/api/v1/documents/jobs/${CORR_B}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toEqual({ status: 'pending', document: null });
    expect(res.body).not.toContain(DOC_B);
  });
});

// The routes validate shipment ids as uuids, so the generate and readiness cases use a uuid
// owned by org-b.
describe('document generation refuses another org shipment (#294)', () => {
  const B_UUID = '22222222-2222-2222-2222-222222222222';
  let ctx: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    ctx = await buildApp();
    ctx.prisma.shipment.rows.find((s) => s.id === SHIP_B)!.id = B_UUID;
  });
  afterEach(async () => { await ctx.app.close(); });

  it('readiness for another org shipment returns 404', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: `/api/v1/documents/bol-readiness/${B_UUID}` });
    expect(res.statusCode).toBe(404);
  });

  it.each([
    ['BOL', '/api/v1/documents/generate/bol'],
    ['customs form', '/api/v1/documents/generate/customs'],
    ['rate confirmation', '/api/v1/documents/rate-confirmation'],
  ])('sync %s for another org shipment returns 404', async (_name, url) => {
    const res = await ctx.app.inject({ method: 'POST', url, payload: { shipmentId: B_UUID } });
    expect(res.statusCode).toBe(404);
  });

  it('sync labels for another org order returns 404', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/documents/generate/labels',
      payload: { orderId: '33333333-3333-3333-3333-333333333333' },
    });
    expect(res.statusCode).toBe(404);
  });

  it.each([
    ['BOL', '/api/v1/documents/generate/bol/async'],
    ['customs form', '/api/v1/documents/generate/customs/async'],
  ])('async %s for another org shipment returns 404 and queues nothing', async (_name, url) => {
    const res = await ctx.app.inject({ method: 'POST', url, payload: { shipmentId: B_UUID } });
    expect(res.statusCode).toBe(404);
    expect(ctx.queue.publish).not.toHaveBeenCalled();
  });

  it('async jobs carry the caller org, not one from the request', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/documents/rate-confirmation/async',
      payload: { shipmentId: B_UUID, orgId: 'org-b' },
    });
    expect(res.statusCode).toBe(202);
    expect(ctx.queue.publish.mock.calls[0][1].payload ?? ctx.queue.publish.mock.calls[0][1])
      .toMatchObject({ orgId: 'org-a' });
  });
});

describe('DocumentGenerationService looks sources up within the caller org (#294)', () => {
  const { DocumentGenerationService } = jest.requireActual('../../services/DocumentGenerationService');

  function service() {
    const prisma = {
      shipment: { findFirst: jest.fn(async ({ where }: any) => (where.orgId === 'org-b' ? { id: where.id } : null)) },
      order: { findFirst: jest.fn(async ({ where }: any) => (where.orgId === 'org-b' ? { id: where.id } : null)) },
      organization: { findUnique: jest.fn(), update: jest.fn() },
    };
    const docRepo = { create: jest.fn() };
    const svc = new DocumentGenerationService(prisma, { findById: jest.fn(), findDefault: jest.fn() }, docRepo);
    return { svc, prisma, docRepo };
  }

  it.each(['generateBOL', 'generateCustomsForm', 'generateRateConfirmation', 'generateLabels'])(
    '%s throws DocumentSourceNotFoundError for another org id and writes nothing',
    async (method) => {
      const { svc, prisma, docRepo } = service();
      await expect(svc[method]('org-a', 'owned-by-b')).rejects.toBeInstanceOf(DocumentSourceNotFoundError);
      expect(prisma.organization.update).not.toHaveBeenCalled();
      expect(docRepo.create).not.toHaveBeenCalled();
    },
  );
});

describe('customer portal document reads are scoped to the customer org (#294)', () => {
  it('a customer id from another org finds nothing', async () => {
    const prisma = buildPrisma();
    prisma.generatedDocument.rows.forEach((d) => { d.customerId = 'cust-b'; });
    prisma.generatedDocument.rows[0].orgId = 'org-b';
    const repo = new GeneratedDocumentRepository(prisma as any);

    expect((await repo.findForCustomer('org-a', 'cust-b', 100))).toHaveLength(0);
    expect(await repo.findByIdForCustomer('org-a', 'cust-b', DOC_A)).toBeNull();
    expect((await repo.findForCustomer('org-b', 'cust-b', 100)).length).toBe(2);
  });
});
