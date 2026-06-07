import { resolveOrgId, resolveActorId, resetOrgScopeCache } from '../../auth/orgScope';

describe('resolveOrgId', () => {
  beforeEach(() => resetOrgScopeCache());

  it('prefers req.user.organizationId when present', async () => {
    const req: any = { user: { organizationId: 'org-from-jwt' } };
    const prisma: any = { organization: { findFirst: jest.fn() } };
    expect(await resolveOrgId(req, prisma)).toBe('org-from-jwt');
    expect(prisma.organization.findFirst).not.toHaveBeenCalled();
  });

  it('falls back to first Organization when JWT lacks orgId', async () => {
    const req: any = { user: { organizationId: undefined } };
    const prisma: any = {
      organization: {
        findFirst: jest.fn().mockResolvedValue({ id: 'first-org' }),
      },
    };
    expect(await resolveOrgId(req, prisma)).toBe('first-org');
  });

  it('returns default-org literal when no Organization rows exist', async () => {
    const req: any = {};
    const prisma: any = {
      organization: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    expect(await resolveOrgId(req, prisma)).toBe('default-org');
  });

  it('caches the fallback so we do not hit the DB on every request', async () => {
    const req: any = {};
    const prisma: any = {
      organization: {
        findFirst: jest.fn().mockResolvedValue({ id: 'cached-org' }),
      },
    };
    await resolveOrgId(req, prisma);
    await resolveOrgId(req, prisma);
    await resolveOrgId(req, prisma);
    expect(prisma.organization.findFirst).toHaveBeenCalledTimes(1);
  });

  it('JWT always wins even when the fallback is cached', async () => {
    const req: any = {};
    const prisma: any = {
      organization: {
        findFirst: jest.fn().mockResolvedValue({ id: 'fallback' }),
      },
    };
    await resolveOrgId(req, prisma); // primes the cache
    const jwtReq: any = { user: { organizationId: 'jwt-org' } };
    expect(await resolveOrgId(jwtReq, prisma)).toBe('jwt-org');
  });
});

describe('resolveActorId', () => {
  it('returns the JWT subject when present', () => {
    const req: any = { user: { sub: 'user-123' } };
    expect(resolveActorId(req)).toBe('user-123');
  });

  it('returns null when no user is attached', () => {
    expect(resolveActorId({} as any)).toBeNull();
  });

  it('returns null when user is present but sub is missing', () => {
    const req: any = { user: { organizationId: 'org-1' } };
    expect(resolveActorId(req)).toBeNull();
  });
});
