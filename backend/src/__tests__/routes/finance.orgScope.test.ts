/**
 * Org-scoping checks for the finance and quote routes (#303).
 *
 * These plugins used to dispatch with `(req as any).orgId ?? ''` and look
 * records up by id alone, so one tenant could read, approve or pay another
 * tenant's invoices by guessing an id. The real plugins are registered against
 * org-aware mockStubs: a row is only returned when the lookup carries the org that
 * owns it. Requests run as org-a and reach for org-b's records.
 */

import Fastify from 'fastify';

type Row = { id: string; orgId: string; [key: string]: unknown };

function orgAwareFindById(rows: Row[]) {
  return jest.fn((id: string, orgId: string) =>
    Promise.resolve(rows.find((r) => r.id === id && r.orgId === orgId) ?? null),
  );
}

const invoiceRepo = {
  findById: orgAwareFindById([{ id: 'inv-a', orgId: 'org-a' }, { id: 'inv-b', orgId: 'org-b' }]),
  findAll: jest.fn().mockResolvedValue([]),
};
const carrierInvoiceRepo = {
  findById: orgAwareFindById([
    { id: 'cinv-a', orgId: 'org-a', totalCents: 1000 },
    { id: 'cinv-b', orgId: 'org-b', totalCents: 1000 },
  ]),
  findAll: jest.fn().mockResolvedValue([]),
  update: jest.fn().mockResolvedValue({ id: 'cinv-a' }),
};
const chargeRepo = {
  findById: orgAwareFindById([
    { id: 'chg-a', orgId: 'org-a', status: 'pending', shipmentId: null },
    { id: 'chg-b', orgId: 'org-b', status: 'pending', shipmentId: null },
  ]),
  delete: jest.fn(),
};
const queryRepo = {
  findById: orgAwareFindById([{ id: 'qry-a', orgId: 'org-a' }, { id: 'qry-b', orgId: 'org-b' }]),
  findAll: jest.fn().mockResolvedValue([]),
};
const creditNoteRepo = {
  findById: orgAwareFindById([{ id: 'cn-a', orgId: 'org-a' }, { id: 'cn-b', orgId: 'org-b' }]),
  findAll: jest.fn().mockResolvedValue([]),
};
const quoteRepo = {
  findById: orgAwareFindById([{ id: 'quote-a', orgId: 'org-a' }, { id: 'quote-b', orgId: 'org-b' }]),
  findAll: jest.fn().mockResolvedValue([]),
};
const laneRepo = {
  findByIdSimple: orgAwareFindById([{ id: 'lane-a', orgId: 'org-a', name: 'A', originId: 'o', destinationId: 'd' }]),
};
const customerRepo = {
  findById: orgAwareFindById([{ id: 'cust-a', orgId: 'org-a' }]),
};
const chargeService = {
  getCharges: jest.fn().mockResolvedValue([]),
  getShipmentFinancials: jest.fn((id: string, orgId: string) =>
    Promise.resolve(id === 'ship-a' && orgId === 'org-a' ? { shipmentId: id, charges: [] } : null),
  ),
  recalculateShipmentSummary: jest.fn(),
};
const ratingService = { calculateRate: jest.fn().mockResolvedValue({ totalCents: 0, details: [] }) };
// Handlers look entities up by { id, orgId }, so another tenant's id comes back as "not found".
const commandBus = {
  dispatch: jest.fn((cmd: any) => {
    const ids = Object.values(cmd.payload ?? {}).filter((v) => typeof v === 'string') as string[];
    const foreign = ids.some((v) => v.endsWith('-b'));
    return Promise.resolve(
      foreign ? { success: false, error: 'Record not found', events: [] } : { success: true, data: { id: 'ok' }, events: [] },
    );
  }),
};
const batchPrisma = {
  carrierInvoice: {
    findMany: jest.fn().mockResolvedValue([]),
    updateMany: jest.fn(),
  },
};

const mockStubs: Record<string, unknown> = {
  IInvoiceRepository: invoiceRepo,
  ICarrierInvoiceRepository: carrierInvoiceRepo,
  IChargeRepository: chargeRepo,
  IFinancialQueryRepository: queryRepo,
  ICreditNoteRepository: creditNoteRepo,
  IQuoteRepository: quoteRepo,
  ILanesRepository: laneRepo,
  ICustomersRepository: customerRepo,
  IChargeService: chargeService,
  IRatingService: ratingService,
  ICommandBus: commandBus,
  PrismaClient: batchPrisma,
  IInvoicingService: { findReadyToInvoice: jest.fn().mockResolvedValue([]) },
  ILtlRatingService: {},
};

jest.mock('../../di/index.js', () => ({
  container: { resolve: jest.fn((token: symbol) => mockStubs[token.description ?? '']) },
  TOKENS: new Proxy({}, { get: (_t, prop) => Symbol.for(String(prop)) }),
}));

import { invoiceRoutes } from '../../routes/invoices.js';
import { carrierInvoiceRoutes } from '../../routes/carrierInvoices.js';
import { chargeRoutes } from '../../routes/charges.js';
import { financialQueryRoutes } from '../../routes/financialQueries.js';
import { quoteRoutes } from '../../routes/quotes.js';

async function buildApp() {
  const app = Fastify();
  app.decorate('prisma', {
    customer: {
      findFirst: jest.fn(({ where }: any) =>
        Promise.resolve(where.id === 'cust-a' && where.orgId === 'org-a' ? { id: 'cust-a', name: 'A', creditLimitCents: null } : null),
      ),
    },
    invoice: { aggregate: jest.fn().mockResolvedValue({ _sum: { totalCents: 0 } }) },
  } as any);
  // Mirrors production, where the JWT drives the tenant. registerOrgScope's
  // hook is idempotent, so the value set here is the one the plugins see.
  app.addHook('preHandler', async (req) => {
    (req as any).orgId = 'org-a';
    (req as any).user = { sub: 'user-a', permissions: ['*'] };
  });
  await app.register(invoiceRoutes);
  await app.register(carrierInvoiceRoutes);
  await app.register(chargeRoutes);
  await app.register(financialQueryRoutes);
  await app.register(quoteRoutes);
  return app;
}

describe('Finance and quote routes: org scoping', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    jest.clearAllMocks();
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  const reads: Array<[string, string]> = [
    ['invoice', '/api/v1/invoices/inv-b'],
    ['carrier invoice', '/api/v1/carrier-invoices/cinv-b'],
    ['charge', '/api/v1/charges/chg-b'],
    ['financial query', '/api/v1/financial-queries/qry-b'],
    ['credit note', '/api/v1/credit-notes/cn-b'],
    ['quote', '/api/v1/quotes/quote-b'],
    ['shipment financials', '/api/v1/shipments/ship-b/financials'],
    ['customer credit status', '/api/v1/customers/cust-b/credit-status'],
  ];

  it.each(reads)('%s: another org\'s id reads as 404', async (_name, url) => {
    const res = await app.inject({ method: 'GET', url });
    expect(res.statusCode).toBe(404);
  });

  it.each(reads)('%s: the owning org can read its own record', async (_name, url) => {
    const res = await app.inject({ method: 'GET', url: url.replace('-b', '-a') });
    expect(res.statusCode).toBe(200);
  });

  it.each([
    ['invoices', '/api/v1/invoices', invoiceRepo.findAll],
    ['carrier invoices', '/api/v1/carrier-invoices', carrierInvoiceRepo.findAll],
    ['financial queries', '/api/v1/financial-queries', queryRepo.findAll],
    ['quotes', '/api/v1/quotes', quoteRepo.findAll],
    ['charges', '/api/v1/charges', chargeService.getCharges],
  ])('%s list is filtered by the caller org', async (_name, url, finder) => {
    const res = await app.inject({ method: 'GET', url });
    expect(res.statusCode).toBe(200);
    expect((finder as jest.Mock).mock.calls[0][0]).toMatchObject({ orgId: 'org-a' });
  });

  it('credit notes list is filtered by the caller org', async () => {
    await app.inject({ method: 'GET', url: '/api/v1/credit-notes' });
    expect(creditNoteRepo.findAll).toHaveBeenCalledWith('org-a');
  });

  const writes: Array<[string, string, Record<string, unknown>]> = [
    ['approve invoice', '/api/v1/invoices/inv-b/approve', {}],
    ['send invoice', '/api/v1/invoices/inv-b/send', {}],
    ['record payment', '/api/v1/invoices/inv-b/payments', { amountCents: 100 }],
    ['void invoice', '/api/v1/invoices/inv-b/void', {}],
    ['approve carrier invoice', '/api/v1/carrier-invoices/cinv-b/approve', {}],
    ['approve charge', '/api/v1/charges/chg-b/approve', {}],
    ['resolve financial query', '/api/v1/financial-queries/qry-b/resolve', { resolution: 'upheld', resolutionNotes: 'x' }],
    ['accept quote', '/api/v1/quotes/quote-b/accept', {}],
    ['decline quote', '/api/v1/quotes/quote-b/decline', {}],
  ];

  it.each(writes)('%s: dispatches under the caller org and maps a miss to 404', async (_name, url, payload) => {
    const res = await app.inject({ method: 'POST', url, payload });
    expect(res.statusCode).toBe(404);
    expect(commandBus.dispatch).toHaveBeenCalledTimes(1);
    expect(commandBus.dispatch.mock.calls[0][0].orgId).toBe('org-a');
  });

  it('quick pay on another org\'s carrier invoice is 404 and writes nothing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/carrier-invoices/cinv-b/quick-pay',
      payload: { discountPercent: 2, daysToPayment: 5 },
    });
    expect(res.statusCode).toBe(404);
    expect(carrierInvoiceRepo.update).not.toHaveBeenCalled();
  });

  it('deleting another org\'s charge is 404 and deletes nothing', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/api/v1/charges/chg-b' });
    expect(res.statusCode).toBe(404);
    expect(chargeRepo.delete).not.toHaveBeenCalled();
  });

  it('payment batch scheduling and execution only touch the caller org', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v1/carrier-invoices/payment-batches/schedule',
      payload: { carrierInvoiceIds: ['cinv-b'], scheduledPayDate: '2026-10-01' },
    });
    await app.inject({ method: 'POST', url: '/api/v1/carrier-invoices/payment-batches/execute', payload: {} });
    await app.inject({ method: 'GET', url: '/api/v1/carrier-invoices/payment-batches' });
    await app.inject({ method: 'GET', url: '/api/v1/carrier-invoices/payment-batches/scheduled' });

    const wheres = batchPrisma.carrierInvoice.findMany.mock.calls.map((c: any) => c[0].where);
    expect(wheres).toHaveLength(4);
    for (const where of wheres) expect(where.orgId).toBe('org-a');
  });

  it('quick quote on another org\'s lane is 404 and never prices it', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/quotes/quick',
      payload: { customerId: 'cust-a', laneId: 'lane-b' },
    });
    expect(res.statusCode).toBe(404);
    expect(ratingService.calculateRate).not.toHaveBeenCalled();
    expect(commandBus.dispatch).not.toHaveBeenCalled();
  });

  it('rate calculation is priced within the caller org', async () => {
    await app.inject({ method: 'POST', url: '/api/v1/rates/calculate', payload: { laneId: 'lane-b' } });
    expect(ratingService.calculateRate.mock.calls[0][0]).toBe('org-a');
  });
});
