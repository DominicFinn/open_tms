/**
 * Cross-tenant isolation tests for Phase 3 (Location, Lane, Driver, Vehicle,
 * Device). Mirrors the phase-2 contract: pass orgId → strict scope; omit
 * orgId → legacy/admin reach.
 *
 * Driver/Vehicle don't have their own repos yet so their isolation rides on
 * the orgId column itself plus the Carrier-scoped queries used by the
 * route layer (out of scope for these unit-shaped tests).
 */

import { LocationsRepository } from '../../repositories/LocationsRepository';
import { LanesRepository } from '../../repositories/LanesRepository';

function makeOrgScopedPrisma(rows: Array<Record<string, any>>) {
  const findFirst = jest.fn().mockImplementation(({ where }: any) => {
    return Promise.resolve(
      rows.find((r) =>
        (!where.id || r.id === where.id) &&
        (!where.orgId || r.orgId === where.orgId) &&
        (where.archived === undefined || r.archived === where.archived) &&
        (!where.status || r.status === where.status)
      ) ?? null,
    );
  });
  const findUnique = jest.fn().mockImplementation(({ where }: any) =>
    Promise.resolve(rows.find((r) => r.id === where.id) ?? null)
  );
  const findMany = jest.fn().mockImplementation(({ where }: any) => {
    return Promise.resolve(
      rows.filter((r) =>
        (!where?.orgId || r.orgId === where.orgId) &&
        (where?.archived === undefined || r.archived === where.archived) &&
        (!where?.status || r.status === where.status)
      )
    );
  });
  return { findFirst, findUnique, findMany };
}

describe('Cross-tenant isolation — Location', () => {
  const rows: Array<Record<string, any>> = [
    { id: 'loc-a1', orgId: 'org-a', name: 'A Dallas DC', city: 'Dallas', archived: false },
    { id: 'loc-a2', orgId: 'org-a', name: 'A Phoenix DC', city: 'Phoenix', archived: false },
    { id: 'loc-b1', orgId: 'org-b', name: 'B Dallas DC', city: 'Dallas', archived: false },
  ];

  function prismaFor() {
    const { findFirst, findUnique, findMany } = makeOrgScopedPrisma(rows);
    return {
      location: {
        findFirst, findUnique, findMany,
        create: jest.fn(),
        createMany: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn(),
      },
    } as any;
  }

  it('User from org-a cannot fetch a location that belongs to org-b by guessing its UUID', async () => {
    const repo = new LocationsRepository(prismaFor());
    expect(await repo.findById('loc-b1', 'org-a')).toBeNull();
  });

  it('User from org-b can fetch their own location', async () => {
    const repo = new LocationsRepository(prismaFor());
    expect((await repo.findById('loc-b1', 'org-b'))?.id).toBe('loc-b1');
  });

  it('all() returns only the requesting tenant', async () => {
    const repo = new LocationsRepository(prismaFor());
    const results = await repo.all('org-a');
    expect(results.map((l) => l.id)).toEqual(['loc-a1', 'loc-a2']);
  });

  it('findByIdUnique guards cross-tenant access at the application layer', async () => {
    // Even though Prisma findUnique doesn't accept orgId in its where clause,
    // the repo does a post-fetch check so the contract stays consistent.
    const repo = new LocationsRepository(prismaFor());
    expect(await repo.findByIdUnique('loc-b1', 'org-a')).toBeNull();
    expect((await repo.findByIdUnique('loc-b1', 'org-b'))?.id).toBe('loc-b1');
  });

  it('search() scopes by orgId so org-a cannot enumerate org-b locations', async () => {
    const repo = new LocationsRepository(prismaFor());
    // The mock doesn't simulate the contains-OR text filter — it only
    // enforces orgId scoping — so the assertion focuses on tenant
    // isolation: a search from org-a never returns an org-b row, no
    // matter what the query is.
    const results = await repo.search('Dallas', 'org-a');
    expect(results.map((l) => l.orgId)).toEqual(results.map(() => 'org-a'));
    expect(results.map((l) => l.id)).not.toContain('loc-b1');
  });

  it('create() throws when caller omits orgId (NOT NULL post phase 3)', async () => {
    const prisma = prismaFor();
    const repo = new LocationsRepository(prisma);

    await expect(
      repo.create({
        name: 'X',
        address1: '1 St',
        city: 'C',
        country: 'US',
      } as any)
    ).rejects.toThrow(/orgId is required/);
    expect(prisma.location.create).not.toHaveBeenCalled();
  });
});

describe('Cross-tenant isolation — Lane', () => {
  const rows: Array<Record<string, any>> = [
    { id: 'l-a1', orgId: 'org-a', name: 'A→B', archived: false, status: 'active' },
    { id: 'l-b1', orgId: 'org-b', name: 'C→D', archived: false, status: 'active' },
  ];

  function prismaFor() {
    const { findFirst, findMany } = makeOrgScopedPrisma(rows);
    return {
      lane: {
        findFirst, findMany,
        create: jest.fn(),
        update: jest.fn(),
        createMany: jest.fn(),
      },
      $transaction: jest.fn((fn: Function) => fn({ lane: { create: jest.fn(), update: jest.fn() }, laneStop: { createMany: jest.fn(), deleteMany: jest.fn() } })),
    } as any;
  }

  it('findById from org-a cannot reach org-b lane', async () => {
    const repo = new LanesRepository(prismaFor());
    expect(await repo.findById('l-b1', 'org-a')).toBeNull();
    expect((await repo.findById('l-b1', 'org-b'))?.id).toBe('l-b1');
  });

  it('findByIdSimple respects orgId scoping', async () => {
    const repo = new LanesRepository(prismaFor());
    expect(await repo.findByIdSimple('l-b1', 'org-a')).toBeNull();
  });

  it('all() returns only the requesting tenant', async () => {
    const repo = new LanesRepository(prismaFor());
    const results = await repo.all('org-a');
    expect(results.map((l: any) => l.id)).toEqual(['l-a1']);
  });

  it('omitting orgId reaches both tenants (legacy/admin behaviour)', async () => {
    const repo = new LanesRepository(prismaFor());
    expect((await repo.findById('l-b1'))?.id).toBe('l-b1');
    expect((await repo.findById('l-a1'))?.id).toBe('l-a1');
  });
});

describe('Phase 3 — defence in depth', () => {
  // Document the contract: empty-string orgId behaves like omitted (does
  // NOT scope) because every repo uses the `if (orgId)` truthy check.
  // Same shape as the phase-2 suite.

  it('Location.findById with empty-string orgId reaches both tenants', async () => {
    const rows = [
      { id: 'a', orgId: 'org-a', archived: false },
      { id: 'b', orgId: 'org-b', archived: false },
    ];
    const { findFirst, findUnique, findMany } = makeOrgScopedPrisma(rows);
    const prisma = {
      location: {
        findFirst, findUnique, findMany,
        create: jest.fn(),
        createMany: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn(),
      },
    } as any;
    const repo = new LocationsRepository(prisma);

    expect((await repo.findById('b', ''))?.id).toBe('b');
  });
});
