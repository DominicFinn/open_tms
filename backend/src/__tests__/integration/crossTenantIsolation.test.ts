/**
 * Cross-tenant isolation tests for Phase 2 of the multi-tenancy plan.
 *
 * Each test sets up two tenants (org-a, org-b) with rows in each, then
 * asserts that querying via repo.findById/findByCustomerId with org A's
 * orgId never returns org B's rows — even when the caller knows the
 * target row's UUID.
 *
 * These are unit-shaped (mocked Prisma) so they verify the WHERE clause
 * structure rather than running against a live database. The point isn't
 * to test Prisma — it's to lock down "every public read accepts orgId
 * and passes it to Prisma in a way that excludes other tenants".
 */

import { CustomersRepository } from '../../repositories/CustomersRepository';
import { CarriersRepository } from '../../repositories/CarriersRepository';
import { OrdersRepository } from '../../repositories/OrdersRepository';
import { ShipmentsRepository } from '../../repositories/ShipmentsRepository';

// Helper that returns a prisma double whose `findFirst` / `findMany`
// answer based on a where clause's orgId. Mimics the actual DB behaviour:
// row exists only if where.orgId matches the row's orgId.
function makeOrgScopedPrisma(rows: Array<Record<string, any>>) {
  const findFirst = jest.fn().mockImplementation(({ where }: any) => {
    return Promise.resolve(
      rows.find((r) =>
        (!where.id || r.id === where.id) &&
        (!where.orgId || r.orgId === where.orgId) &&
        (!where.archived || r.archived === where.archived) &&
        (!where.orderNumber || r.orderNumber === where.orderNumber) &&
        (!where.customerId || r.customerId === where.customerId)
      ) ?? null,
    );
  });
  const findMany = jest.fn().mockImplementation(({ where }: any) => {
    return Promise.resolve(
      rows.filter((r) =>
        (!where.orgId || r.orgId === where.orgId) &&
        (where.archived === undefined || r.archived === where.archived) &&
        (!where.customerId || r.customerId === where.customerId) &&
        (!where.status || r.status === where.status)
      )
    );
  });
  return { findFirst, findMany };
}

describe('Cross-tenant isolation — Customer', () => {
  const rows: Array<Record<string, any>> = [
    { id: 'c-a1', orgId: 'org-a', name: 'Acme', archived: false },
    { id: 'c-a2', orgId: 'org-a', name: 'Wile E', archived: false },
    { id: 'c-b1', orgId: 'org-b', name: 'Conglom-O', archived: false },
  ];

  function prismaFor(input: Array<Record<string, any>>) {
    const { findFirst, findMany } = makeOrgScopedPrisma(input);
    return {
      customer: { findFirst, findMany, create: jest.fn(), update: jest.fn() },
    } as any;
  }

  it('User from org-a cannot fetch a customer that belongs to org-b by guessing its UUID', async () => {
    const prisma = prismaFor(rows);
    const repo = new CustomersRepository(prisma);

    const result = await repo.findById('c-b1', 'org-a');
    expect(result).toBeNull();
  });

  it('User from org-a only sees their tenant in the list view', async () => {
    const prisma = prismaFor(rows);
    const repo = new CustomersRepository(prisma);

    const results = await repo.all('org-a');
    const ids = results.map((c) => c.id);
    expect(ids).toEqual(['c-a1', 'c-a2']);
    expect(ids).not.toContain('c-b1');
  });

  it('User from org-b can fetch their own customer', async () => {
    const prisma = prismaFor(rows);
    const repo = new CustomersRepository(prisma);

    const result = await repo.findById('c-b1', 'org-b');
    expect(result?.id).toBe('c-b1');
  });
});

describe('Cross-tenant isolation — Carrier', () => {
  const rows = [
    { id: 'car-a1', orgId: 'org-a', name: 'Swift', archived: false },
    { id: 'car-b1', orgId: 'org-b', name: 'XPO', archived: false },
  ];

  it('User from org-a cannot fetch carrier from org-b', async () => {
    const { findFirst, findMany } = makeOrgScopedPrisma(rows);
    const prisma = { carrier: { findFirst, findMany, create: jest.fn(), update: jest.fn() } } as any;
    const repo = new CarriersRepository(prisma);

    expect(await repo.findById('car-b1', 'org-a')).toBeNull();
    expect(await repo.findById('car-b1', 'org-b')).toEqual(rows[1]);
  });
});

describe('Cross-tenant isolation — Order', () => {
  const rows = [
    { id: 'o-a1', orgId: 'org-a', customerId: 'c-a1', orderNumber: 'PO-A1', archived: false, status: 'pending' },
    { id: 'o-a2', orgId: 'org-a', customerId: 'c-a1', orderNumber: 'PO-A2', archived: false, status: 'confirmed' },
    { id: 'o-b1', orgId: 'org-b', customerId: 'c-b1', orderNumber: 'PO-B1', archived: false, status: 'pending' },
  ];

  function prismaFor() {
    const { findFirst, findMany } = makeOrgScopedPrisma(rows);
    return { order: { findFirst, findMany } } as any;
  }

  it('findById from org-a is blind to org-b orders', async () => {
    const repo = new OrdersRepository(prismaFor());
    expect(await repo.findById('o-b1', 'org-a')).toBeNull();
  });

  it('findByOrderNumber from org-a is blind to org-b orders, even with the right number', async () => {
    const repo = new OrdersRepository(prismaFor());
    expect(await repo.findByOrderNumber('PO-B1', 'org-a')).toBeNull();
  });

  it('findByCustomerId scopes by orgId — even if the customerId is shared (edge case)', async () => {
    // Hypothetical case: two tenants reusing a customer UUID. (Shouldn't
    // happen in practice but the scoping must still hold.)
    const sharedRows = [
      { id: 'o-a1', orgId: 'org-a', customerId: 'shared', orderNumber: 'A', archived: false, status: 'pending' },
      { id: 'o-b1', orgId: 'org-b', customerId: 'shared', orderNumber: 'B', archived: false, status: 'pending' },
    ];
    const { findMany } = makeOrgScopedPrisma(sharedRows);
    const prisma = { order: { findMany, findFirst: jest.fn() } } as any;
    const repo = new OrdersRepository(prisma);

    const results = await repo.findByCustomerId('shared', { orgId: 'org-a' });
    expect(results.map((o) => o.id)).toEqual(['o-a1']);
  });

  it('all() lists only the requesting tenant', async () => {
    const repo = new OrdersRepository(prismaFor());
    const results = await repo.all('org-a');
    expect(results.map((o) => o.id)).toEqual(['o-a1', 'o-a2']);
  });
});

describe('Cross-tenant isolation — Shipment', () => {
  const rows = [
    { id: 's-a1', orgId: 'org-a', archived: false, status: 'in_transit' },
    { id: 's-b1', orgId: 'org-b', archived: false, status: 'in_transit' },
  ];

  function prismaFor() {
    const { findFirst, findMany } = makeOrgScopedPrisma(rows);
    return { shipment: { findFirst, findMany, create: jest.fn(), update: jest.fn(), createMany: jest.fn(), deleteMany: jest.fn() } } as any;
  }

  it('User from org-a cannot fetch shipment from org-b by ID', async () => {
    const repo = new ShipmentsRepository(prismaFor());
    expect(await repo.findById('s-b1', 'org-a')).toBeNull();
    expect((await repo.findById('s-b1', 'org-b'))?.id).toBe('s-b1');
  });

  it('all() returns only the requesting tenant', async () => {
    const repo = new ShipmentsRepository(prismaFor());
    const results = await repo.all('org-a');
    expect(results.map((s) => s.id)).toEqual(['s-a1']);
  });

  it('passing no orgId reverts to legacy/admin behaviour (returns everything not archived)', async () => {
    const repo = new ShipmentsRepository(prismaFor());
    const results = await repo.all();
    expect(results.map((s) => s.id).sort()).toEqual(['s-a1', 's-b1']);
  });
});

describe('orgId omission behaviour — defence in depth', () => {
  // The repos accept `undefined` orgId so seed scripts and admin tools
  // can fetch across tenants. This batch of tests pins that contract so
  // a future refactor can't silently change it.
  const rows = [
    { id: 's-a1', orgId: 'org-a', archived: false, status: 'draft' },
    { id: 's-b1', orgId: 'org-b', archived: false, status: 'draft' },
  ];

  it('Shipment.findById with no orgId reaches both tenants', async () => {
    const { findFirst } = makeOrgScopedPrisma(rows);
    const prisma = { shipment: { findFirst, findMany: jest.fn(), create: jest.fn(), update: jest.fn(), createMany: jest.fn(), deleteMany: jest.fn() } } as any;
    const repo = new ShipmentsRepository(prisma);

    expect((await repo.findById('s-a1'))?.id).toBe('s-a1');
    expect((await repo.findById('s-b1'))?.id).toBe('s-b1');
  });

  it('Customer.findById with empty-string orgId behaves like omitted (does NOT scope)', async () => {
    const { findFirst, findMany } = makeOrgScopedPrisma([
      { id: 'c-a1', orgId: 'org-a', name: 'Acme', archived: false },
      { id: 'c-b1', orgId: 'org-b', name: 'X', archived: false },
    ]);
    const prisma = { customer: { findFirst, findMany, create: jest.fn(), update: jest.fn() } } as any;
    const repo = new CustomersRepository(prisma);

    // Empty-string orgId is treated as "not supplied" because the repo
    // uses truthy check (`if (orgId)`), so cross-tenant rows are reachable.
    expect((await repo.findById('c-b1', ''))?.id).toBe('c-b1');
  });
});
