import { resolveOrgId, resolveActorId } from '../../auth/orgScope';

const orgsInDatabase = (...ids: string[]): any => ({
  organization: { findMany: jest.fn().mockResolvedValue(ids.map((id) => ({ id }))) },
});

describe('resolveOrgId', () => {
  it('prefers req.user.organizationId when present', async () => {
    const req: any = { user: { organizationId: 'org-from-jwt' } };
    const prisma = orgsInDatabase('org-a', 'org-b');
    expect(await resolveOrgId(req, prisma)).toBe('org-from-jwt');
    expect(prisma.organization.findMany).not.toHaveBeenCalled();
  });

  it('falls back to the sole Organization when the JWT lacks orgId', async () => {
    const req: any = { user: { organizationId: undefined } };
    expect(await resolveOrgId(req, orgsInDatabase('only-org'))).toBe('only-org');
  });

  it('refuses to guess once a second Organization exists (#239)', async () => {
    const req: any = { user: { sub: 'user-1' } };
    expect(await resolveOrgId(req, orgsInDatabase('org-a', 'org-b'))).toBeNull();
  });

  it('returns null rather than a literal when no Organization exists', async () => {
    expect(await resolveOrgId({} as any, orgsInDatabase())).toBeNull();
  });

  it('reads at most two ids, which is all the decision needs', async () => {
    const prisma = orgsInDatabase('only-org');
    await resolveOrgId({} as any, prisma);
    expect(prisma.organization.findMany).toHaveBeenCalledWith({ select: { id: true }, take: 2 });
  });

  it('does not keep serving the sole org after a second one is created', async () => {
    const findMany = jest
      .fn()
      .mockResolvedValueOnce([{ id: 'org-a' }])
      .mockResolvedValueOnce([{ id: 'org-a' }, { id: 'org-b' }]);
    const prisma: any = { organization: { findMany } };
    expect(await resolveOrgId({} as any, prisma)).toBe('org-a');
    expect(await resolveOrgId({} as any, prisma)).toBeNull();
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
