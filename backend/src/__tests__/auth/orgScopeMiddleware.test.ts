import {
  attachOrgScopeHook,
  requireOrgScope,
  attachOrgScopeFromCustomerUserHook,
  attachOrgScopeFromCarrierUserHook,
  attachEdiOrgScopeHook,
  registerOrgScopeForEdi,
  registerStrictOrgScope,
} from '../../auth/orgScopeMiddleware';
import Fastify from 'fastify';

describe('attachOrgScopeHook', () => {
  it('populates req.orgId from the JWT when present', async () => {
    const prisma: any = { organization: { findMany: jest.fn() } };
    const hook = attachOrgScopeHook(prisma);
    const req: any = { user: { organizationId: 'org-from-jwt' } };

    await (hook as any).call({}, req, {} as any, jest.fn());
    expect(req.orgId).toBe('org-from-jwt');
    // The JWT path short-circuits the DB lookup, by design.
    expect(prisma.organization.findMany).not.toHaveBeenCalled();
  });

  it('falls back to the sole Organization when the JWT lacks orgId', async () => {
    const prisma: any = {
      organization: { findMany: jest.fn().mockResolvedValue([{ id: 'fallback-org' }]) },
    };
    const hook = attachOrgScopeHook(prisma);
    const req: any = {};

    await (hook as any).call({}, req, {} as any, jest.fn());
    expect(req.orgId).toBe('fallback-org');
  });

  it('leaves req.orgId null when no Organization exists', async () => {
    const prisma: any = {
      organization: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const hook = attachOrgScopeHook(prisma);
    const req: any = {};

    await (hook as any).call({}, req, {} as any, jest.fn());
    expect(req.orgId).toBeNull();
  });

  it('leaves req.orgId null when the token has no org and several Organizations exist (#239)', async () => {
    const prisma: any = {
      organization: { findMany: jest.fn().mockResolvedValue([{ id: 'org-a' }, { id: 'org-b' }]) },
    };
    const hook = attachOrgScopeHook(prisma);
    const req: any = { user: { sub: 'user-1' } };

    await (hook as any).call({}, req, {} as any, jest.fn());
    expect(req.orgId).toBeNull();
  });

  it('is idempotent — does NOT overwrite an existing req.orgId', async () => {
    const prisma: any = {
      organization: { findMany: jest.fn().mockResolvedValue([{ id: 'other-org' }]) },
    };
    const hook = attachOrgScopeHook(prisma);
    const req: any = { orgId: 'preset-by-upstream' };

    await (hook as any).call({}, req, {} as any, jest.fn());
    expect(req.orgId).toBe('preset-by-upstream');
    expect(prisma.organization.findMany).not.toHaveBeenCalled();
  });

  it('leaves req.orgId null when resolveOrgId throws (defensive)', async () => {
    const prisma: any = {
      organization: {
        findMany: jest.fn().mockRejectedValue(new Error('DB connection lost')),
      },
    };
    const hook = attachOrgScopeHook(prisma);
    const req: any = {};

    await (hook as any).call({}, req, {} as any, jest.fn());
    expect(req.orgId).toBeNull();
  });
});

describe('requireOrgScope', () => {
  it('passes through when req.orgId is populated', async () => {
    const req: any = { orgId: 'org-1' };
    const reply: any = { code: jest.fn(), send: jest.fn() };

    await (requireOrgScope as any).call({}, req, reply, jest.fn());

    expect(reply.code).not.toHaveBeenCalled();
    expect(reply.send).not.toHaveBeenCalled();
  });

  it('returns 401 when req.orgId is null', async () => {
    const req: any = { orgId: null };
    const reply: any = {
      code: jest.fn().mockReturnThis(),
      send: jest.fn().mockResolvedValue(undefined),
    };

    await (requireOrgScope as any).call({}, req, reply, jest.fn());

    expect(reply.code).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith({
      data: null,
      error: expect.stringMatching(/requires an authenticated tenant context/),
    });
  });

  it('returns 401 when req.orgId is undefined (hook never ran)', async () => {
    const req: any = {};
    const reply: any = {
      code: jest.fn().mockReturnThis(),
      send: jest.fn().mockResolvedValue(undefined),
    };

    await (requireOrgScope as any).call({}, req, reply, jest.fn());

    expect(reply.code).toHaveBeenCalledWith(401);
  });
});

describe('attachOrgScopeFromCustomerUserHook', () => {
  it('walks req.customerUser.customerId → Customer.orgId', async () => {
    const prisma: any = {
      customer: { findUnique: jest.fn().mockResolvedValue({ orgId: 'org-from-customer' }) },
    };
    const hook = attachOrgScopeFromCustomerUserHook(prisma);
    const req: any = { customerUser: { customerId: 'cust-1' } };

    await (hook as any).call({}, req, {} as any, jest.fn());

    expect(prisma.customer.findUnique).toHaveBeenCalledWith({
      where: { id: 'cust-1' },
      select: { orgId: true },
    });
    expect(req.orgId).toBe('org-from-customer');
  });

  it('leaves req.orgId null when no customerUser is attached', async () => {
    const prisma: any = { customer: { findUnique: jest.fn() } };
    const hook = attachOrgScopeFromCustomerUserHook(prisma);
    const req: any = {};

    await (hook as any).call({}, req, {} as any, jest.fn());

    expect(req.orgId).toBeNull();
    // Important: no DB round-trip when there's no user context.
    expect(prisma.customer.findUnique).not.toHaveBeenCalled();
  });

  it('leaves req.orgId null when the Customer row is missing', async () => {
    const prisma: any = {
      customer: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const hook = attachOrgScopeFromCustomerUserHook(prisma);
    const req: any = { customerUser: { customerId: 'cust-deleted' } };

    await (hook as any).call({}, req, {} as any, jest.fn());

    expect(req.orgId).toBeNull();
  });

  it('is idempotent — never overrides an upstream-set req.orgId', async () => {
    const prisma: any = {
      customer: { findUnique: jest.fn().mockResolvedValue({ orgId: 'other' }) },
    };
    const hook = attachOrgScopeFromCustomerUserHook(prisma);
    const req: any = { orgId: 'preset', customerUser: { customerId: 'cust-1' } };

    await (hook as any).call({}, req, {} as any, jest.fn());

    expect(req.orgId).toBe('preset');
    expect(prisma.customer.findUnique).not.toHaveBeenCalled();
  });

  it('leaves req.orgId null on DB error (defensive)', async () => {
    const prisma: any = {
      customer: { findUnique: jest.fn().mockRejectedValue(new Error('DB down')) },
    };
    const hook = attachOrgScopeFromCustomerUserHook(prisma);
    const req: any = { customerUser: { customerId: 'cust-1' } };

    await (hook as any).call({}, req, {} as any, jest.fn());

    expect(req.orgId).toBeNull();
  });
});

describe('attachOrgScopeFromCarrierUserHook', () => {
  it('walks req.carrierUser.carrierId → Carrier.orgId', async () => {
    const prisma: any = {
      carrier: { findUnique: jest.fn().mockResolvedValue({ orgId: 'org-from-carrier' }) },
    };
    const hook = attachOrgScopeFromCarrierUserHook(prisma);
    const req: any = { carrierUser: { carrierId: 'car-1' } };

    await (hook as any).call({}, req, {} as any, jest.fn());

    expect(prisma.carrier.findUnique).toHaveBeenCalledWith({
      where: { id: 'car-1' },
      select: { orgId: true },
    });
    expect(req.orgId).toBe('org-from-carrier');
  });

  it('leaves req.orgId null when no carrierUser is attached', async () => {
    const prisma: any = { carrier: { findUnique: jest.fn() } };
    const hook = attachOrgScopeFromCarrierUserHook(prisma);
    const req: any = {};

    await (hook as any).call({}, req, {} as any, jest.fn());

    expect(req.orgId).toBeNull();
    expect(prisma.carrier.findUnique).not.toHaveBeenCalled();
  });

  it('is idempotent', async () => {
    const prisma: any = {
      carrier: { findUnique: jest.fn().mockResolvedValue({ orgId: 'other' }) },
    };
    const hook = attachOrgScopeFromCarrierUserHook(prisma);
    const req: any = { orgId: 'preset', carrierUser: { carrierId: 'car-1' } };

    await (hook as any).call({}, req, {} as any, jest.fn());

    expect(req.orgId).toBe('preset');
    expect(prisma.carrier.findUnique).not.toHaveBeenCalled();
  });
});

describe('attachEdiOrgScopeHook', () => {
  it('leaves an org set by the authenticated scope alone', async () => {
    const prisma: any = { apiKey: { findUnique: jest.fn() } };
    const req: any = { orgId: 'preset', headers: {} };

    await (attachEdiOrgScopeHook(prisma) as any).call({}, req, {} as any);

    expect(req.orgId).toBe('preset');
    expect(prisma.apiKey.findUnique).not.toHaveBeenCalled();
  });

  it('takes the org from a verified internal user', async () => {
    const prisma: any = { apiKey: { findUnique: jest.fn() } };
    const req: any = { user: { organizationId: 'org-from-jwt' }, headers: {}, body: { partnerId: 'p-other' } };

    await (attachEdiOrgScopeHook(prisma) as any).call({}, req, {} as any);

    expect(req.orgId).toBe('org-from-jwt');
    expect(prisma.apiKey.findUnique).not.toHaveBeenCalled();
  });

  it('takes the org from an active API key', async () => {
    const prisma: any = {
      apiKey: { findUnique: jest.fn().mockResolvedValue({ orgId: 'org-from-key', active: true }) },
    };
    const req: any = { headers: { 'x-api-key': 'sk_live_x' }, body: { partnerId: 'p-other' } };

    await (attachEdiOrgScopeHook(prisma) as any).call({}, req, {} as any);

    expect(req.orgId).toBe('org-from-key');
  });

  it('gives no org for an inactive API key', async () => {
    const prisma: any = {
      apiKey: { findUnique: jest.fn().mockResolvedValue({ orgId: 'org-from-key', active: false }) },
    };
    const req: any = { headers: { 'x-api-key': 'sk_live_x' } };

    await (attachEdiOrgScopeHook(prisma) as any).call({}, req, {} as any);

    expect(req.orgId).toBeNull();
  });

  it('refuses a request that only names a partner, without looking the partner up', async () => {
    const prisma: any = { tradingPartner: { findUnique: jest.fn() }, apiKey: { findUnique: jest.fn() } };
    const app = Fastify();
    app.decorate('prisma', prisma);
    await app.register(async (scoped) => {
      await registerOrgScopeForEdi(scoped);
      scoped.post('/edi', async () => ({ data: 'reached', error: null }));
    });

    const res = await app.inject({ method: 'POST', url: '/edi', payload: { partnerId: 'p-1' } });

    expect(res.statusCode).toBe(401);
    expect(prisma.tradingPartner.findUnique).not.toHaveBeenCalled();
  });

  it('refuses an unknown API key', async () => {
    const prisma: any = { apiKey: { findUnique: jest.fn().mockResolvedValue(null) } };
    const app = Fastify();
    app.decorate('prisma', prisma);
    await app.register(async (scoped) => {
      await registerOrgScopeForEdi(scoped);
      scoped.post('/edi', async () => ({ data: 'reached', error: null }));
    });

    const res = await app.inject({
      method: 'POST', url: '/edi', headers: { 'x-api-key': 'sk_live_bad' }, payload: { partnerId: 'p-1' },
    });

    expect(res.statusCode).toBe(401);
  });
});

describe('registerStrictOrgScope (#239, #303)', () => {
  async function buildServer(orgIds: string[], user: Record<string, unknown> | undefined) {
    const server = Fastify();
    server.decorate('prisma', {
      organization: { findMany: jest.fn().mockResolvedValue(orgIds.map((id) => ({ id }))) },
    } as any);
    await server.register(async (app) => {
      app.addHook('onRequest', async (req) => {
        (req as any).user = user;
      });
      await registerStrictOrgScope(app);
      // A child plugin that forgot to register any scope of its own.
      await app.register(async (child) => {
        child.get('/scoped', async (req) => ({ data: { orgId: req.orgId }, error: null }));
      });
    });
    return server;
  }

  it('serves a request whose token carries an org', async () => {
    const server = await buildServer(['org-a', 'org-b'], { sub: 'u1', organizationId: 'org-b' });
    const res = await server.inject({ method: 'GET', url: '/scoped' });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.orgId).toBe('org-b');
  });

  it('refuses a token without an org once a second Organization exists', async () => {
    const server = await buildServer(['org-a', 'org-b'], { sub: 'u1' });
    const res = await server.inject({ method: 'GET', url: '/scoped' });
    expect(res.statusCode).toBe(401);
    expect(res.json().data).toBeNull();
  });

  it('still serves a token without an org when only one Organization exists', async () => {
    const server = await buildServer(['only-org'], { sub: 'u1' });
    const res = await server.inject({ method: 'GET', url: '/scoped' });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.orgId).toBe('only-org');
  });
});
