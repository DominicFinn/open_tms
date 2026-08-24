/**
 * Role route guard tests (#142).
 *
 * Before this, no mutating role route had a permission guard: any
 * authenticated user could create a role with '*' and assign it to
 * themselves. These tests register the real plugin and assert
 * roles:read / roles:write enforcement plus the system-role edit refusal
 * (system roles are re-synced from code on boot, so edits would silently
 * revert).
 */

import Fastify from 'fastify';
import { roleRoutes } from '../../routes/roles';

const SYSTEM_ROLE = { id: 'r-sys', name: 'admin', isSystem: true, permissions: ['*'] };
const CUSTOM_ROLE = { id: 'r-custom', name: 'wms-supervisor', isSystem: false, permissions: ['wms:*'] };

function buildPrisma() {
  return {
    role: {
      findMany: jest.fn().mockResolvedValue([SYSTEM_ROLE, CUSTOM_ROLE]),
      findUnique: jest.fn().mockImplementation(({ where }: any) => {
        if (where.id === 'r-sys' || where.name === 'admin') return Promise.resolve(SYSTEM_ROLE);
        if (where.id === 'r-custom' || where.name === 'wms-supervisor') return Promise.resolve(CUSTOM_ROLE);
        return Promise.resolve(null);
      }),
      create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'r-new', ...data })),
      update: jest.fn().mockImplementation(({ where, data }: any) => Promise.resolve({ ...CUSTOM_ROLE, ...data, id: where.id })),
      delete: jest.fn().mockResolvedValue({}),
    },
    user: { findUnique: jest.fn().mockResolvedValue({ id: 'u-1' }) },
    userRole: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'ur-1' }),
      delete: jest.fn().mockResolvedValue({}),
    },
  } as any;
}

async function buildApp(permissions: string[]) {
  const app = Fastify();
  app.decorate('prisma', buildPrisma());
  app.addHook('preHandler', async (req) => {
    (req as any).user = { sub: 'u-1', email: 'u@test.com', roles: ['x'], permissions };
  });
  await app.register(roleRoutes);
  return app;
}

describe('role route guards', () => {
  it('reads require roles:read', async () => {
    const app = await buildApp(['shipments:read']);
    for (const url of ['/api/v1/roles', '/api/v1/roles/permissions', '/api/v1/roles/r-custom']) {
      const res = await app.inject({ method: 'GET', url });
      expect(res.statusCode).toBe(403);
    }
    await app.close();
  });

  it('roles:read can list roles and the permission catalogue', async () => {
    const app = await buildApp(['roles:read']);
    const list = await app.inject({ method: 'GET', url: '/api/v1/roles' });
    const cat = await app.inject({ method: 'GET', url: '/api/v1/roles/permissions' });
    expect(list.statusCode).toBe(200);
    expect(cat.statusCode).toBe(200);
    // The catalogue is served straight from PERMISSIONS, so anything added
    // there (e.g. the wms family from #134) appears with no further work
    expect(JSON.parse(cat.body).data).toHaveProperty('ROLES_READ', 'roles:read');
    await app.close();
  });

  it('roles:read alone cannot create, edit, delete, or assign', async () => {
    const app = await buildApp(['roles:read']);
    const cases = [
      { method: 'POST' as const, url: '/api/v1/roles', payload: { name: 'x', permissions: ['wms:read'] } },
      { method: 'PUT' as const, url: '/api/v1/roles/r-custom', payload: { permissions: ['wms:read'] } },
      { method: 'DELETE' as const, url: '/api/v1/roles/r-custom' },
      { method: 'POST' as const, url: '/api/v1/roles/r-custom/users/u-1' },
      { method: 'DELETE' as const, url: '/api/v1/roles/r-custom/users/u-1' },
      { method: 'POST' as const, url: '/api/v1/roles/seed' },
    ];
    for (const c of cases) {
      const res = await app.inject(c);
      expect(res.statusCode).toBe(403);
    }
    await app.close();
  });

  it('roles:write can create a custom role', async () => {
    const app = await buildApp(['roles:write']);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/roles',
      payload: { name: 'new-role', description: 'test', permissions: ['wms:read', 'wms:write'] },
    });
    expect(res.statusCode).toBe(201);
    await app.close();
  });

  it('refuses editing a system role with a clear error', async () => {
    const app = await buildApp(['roles:write']);
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/roles/r-sys',
      payload: { permissions: ['shipments:read'] },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toContain('managed in code');
    expect((app as any).prisma.role.update).not.toHaveBeenCalled();
    await app.close();
  });

  it('allows editing a custom role', async () => {
    const app = await buildApp(['roles:write']);
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/roles/r-custom',
      payload: { permissions: ['wms:read'] },
    });
    expect(res.statusCode).toBe(200);
    await app.close();
  });
});
