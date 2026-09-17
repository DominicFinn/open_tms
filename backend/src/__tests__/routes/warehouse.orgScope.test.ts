/**
 * Warehouse PWA tenancy with more than one Organization (#303, #239).
 *
 * Since #239 a request without a token org resolves to no tenant once a second Organization
 * exists. The two login endpoints are unauthenticated, so they must take the tenant from the user
 * the email or magic link identifies and sign it into the session token. Every other warehouse
 * route must refuse a request that resolved no tenant, rather than run with a null scope.
 */

import Fastify from 'fastify';
import { createHash } from 'crypto';

jest.mock('bcrypt', () => ({
  compare: jest.fn(async (plain: string, hash: string) => plain === 'correct-password' && hash === 'stored-hash'),
}), { virtual: true });

jest.mock('../../di/index.js', () => ({
  container: { resolve: jest.fn(() => ({ execute: jest.fn() })) },
  TOKENS: new Proxy({}, { get: (_t, prop) => Symbol.for(String(prop)) }),
}));

import { warehouseRoutes } from '../../routes/warehouse.js';
import { signInternalJWT } from '../../auth/internalJWT.js';

const ORG_A = 'org-a';
const ORG_B = 'org-b';
const MAGIC_TOKEN = 'printed-qr-token';

const orgBUser = {
  id: 'user-b',
  email: 'operative@example.test',
  firstName: 'Op',
  lastName: 'B',
  active: true,
  organizationId: ORG_B,
  preferredLocationId: null,
  passwordHash: 'stored-hash',
  failedLoginAttempts: 0,
  lockedUntil: null,
  roles: [{ role: { name: 'warehouse', permissions: ['wms:read', 'wms:write'] } }],
};

function buildPrisma() {
  return {
    // Two tenants, so a token without an org resolves to no tenant at all.
    organization: { findMany: jest.fn().mockResolvedValue([{ id: ORG_A }, { id: ORG_B }]) },
    magicLink: {
      findUnique: jest.fn(({ where }: any) => Promise.resolve(
        where.tokenHash === createHash('sha256').update(MAGIC_TOKEN).digest('hex')
          ? { id: 'link-b', userId: orgBUser.id, active: true, expiresAt: null, scope: 'warehouse', user: orgBUser }
          : null,
      )),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(({ where }: any) => Promise.resolve(where.email === orgBUser.email ? orgBUser : null)),
      update: jest.fn().mockResolvedValue({}),
    },
    loginAuditLog: { create: jest.fn().mockResolvedValue({}) },
    location: { findMany: jest.fn().mockResolvedValue([]) },
  } as any;
}

function claimsOf(token: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
}

function bearer(organizationId?: string): string {
  return `Bearer ${signInternalJWT({
    sub: 'user-x', email: 'x@example.test', firstName: 'X', lastName: 'Y',
    roles: [], permissions: ['*'], organizationId, scope: 'warehouse',
  })}`;
}

describe('warehouse routes with two organizations', () => {
  let app: ReturnType<typeof Fastify>;
  let prisma: ReturnType<typeof buildPrisma>;

  beforeEach(async () => {
    prisma = buildPrisma();
    app = Fastify();
    app.decorate('prisma', prisma);
    await app.register(warehouseRoutes);
  });

  afterEach(async () => {
    await app.close();
  });

  it('magic link login signs the linked user\'s org into the session', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/warehouse/auth/magic-link/validate', payload: { token: MAGIC_TOKEN },
    });

    expect(res.statusCode).toBe(200);
    expect(claimsOf(res.json().data.token).organizationId).toBe(ORG_B);
  });

  it('an unknown magic link is still refused', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/warehouse/auth/magic-link/validate', payload: { token: 'guess' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('password login signs the user\'s org into the session', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/warehouse/auth/login',
      payload: { email: orgBUser.email, password: 'correct-password' },
    });

    expect(res.statusCode).toBe(200);
    expect(claimsOf(res.json().data.token).organizationId).toBe(ORG_B);
  });

  it('a wrong password still counts towards lockout', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/warehouse/auth/login',
      payload: { email: orgBUser.email, password: 'wrong' },
    });

    expect(res.statusCode).toBe(401);
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ failedLoginAttempts: 1 }),
    }));
  });

  it('an operational route refuses a token that carries no org', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/warehouse/locations', headers: { authorization: bearer(undefined) },
    });

    expect(res.statusCode).toBe(401);
    expect(prisma.location.findMany).not.toHaveBeenCalled();
  });

  it('an operational route runs inside the token\'s org', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/warehouse/locations', headers: { authorization: bearer(ORG_A) },
    });

    expect(res.statusCode).toBe(200);
    expect(prisma.location.findMany.mock.calls[0][0].where.orgId).toBe(ORG_A);
  });
});
