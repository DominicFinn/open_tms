/**
 * Org-scoping spot checks for the Quality Centre routes (#132).
 *
 * The route plugin previously resolved its org via
 * `prisma.organization.findFirst()`, which silently picks the first org
 * for every caller. These tests register the real plugin against a
 * mocked prisma whose finders behave org-aware (a row is only returned
 * when the where clause carries the matching orgId), then inject
 * requests as org-a and org-b and assert cross-tenant ids read as 404.
 */

import Fastify from 'fastify';

jest.mock('../../di/index.js', () => {
  const stub = {
    dispatch: jest.fn().mockResolvedValue({ id: 'result-1' }),
    findByEntity: jest.fn().mockResolvedValue([]),
    save: jest.fn(),
    create: jest.fn(),
  };
  return {
    container: { resolve: jest.fn(() => stub) },
    TOKENS: new Proxy({}, { get: (_t, prop) => Symbol.for(String(prop)) }),
  };
});

import { qualityCentreRoutes } from '../../routes/qualityCentre.js';

// Org-aware finder: mimics the DB by returning a row only when the where
// clause's orgId (direct or via the audit relation) matches the row.
function orgAwareFindFirst(rows: Array<Record<string, any>>) {
  return jest.fn().mockImplementation(({ where }: any) =>
    Promise.resolve(
      rows.find((r) =>
        (!where.id || r.id === where.id) &&
        (!where.orgId || r.orgId === where.orgId) &&
        (!where.audit?.orgId || r.auditOrgId === where.audit.orgId),
      ) ?? null,
    ),
  );
}

function buildPrisma() {
  return {
    cAPAFollowUp: {
      findFirst: orgAwareFindFirst([
        { id: 'fu-a', orgId: 'org-a', reviewType: 'day_30' },
        { id: 'fu-b', orgId: 'org-b', reviewType: 'day_60' },
      ]),
    },
    sOPChecklist: {
      findFirst: orgAwareFindFirst([
        { id: 'cl-a', orgId: 'org-a', title: 'GDP Annual Review' },
        { id: 'cl-b', orgId: 'org-b', title: 'Cold Chain SOP Check' },
      ]),
    },
    sOPAudit: {
      findFirst: orgAwareFindFirst([
        { id: 'audit-a', orgId: 'org-a', status: 'in_progress' },
        { id: 'audit-b', orgId: 'org-b', status: 'in_progress' },
      ]),
    },
    sOPAuditResponse: {
      findFirst: orgAwareFindFirst([
        { id: 'resp-a', auditOrgId: 'org-a', result: 'pass' },
        { id: 'resp-b', auditOrgId: 'org-b', result: 'pass' },
      ]),
      update: jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve({ id: where.id, result: 'pass' }),
      ),
    },
  } as any;
}

async function buildApp() {
  const app = Fastify();
  app.decorate('prisma', buildPrisma());
  // Simulate the authenticated principal's tenant. registerOrgScope's
  // hook is idempotent (skips when req.orgId is already set), so setting
  // it here mirrors production where the JWT drives the value.
  app.addHook('preHandler', async (req) => {
    (req as any).orgId = (req.headers['x-test-org'] as string) || 'org-a';
  });
  await app.register(qualityCentreRoutes);
  return app;
}

describe('Quality Centre org scoping', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  const crossTenantCases: Array<[string, string]> = [
    ['CAPA follow-up detail', '/api/v1/quality/capa-follow-ups/fu-b'],
    ['SOP checklist detail', '/api/v1/quality/sop-checklists/cl-b'],
    ['SOP audit detail', '/api/v1/quality/sop-audits/audit-b'],
    ['SOP audit evidence list', '/api/v1/quality/sop-audits/audit-b/evidence'],
  ];

  it.each(crossTenantCases)(
    '%s: org-a guessing an org-b id gets 404',
    async (_name, url) => {
      const res = await app.inject({ method: 'GET', url, headers: { 'x-test-org': 'org-a' } });
      expect(res.statusCode).toBe(404);
    },
  );

  it.each(crossTenantCases)(
    '%s: the owning org can read its own row',
    async (_name, url) => {
      const ownUrl = url.replace(/-b(\/|$)/, '-a$1');
      const res = await app.inject({ method: 'GET', url: ownUrl, headers: { 'x-test-org': 'org-a' } });
      expect(res.statusCode).toBe(200);
    },
  );

  it('audit response update: org-a cannot modify an org-b response', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/quality/sop-audits/audit-b/responses/resp-b',
      headers: { 'x-test-org': 'org-a' },
      payload: { notes: 'tampered' },
    });
    expect(res.statusCode).toBe(404);
    expect((app as any).prisma.sOPAuditResponse.update).not.toHaveBeenCalled();
  });

  it('audit response update: the owning org can modify its own response', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/quality/sop-audits/audit-a/responses/resp-a',
      headers: { 'x-test-org': 'org-a' },
      payload: { notes: 'checked' },
    });
    expect(res.statusCode).toBe(200);
  });
});
