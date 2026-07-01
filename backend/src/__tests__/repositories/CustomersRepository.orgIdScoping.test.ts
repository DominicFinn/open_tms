/**
 * Repository-level guardrails for the multi-tenancy work in phase 1 of
 * the remediation plan. These tests pin the behaviour I want: passing
 * orgId must always filter by it; omitting orgId must NOT scope (so
 * legacy/admin callers can still reach NULL-orgId rows).
 */

import { CustomersRepository } from '../../repositories/CustomersRepository';
import { CarriersRepository } from '../../repositories/CarriersRepository';
import { OrdersRepository } from '../../repositories/OrdersRepository';

function customerPrisma() {
  return {
    customer: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    },
  } as any;
}

function carrierPrisma() {
  return {
    carrier: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    },
  } as any;
}

function orderPrisma() {
  return {
    order: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
  } as any;
}

describe('CustomersRepository orgId scoping', () => {
  it('all() scopes by orgId when supplied', async () => {
    const prisma = customerPrisma();
    const repo = new CustomersRepository(prisma);
    await repo.all('org-1');
    expect(prisma.customer.findMany.mock.calls[0][0].where).toEqual({
      archived: false,
      orgId: 'org-1',
    });
  });

  it('all() omits orgId from the where clause when none supplied', async () => {
    const prisma = customerPrisma();
    const repo = new CustomersRepository(prisma);
    await repo.all();
    expect(prisma.customer.findMany.mock.calls[0][0].where).toEqual({ archived: false });
  });

  it('findById() scopes by orgId so cross-tenant ID guesses return null', async () => {
    const prisma = customerPrisma();
    const repo = new CustomersRepository(prisma);
    await repo.findById('cust-1', 'org-1');
    expect(prisma.customer.findFirst.mock.calls[0][0].where).toEqual({
      id: 'cust-1',
      archived: false,
      orgId: 'org-1',
    });
  });

  it('findById() with no orgId reads cross-tenant (legacy/admin caller)', async () => {
    const prisma = customerPrisma();
    const repo = new CustomersRepository(prisma);
    await repo.findById('cust-1');
    expect(prisma.customer.findFirst.mock.calls[0][0].where).toEqual({
      id: 'cust-1',
      archived: false,
    });
  });

  it('create() writes the supplied orgId onto the row', async () => {
    const prisma = customerPrisma();
    const repo = new CustomersRepository(prisma);
    await repo.create({ orgId: 'org-1', name: 'Acme', contactEmail: 'jane@acme.com' });
    expect(prisma.customer.create).toHaveBeenCalledWith({
      data: { orgId: 'org-1', name: 'Acme', contactEmail: 'jane@acme.com' },
    });
  });

  it('create() requires an orgId post phase-2 tightening', async () => {
    const prisma = customerPrisma();
    const repo = new CustomersRepository(prisma);
    // CreateCustomerDTO.orgId is required (string, NOT NULL) since phase 2.
    // Passing one through still works end-to-end.
    await repo.create({ orgId: 'org-1', name: 'Acme' });
    expect(prisma.customer.create.mock.calls[0][0].data.orgId).toBe('org-1');
  });
});

describe('CarriersRepository orgId scoping', () => {
  it('all() scopes by orgId when supplied', async () => {
    const prisma = carrierPrisma();
    const repo = new CarriersRepository(prisma);
    await repo.all('org-1');
    expect(prisma.carrier.findMany.mock.calls[0][0].where).toEqual({
      deletedAt: null,
      archived: false,
      orgId: 'org-1',
    });
  });

  it('findById() guards against cross-tenant ID guessing', async () => {
    const prisma = carrierPrisma();
    const repo = new CarriersRepository(prisma);
    await repo.findById('car-1', 'org-1');
    expect(prisma.carrier.findFirst.mock.calls[0][0].where).toEqual({
      id: 'car-1',
      deletedAt: null,
      orgId: 'org-1',
    });
  });

  it('omits orgId when caller passes none — preserves legacy admin behaviour', async () => {
    const prisma = carrierPrisma();
    const repo = new CarriersRepository(prisma);
    await repo.findById('car-1');
    expect(prisma.carrier.findFirst.mock.calls[0][0].where).toEqual({
      id: 'car-1',
      deletedAt: null,
    });
  });
});

describe('OrdersRepository orgId scoping', () => {
  it('all() scopes by orgId when supplied', async () => {
    const prisma = orderPrisma();
    const repo = new OrdersRepository(prisma);
    await repo.all('org-1');
    expect(prisma.order.findMany.mock.calls[0][0].where).toEqual({
      archived: false,
      orgId: 'org-1',
    });
  });

  it('findByCustomerId() composes orgId + customerId + status filters', async () => {
    const prisma = orderPrisma();
    const repo = new OrdersRepository(prisma);
    await repo.findByCustomerId('cust-1', { orgId: 'org-1', status: 'confirmed' });
    const where = prisma.order.findMany.mock.calls[0][0].where;
    expect(where.orgId).toBe('org-1');
    expect(where.customerId).toBe('cust-1');
    expect(where.status).toBe('confirmed');
    expect(where.archived).toBe(false);
  });

  it('findById() scopes by orgId so cross-tenant guesses return null', async () => {
    const prisma = orderPrisma();
    const repo = new OrdersRepository(prisma);
    await repo.findById('o-1', 'org-1');
    expect(prisma.order.findFirst.mock.calls[0][0].where).toEqual({
      id: 'o-1',
      archived: false,
      orgId: 'org-1',
    });
  });

  it('findByOrderNumber() also enforces orgId when supplied', async () => {
    const prisma = orderPrisma();
    const repo = new OrdersRepository(prisma);
    await repo.findByOrderNumber('PO-1234', 'org-1');
    expect(prisma.order.findFirst.mock.calls[0][0].where).toEqual({
      orderNumber: 'PO-1234',
      archived: false,
      orgId: 'org-1',
    });
  });
});
