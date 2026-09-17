/**
 * Org-scoping checks for the API key, comment, internal user and kanban view routes (#314).
 *
 * Each app runs the real route plugin over a mocked prisma, as org-a, and aims requests at org-b's
 * ids. A row from another org must behave exactly like a missing one.
 */

import Fastify, { FastifyInstance } from 'fastify';

const mockDispatch = jest.fn();
const mockServices: Record<string, unknown> = {};

jest.mock('../../di/index.js', () => ({
  container: {
    resolve: jest.fn((token: symbol) => mockServices[Symbol.keyFor(token) ?? ''] ?? { dispatch: mockDispatch }),
  },
  TOKENS: new Proxy({}, { get: (_t, prop) => Symbol.for(String(prop)) }),
}));

// Stands in for the internal JWT: the user belongs to org-a and holds every permission.
jest.mock('../../middleware/jwtAuth.js', () => ({
  authenticateJWT: jest.fn(async (req: any) => {
    req.user = { sub: 'user-a', organizationId: 'org-a', roles: [], permissions: ['*'] };
  }),
  requirePermission: jest.fn(() => async () => undefined),
}));

jest.mock('../../auth/guardWrites.js', () => ({ guardWrites: () => async () => undefined }));

import { apiKeyRoutes } from '../../routes/apiKeys.js';
import { commentRoutes } from '../../routes/comments.js';
import { internalUserRoutes } from '../../routes/internalUsers.js';
import { issueRoutes } from '../../routes/issues.js';

const CUSTOMER_B = '00000000-0000-4000-8000-00000000000b';

function scopedRow<T extends { orgId?: string; organizationId?: string }>(rows: T[]) {
  return jest.fn(({ where }: any) =>
    Promise.resolve(
      rows.find((r) =>
        r.orgId !== undefined
          ? r.orgId === where.orgId && (r as any).id === where.id
          : r.organizationId === where.organizationId && (r as any).id === where.id,
      ) ?? null,
    ),
  );
}

async function buildApp(
  register: (app: FastifyInstance) => PromiseLike<unknown>,
  prisma: any,
  presetOrg: boolean,
): Promise<FastifyInstance> {
  const app = Fastify();
  app.decorate('prisma', prisma);
  if (presetOrg) {
    // The authenticated scope sets req.orgId before these plugins run.
    app.addHook('preHandler', async (req) => {
      (req as any).orgId = 'org-a';
      (req as any).user = { sub: 'user-a', organizationId: 'org-a', roles: [], permissions: [] };
    });
  }
  await register(app);
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
  for (const k of Object.keys(mockServices)) delete mockServices[k];
});

describe('apiKeyRoutes', () => {
  it('lists only the caller org keys', async () => {
    const prisma = { apiKey: { findMany: jest.fn().mockResolvedValue([]) } };
    const app = await buildApp((a) => a.register(apiKeyRoutes), prisma, true);

    const res = await app.inject({ method: 'GET', url: '/api/v1/api-keys' });

    expect(res.statusCode).toBe(200);
    expect(prisma.apiKey.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { orgId: 'org-a' } }));
  });

  it('refuses another org customer with 404 and creates nothing', async () => {
    const findById = jest.fn((_id: string, orgId: string) =>
      Promise.resolve(orgId === 'org-b' ? { id: CUSTOMER_B, name: 'B' } : null),
    );
    mockServices.ICustomersRepository = { findById };
    const app = await buildApp((a) => a.register(apiKeyRoutes), {}, true);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/api-keys',
      payload: { name: 'Key', customerId: CUSTOMER_B },
    });

    expect(res.statusCode).toBe(404);
    expect(findById).toHaveBeenCalledWith(CUSTOMER_B, 'org-a');
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('creates a key for a customer in the caller org and returns the customer', async () => {
    mockServices.ICustomersRepository = {
      findById: jest.fn().mockResolvedValue({ id: CUSTOMER_B, name: 'Acme', orgId: 'org-a' }),
    };
    mockDispatch.mockResolvedValue({ success: true, data: { id: 'k1', customerId: CUSTOMER_B } });
    const app = await buildApp((a) => a.register(apiKeyRoutes), {}, true);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/api-keys',
      payload: { name: 'Key', customerId: CUSTOMER_B },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().data.customer).toEqual({ id: CUSTOMER_B, name: 'Acme' });
    expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'org-a' }));
  });
});

describe('commentRoutes', () => {
  const comments = [{ id: 'c-b', orgId: 'org-b', authorId: 'user-a', deletedAt: null }];

  it.each([
    ['PUT', { body: 'edited' }],
    ['DELETE', undefined],
  ] as const)('%s on another org comment is a 404', async (method, payload) => {
    const prisma = { comment: { findUnique: scopedRow(comments) } };
    mockServices.PrismaClient = prisma;
    const app = await buildApp((a) => a.register(commentRoutes), prisma, true);

    const res = await app.inject({ method, url: '/api/v1/comments/c-b', payload });

    expect(res.statusCode).toBe(404);
    expect(prisma.comment.findUnique).toHaveBeenCalledWith({ where: { id: 'c-b', orgId: 'org-a' } });
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('lists comments within the caller org only', async () => {
    const prisma = { comment: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) } };
    mockServices.PrismaClient = prisma;
    const app = await buildApp((a) => a.register(commentRoutes), prisma, true);

    await app.inject({ method: 'GET', url: '/api/v1/comments?entityType=issue&entityId=i1' });

    expect(prisma.comment.count).toHaveBeenCalledWith({
      where: { orgId: 'org-a', entityType: 'issue', entityId: 'i1', deletedAt: null },
    });
  });
});

describe('internalUserRoutes', () => {
  const users = [
    { id: 'user-a', organizationId: 'org-a' },
    { id: 'user-b', organizationId: 'org-b' },
  ];

  function setup() {
    const prisma = {
      user: {
        findFirst: scopedRow(users),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({ id: 'user-a', active: false }),
      },
      organization: { findMany: jest.fn() },
    };
    const adminResetPassword = jest.fn().mockResolvedValue(undefined);
    mockServices.PrismaClient = prisma;
    mockServices.IAuthService = { adminResetPassword };
    return { prisma, adminResetPassword };
  }

  it('lists users from the token org only', async () => {
    const { prisma } = setup();
    const app = await buildApp((a) => a.register(internalUserRoutes), prisma, false);

    const res = await app.inject({ method: 'GET', url: '/api/v1/users' });

    expect(res.statusCode).toBe(200);
    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: 'org-a' } }));
  });

  it('refuses to update a user in another org', async () => {
    const { prisma } = setup();
    const app = await buildApp((a) => a.register(internalUserRoutes), prisma, false);

    const res = await app.inject({ method: 'PATCH', url: '/api/v1/users/user-b', payload: { active: false } });

    expect(res.statusCode).toBe(404);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('updates a user in the caller org with the org in the where', async () => {
    const { prisma } = setup();
    const app = await buildApp((a) => a.register(internalUserRoutes), prisma, false);

    const res = await app.inject({ method: 'PATCH', url: '/api/v1/users/user-a', payload: { active: false } });

    expect(res.statusCode).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-a', organizationId: 'org-a' },
      data: { active: false },
    });
  });

  it('refuses to reset the password of a user in another org', async () => {
    const { prisma, adminResetPassword } = setup();
    const app = await buildApp((a) => a.register(internalUserRoutes), prisma, false);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/users/user-b/reset-password',
      payload: { newPassword: 'Password1' },
    });

    expect(res.statusCode).toBe(404);
    expect(adminResetPassword).not.toHaveBeenCalled();
  });
});

describe('issueRoutes kanban views', () => {
  function setup() {
    const repo = {
      updateKanbanView: jest.fn().mockResolvedValue(null),
      deleteKanbanView: jest.fn().mockResolvedValue(false),
    };
    mockServices.IIssueRepository = repo;
    mockServices.PrismaClient = {};
    return repo;
  }

  it('returns 404 when updating another org view', async () => {
    const repo = setup();
    const app = await buildApp((a) => a.register(issueRoutes), {}, true);

    const res = await app.inject({ method: 'PUT', url: '/api/v1/kanban-views/v-b', payload: { name: 'x' } });

    expect(res.statusCode).toBe(404);
    expect(repo.updateKanbanView).toHaveBeenCalledWith('v-b', 'org-a', { name: 'x' });
  });

  it('returns 404 when deleting another org view', async () => {
    const repo = setup();
    const app = await buildApp((a) => a.register(issueRoutes), {}, true);

    const res = await app.inject({ method: 'DELETE', url: '/api/v1/kanban-views/v-b' });

    expect(res.statusCode).toBe(404);
    expect(repo.deleteKanbanView).toHaveBeenCalledWith('v-b', 'org-a');
  });
});
