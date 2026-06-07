import {
  attachOrgScopeHook,
  requireOrgScope,
  attachOrgScopeFromCustomerUserHook,
  attachOrgScopeFromCarrierUserHook,
  attachOrgScopeFromPartnerHook,
} from '../../auth/orgScopeMiddleware';
import { resetOrgScopeCache } from '../../auth/orgScope';

describe('attachOrgScopeHook', () => {
  beforeEach(() => resetOrgScopeCache());

  it('populates req.orgId from the JWT when present', async () => {
    const prisma: any = { organization: { findFirst: jest.fn() } };
    const hook = attachOrgScopeHook(prisma);
    const req: any = { user: { organizationId: 'org-from-jwt' } };

    await (hook as any).call({}, req, {} as any, jest.fn());
    expect(req.orgId).toBe('org-from-jwt');
    // The JWT path short-circuits the DB lookup, by design.
    expect(prisma.organization.findFirst).not.toHaveBeenCalled();
  });

  it('falls back to the first Organization when the JWT lacks orgId', async () => {
    const prisma: any = {
      organization: { findFirst: jest.fn().mockResolvedValue({ id: 'fallback-org' }) },
    };
    const hook = attachOrgScopeHook(prisma);
    const req: any = {};

    await (hook as any).call({}, req, {} as any, jest.fn());
    expect(req.orgId).toBe('fallback-org');
  });

  it('leaves req.orgId as the default-org literal when no Organization exists', async () => {
    const prisma: any = {
      organization: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const hook = attachOrgScopeHook(prisma);
    const req: any = {};

    await (hook as any).call({}, req, {} as any, jest.fn());
    // resolveOrgId returns 'default-org' in this case — matches phase-2
    // behaviour rather than forcing every dev fixture to seed an Org row.
    expect(req.orgId).toBe('default-org');
  });

  it('is idempotent — does NOT overwrite an existing req.orgId', async () => {
    const prisma: any = {
      organization: { findFirst: jest.fn().mockResolvedValue({ id: 'other-org' }) },
    };
    const hook = attachOrgScopeHook(prisma);
    const req: any = { orgId: 'preset-by-upstream' };

    await (hook as any).call({}, req, {} as any, jest.fn());
    expect(req.orgId).toBe('preset-by-upstream');
    expect(prisma.organization.findFirst).not.toHaveBeenCalled();
  });

  it('leaves req.orgId null when resolveOrgId throws (defensive)', async () => {
    const prisma: any = {
      organization: {
        findFirst: jest.fn().mockRejectedValue(new Error('DB connection lost')),
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

describe('attachOrgScopeFromPartnerHook', () => {
  it('JWT always wins — does not even touch the partner table when orgId is in the JWT', async () => {
    const prisma: any = { tradingPartner: { findUnique: jest.fn() } };
    const hook = attachOrgScopeFromPartnerHook(prisma);
    const req: any = {
      user: { organizationId: 'org-from-jwt' },
      body: { partnerId: 'p-1' },
    };

    await (hook as any).call({}, req, {} as any, jest.fn());

    expect(req.orgId).toBe('org-from-jwt');
    expect(prisma.tradingPartner.findUnique).not.toHaveBeenCalled();
  });

  it('walks body.partnerId → partner.customer.orgId for unauthed webhook ingest', async () => {
    const prisma: any = {
      tradingPartner: {
        findUnique: jest.fn().mockResolvedValue({
          customer: { orgId: 'org-from-customer' },
          carrier: null,
        }),
      },
    };
    const hook = attachOrgScopeFromPartnerHook(prisma);
    const req: any = { body: { partnerId: 'p-1' } };

    await (hook as any).call({}, req, {} as any, jest.fn());

    expect(prisma.tradingPartner.findUnique).toHaveBeenCalledWith({
      where: { id: 'p-1' },
      select: {
        customer: { select: { orgId: true } },
        carrier: { select: { orgId: true } },
      },
    });
    expect(req.orgId).toBe('org-from-customer');
  });

  it('falls back to partner.carrier.orgId when the partner has no customer link', async () => {
    const prisma: any = {
      tradingPartner: {
        findUnique: jest.fn().mockResolvedValue({
          customer: null,
          carrier: { orgId: 'org-from-carrier' },
        }),
      },
    };
    const hook = attachOrgScopeFromPartnerHook(prisma);
    const req: any = { body: { partnerId: 'p-1' } };

    await (hook as any).call({}, req, {} as any, jest.fn());

    expect(req.orgId).toBe('org-from-carrier');
  });

  it('reads partnerId from URL params when body has none', async () => {
    const prisma: any = {
      tradingPartner: {
        findUnique: jest.fn().mockResolvedValue({
          customer: { orgId: 'org-from-customer' },
          carrier: null,
        }),
      },
    };
    const hook = attachOrgScopeFromPartnerHook(prisma);
    const req: any = { params: { partnerId: 'p-99' } };

    await (hook as any).call({}, req, {} as any, jest.fn());

    expect(prisma.tradingPartner.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'p-99' } }),
    );
    expect(req.orgId).toBe('org-from-customer');
  });

  it('reads params.id as a last resort for /trading-partners/:id-style routes', async () => {
    const prisma: any = {
      tradingPartner: {
        findUnique: jest.fn().mockResolvedValue({
          customer: { orgId: 'org-from-id' },
          carrier: null,
        }),
      },
    };
    const hook = attachOrgScopeFromPartnerHook(prisma);
    const req: any = { params: { id: 'p-42' } };

    await (hook as any).call({}, req, {} as any, jest.fn());

    expect(prisma.tradingPartner.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'p-42' } }),
    );
    expect(req.orgId).toBe('org-from-id');
  });

  it('leaves req.orgId undefined when no JWT, no partnerId, and no params are available — so a downstream fallback hook can run', async () => {
    const prisma: any = { tradingPartner: { findUnique: jest.fn() } };
    const hook = attachOrgScopeFromPartnerHook(prisma);
    const req: any = {};

    await (hook as any).call({}, req, {} as any, jest.fn());

    expect(req.orgId).toBeUndefined();
    expect(prisma.tradingPartner.findUnique).not.toHaveBeenCalled();
  });

  it('leaves req.orgId undefined when the partner exists but has no customer or carrier link', async () => {
    const prisma: any = {
      tradingPartner: {
        findUnique: jest.fn().mockResolvedValue({ customer: null, carrier: null }),
      },
    };
    const hook = attachOrgScopeFromPartnerHook(prisma);
    const req: any = { body: { partnerId: 'p-orphan' } };

    await (hook as any).call({}, req, {} as any, jest.fn());

    expect(req.orgId).toBeUndefined();
  });

  it('is idempotent — never overrides an upstream-set req.orgId', async () => {
    const prisma: any = { tradingPartner: { findUnique: jest.fn() } };
    const hook = attachOrgScopeFromPartnerHook(prisma);
    const req: any = { orgId: 'preset', body: { partnerId: 'p-1' } };

    await (hook as any).call({}, req, {} as any, jest.fn());

    expect(req.orgId).toBe('preset');
    expect(prisma.tradingPartner.findUnique).not.toHaveBeenCalled();
  });

  it('leaves req.orgId undefined on DB error (defensive — lets a downstream fallback hook run)', async () => {
    const prisma: any = {
      tradingPartner: {
        findUnique: jest.fn().mockRejectedValue(new Error('DB down')),
      },
    };
    const hook = attachOrgScopeFromPartnerHook(prisma);
    const req: any = { body: { partnerId: 'p-1' } };

    await (hook as any).call({}, req, {} as any, jest.fn());

    expect(req.orgId).toBeUndefined();
  });

  it('ignores non-string body.partnerId values (safety against odd payloads)', async () => {
    const prisma: any = { tradingPartner: { findUnique: jest.fn() } };
    const hook = attachOrgScopeFromPartnerHook(prisma);
    const req: any = { body: { partnerId: { id: 'p-1' } } };

    await (hook as any).call({}, req, {} as any, jest.fn());

    expect(req.orgId).toBeUndefined();
    expect(prisma.tradingPartner.findUnique).not.toHaveBeenCalled();
  });

  it('chains with attachOrgScopeHook: partner-hook leaves it undefined → fallback hook applies the default Organization', async () => {
    const prisma: any = {
      tradingPartner: { findUnique: jest.fn() },
      organization: { findFirst: jest.fn().mockResolvedValue({ id: 'fallback-org' }) },
    };
    const partnerHook = attachOrgScopeFromPartnerHook(prisma);
    const fallbackHook = attachOrgScopeHook(prisma);
    const req: any = {};

    await (partnerHook as any).call({}, req, {} as any, jest.fn());
    expect(req.orgId).toBeUndefined();

    await (fallbackHook as any).call({}, req, {} as any, jest.fn());
    expect(req.orgId).toBe('fallback-org');
  });
});
