/**
 * Phase 1 of the multi-tenancy plan: every Create* command for the core
 * entities must persist orgId on first write. These tests pin the
 * payload→DB plumbing so a future refactor can't silently drop it.
 */

import { CreateCustomerCommandHandler, CREATE_CUSTOMER } from '../../commands/customers/CreateCustomerCommand';
import { CreateCarrierCommandHandler, CREATE_CARRIER } from '../../commands/carriers/CreateCarrierCommand';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

function customerPrisma() {
  const tx = {
    customer: {
      create: jest.fn().mockResolvedValue({
        id: 'cust-1',
        name: 'Acme',
        contactEmail: null,
        orgId: 'test-org',
      }),
    },
    domainEventLog: { create: jest.fn().mockResolvedValue({}) },
  } as any;
  return {
    prisma: {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any,
    tx,
  };
}

function carrierPrisma() {
  const tx = {
    carrier: {
      create: jest.fn().mockResolvedValue({
        id: 'car-1',
        name: 'Swift',
        mcNumber: null,
        orgId: 'test-org',
      }),
    },
    domainEventLog: { create: jest.fn().mockResolvedValue({}) },
  } as any;
  return {
    prisma: {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any,
    tx,
  };
}

describe('CreateCustomerCommandHandler — orgId plumbing', () => {
  beforeEach(() => jest.clearAllMocks());

  it('persists the payload orgId when the route supplies it', async () => {
    const { prisma, tx } = customerPrisma();
    const { bus } = mockEventBus();
    const handler = new CreateCustomerCommandHandler(prisma, bus);

    await handler.execute(
      createTestCommand(CREATE_CUSTOMER, {
        name: 'Acme',
        contactEmail: 'jane@acme.com',
        orgId: 'org-explicit',
      })
    );

    expect(tx.customer.create).toHaveBeenCalledWith({
      data: { orgId: 'org-explicit', name: 'Acme', contactEmail: 'jane@acme.com' },
    });
  });

  it('falls back to command.orgId when the payload omits orgId', async () => {
    const { prisma, tx } = customerPrisma();
    const { bus } = mockEventBus();
    const handler = new CreateCustomerCommandHandler(prisma, bus);

    await handler.execute(createTestCommand(CREATE_CUSTOMER, { name: 'Acme' }));

    // createTestCommand sets command.orgId = 'test-org' by default
    expect(tx.customer.create.mock.calls[0][0].data.orgId).toBe('test-org');
  });

  it('fails fast when neither payload nor command supply an orgId', async () => {
    // Post phase-2 tightening Customer.orgId is NOT NULL, so the handler
    // raises rather than writing a half-built row.
    const { prisma, tx } = customerPrisma();
    const { bus } = mockEventBus();
    const handler = new CreateCustomerCommandHandler(prisma, bus);

    const result = await handler.execute({
      type: CREATE_CUSTOMER,
      orgId: '',
      actorId: null,
      payload: { name: 'Acme' },
      metadata: { correlationId: 'c-1', source: 'test' },
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/orgId is required/);
    expect(tx.customer.create).not.toHaveBeenCalled();
  });
});

describe('CreateCarrierCommandHandler — orgId plumbing', () => {
  beforeEach(() => jest.clearAllMocks());

  it('persists the payload orgId when supplied', async () => {
    const { prisma, tx } = carrierPrisma();
    const { bus } = mockEventBus();
    const handler = new CreateCarrierCommandHandler(prisma, bus);

    await handler.execute(
      createTestCommand(CREATE_CARRIER, {
        name: 'Swift',
        mcNumber: 'MC-12345',
        orgId: 'org-explicit',
      })
    );

    const data = tx.carrier.create.mock.calls[0][0].data;
    expect(data.orgId).toBe('org-explicit');
    expect(data.name).toBe('Swift');
    expect(data.mcNumber).toBe('MC-12345');
  });

  it('falls back to command.orgId when payload omits it', async () => {
    const { prisma, tx } = carrierPrisma();
    const { bus } = mockEventBus();
    const handler = new CreateCarrierCommandHandler(prisma, bus);

    await handler.execute(createTestCommand(CREATE_CARRIER, { name: 'Swift' }));

    expect(tx.carrier.create.mock.calls[0][0].data.orgId).toBe('test-org');
  });
});
