/**
 * WMS route guard tests (#134).
 *
 * Registers the guard on a real Fastify instance with a GET and a POST
 * route, simulates the authenticated user via an earlier preHandler
 * (mirroring authenticateJWT populating req.user), and asserts the
 * read/write permission split.
 */

import Fastify from 'fastify';
import { registerWmsGuard } from '../../auth/wmsGuard';

async function buildApp(permissions: string[] | null) {
  const app = Fastify();
  app.addHook('preHandler', async (req) => {
    if (permissions) {
      (req as any).user = {
        sub: 'user-1',
        email: 'u@test.com',
        roles: ['test'],
        permissions,
      };
    }
  });
  await registerWmsGuard(app);
  app.get('/api/v1/wms/thing', async () => ({ data: 'read-ok', error: null }));
  app.post('/api/v1/wms/thing', async () => ({ data: 'write-ok', error: null }));
  return app;
}

describe('registerWmsGuard', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const app = await buildApp(null);
    const res = await app.inject({ method: 'GET', url: '/api/v1/wms/thing' });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('rejects an authenticated user with no wms permissions (403)', async () => {
    const app = await buildApp(['shipments:read', 'orders:read']);
    const read = await app.inject({ method: 'GET', url: '/api/v1/wms/thing' });
    const write = await app.inject({ method: 'POST', url: '/api/v1/wms/thing' });
    expect(read.statusCode).toBe(403);
    expect(write.statusCode).toBe(403);
    await app.close();
  });

  it('wms:read allows reads but not writes', async () => {
    const app = await buildApp(['wms:read']);
    const read = await app.inject({ method: 'GET', url: '/api/v1/wms/thing' });
    const write = await app.inject({ method: 'POST', url: '/api/v1/wms/thing' });
    expect(read.statusCode).toBe(200);
    expect(write.statusCode).toBe(403);
    await app.close();
  });

  it('wms:write allows writes', async () => {
    const app = await buildApp(['wms:write']);
    const write = await app.inject({ method: 'POST', url: '/api/v1/wms/thing' });
    expect(write.statusCode).toBe(200);
    await app.close();
  });

  it('wms:* allows both', async () => {
    const app = await buildApp(['wms:*']);
    const read = await app.inject({ method: 'GET', url: '/api/v1/wms/thing' });
    const write = await app.inject({ method: 'POST', url: '/api/v1/wms/thing' });
    expect(read.statusCode).toBe(200);
    expect(write.statusCode).toBe(200);
    await app.close();
  });

  it('the global * wildcard allows both', async () => {
    const app = await buildApp(['*']);
    const read = await app.inject({ method: 'GET', url: '/api/v1/wms/thing' });
    const write = await app.inject({ method: 'POST', url: '/api/v1/wms/thing' });
    expect(read.statusCode).toBe(200);
    expect(write.statusCode).toBe(200);
    await app.close();
  });
});

describe('system role wms grants', () => {
  // Lock the permissive defaults in so a future tightening is a conscious change
  const { SYSTEM_ROLES } = require('../../auth/permissions');
  const perms = (name: string) =>
    SYSTEM_ROLES.find((r: any) => r.name === name)!.permissions;

  it('warehouse role can execute warehouse tasks', () => {
    expect(perms('warehouse')).toContain('wms:*');
  });

  it('dispatcher and readonly can view WMS surfaces', () => {
    expect(perms('dispatcher')).toContain('wms:read');
    expect(perms('readonly')).toContain('wms:read');
  });

  it('broker_admin has full WMS access', () => {
    expect(perms('broker_admin')).toContain('wms:*');
  });
});
