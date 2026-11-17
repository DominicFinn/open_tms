/**
 * Read/write guard tests (#134).
 *
 * Registers the guard on a real Fastify instance with a GET and a POST
 * route, simulates the authenticated user via an earlier preHandler
 * (mirroring authenticateJWT populating req.user), and asserts the
 * read/write permission split.
 *
 * The guard also attaches and requires the tenant scope (#238), so the fixture supplies an orgId
 * the way a real request gets one. `attachOrgScopeHook` is idempotent and skips when `req.orgId`
 * is already set, so setting it here stands in for the JWT resolution. The no-tenant case has its
 * own test below.
 */

import Fastify from 'fastify';
import { registerReadWriteGuard } from '../../auth/readWriteGuard';

async function buildApp(permissions: string[] | null, orgId: string | null = 'org-1') {
  const app = Fastify();
  app.decorate('prisma', {} as any);
  app.addHook('preHandler', async (req) => {
    if (orgId) (req as any).orgId = orgId;
    if (permissions) {
      (req as any).user = {
        sub: 'user-1',
        email: 'u@test.com',
        roles: ['test'],
        permissions,
      };
    }
  });
  await registerReadWriteGuard(app, 'returns');
  app.get('/api/v1/returns/thing', async () => ({ data: 'read-ok', error: null }));
  app.post('/api/v1/returns/thing', async () => ({ data: 'write-ok', error: null }));
  return app;
}

describe('registerReadWriteGuard', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const app = await buildApp(null);
    const res = await app.inject({ method: 'GET', url: '/api/v1/returns/thing' });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('rejects an authenticated user with no returns permissions (403)', async () => {
    const app = await buildApp(['shipments:read', 'orders:read']);
    const read = await app.inject({ method: 'GET', url: '/api/v1/returns/thing' });
    const write = await app.inject({ method: 'POST', url: '/api/v1/returns/thing' });
    expect(read.statusCode).toBe(403);
    expect(write.statusCode).toBe(403);
    await app.close();
  });

  it('returns:read allows reads but not writes', async () => {
    const app = await buildApp(['returns:read']);
    const read = await app.inject({ method: 'GET', url: '/api/v1/returns/thing' });
    const write = await app.inject({ method: 'POST', url: '/api/v1/returns/thing' });
    expect(read.statusCode).toBe(200);
    expect(write.statusCode).toBe(403);
    await app.close();
  });

  it('returns:write allows writes', async () => {
    const app = await buildApp(['returns:write']);
    const write = await app.inject({ method: 'POST', url: '/api/v1/returns/thing' });
    expect(write.statusCode).toBe(200);
    await app.close();
  });

  it('returns:* allows both', async () => {
    const app = await buildApp(['returns:*']);
    const read = await app.inject({ method: 'GET', url: '/api/v1/returns/thing' });
    const write = await app.inject({ method: 'POST', url: '/api/v1/returns/thing' });
    expect(read.statusCode).toBe(200);
    expect(write.statusCode).toBe(200);
    await app.close();
  });

  it('the global * wildcard allows both', async () => {
    const app = await buildApp(['*']);
    const read = await app.inject({ method: 'GET', url: '/api/v1/returns/thing' });
    const write = await app.inject({ method: 'POST', url: '/api/v1/returns/thing' });
    expect(read.statusCode).toBe(200);
    expect(write.statusCode).toBe(200);
    await app.close();
  });
});

describe('system role returns grants', () => {
  // Lock the permissive defaults in so a future tightening is a conscious change
  const { SYSTEM_ROLES } = require('../../auth/permissions');
  const perms = (name: string) =>
    SYSTEM_ROLES.find((r: any) => r.name === name)!.permissions;

  it('dispatcher and readonly can view returns', () => {
    expect(perms('dispatcher')).toContain('returns:read');
    expect(perms('readonly')).toContain('returns:read');
  });

  it('broker_admin has full returns access', () => {
    expect(perms('broker_admin')).toContain('returns:*');
  });

  it('no system role still grants the removed wms permissions', () => {
    const all = SYSTEM_ROLES.flatMap((r: any) => r.permissions);
    expect(all.filter((p: string) => p.startsWith('wms:'))).toEqual([]);
    expect(SYSTEM_ROLES.find((r: any) => r.name === 'warehouse')).toBeUndefined();
  });

  /**
   * #238: a guarded route once ran with no org scope registered, so req.orgId was undefined and
   * Prisma read `where: { orgId: undefined }` as no filter. The guard now refuses rather than
   * serving a request that would span tenants.
   */
  it('refuses a request with no tenant context rather than spanning tenants', async () => {
    const app = await buildApp(['returns:read', 'returns:write'], null);
    const read = await app.inject({ method: 'GET', url: '/api/v1/returns/thing' });
    expect(read.statusCode).toBe(401);
    expect(JSON.parse(read.body).error).toMatch(/tenant/i);
    await app.close();
  });
});
