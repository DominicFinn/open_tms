import {
  CreateCustomerWebhookCommandHandler,
  CREATE_CUSTOMER_WEBHOOK,
} from '../../commands/customerWebhooks/CreateCustomerWebhookCommand';
import {
  UpdateCustomerWebhookCommandHandler,
  UPDATE_CUSTOMER_WEBHOOK,
} from '../../commands/customerWebhooks/UpdateCustomerWebhookCommand';
import {
  DeleteCustomerWebhookCommandHandler,
  DELETE_CUSTOMER_WEBHOOK,
} from '../../commands/customerWebhooks/DeleteCustomerWebhookCommand';
import {
  RotateWebhookSecretCommandHandler,
  ROTATE_WEBHOOK_SECRET,
} from '../../commands/customerWebhooks/RotateWebhookSecretCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

const baseHook = {
  id: 'hook-1',
  customerId: 'cust-1',
  orgId: 'test-org',
  name: 'Order updates',
  url: 'https://customer.example.com/hooks/orders',
  secret: 'whsec_old',
  enabled: true,
  events: ['order.*'],
  description: null,
};

function buildPrisma(overrides: any = {}) {
  const findResult = 'findUnique' in overrides ? overrides.findUnique : baseHook;
  const tx = {
    customerWebhook: {
      create: jest.fn().mockResolvedValue(overrides.createReturn ?? baseHook),
      findUnique: jest.fn().mockResolvedValue(findResult),
      update: jest.fn().mockResolvedValue(overrides.updateReturn ?? baseHook),
      delete: jest.fn().mockResolvedValue(baseHook),
    },
    domainEventLog: { create: jest.fn().mockResolvedValue({}) },
  } as any;
  const prisma = {
    $transaction: jest.fn((fn: Function) => fn(tx)),
    domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
  } as any;
  return { prisma, tx };
}

describe('CreateCustomerWebhookCommandHandler', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates a webhook with the supplied secret and emits CUSTOMER_WEBHOOK_CREATED', async () => {
    const { prisma, tx } = buildPrisma();
    const { bus } = mockEventBus();
    const handler = new CreateCustomerWebhookCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(CREATE_CUSTOMER_WEBHOOK, {
        customerId: 'cust-1',
        name: 'Order updates',
        url: 'https://customer.example.com/hooks/orders',
        secret: 'whsec_supplied',
        events: ['order.*'],
      })
    );

    expect(result.success).toBe(true);
    const data = tx.customerWebhook.create.mock.calls[0][0].data;
    expect(data.orgId).toBe('test-org');
    expect(data.secret).toBe('whsec_supplied');
    expect(result.events[0].type).toBe(EVENT_TYPES.CUSTOMER_WEBHOOK_CREATED);
  });

  it('does NOT include the secret in the emitted event payload', async () => {
    const { prisma } = buildPrisma();
    const { bus } = mockEventBus();
    const handler = new CreateCustomerWebhookCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(CREATE_CUSTOMER_WEBHOOK, {
        customerId: 'cust-1',
        name: 'X',
        url: 'https://x',
        secret: 'whsec_should_not_leak',
        events: ['order.*'],
      })
    );

    const payload = result.events[0].payload as any;
    expect(payload.secret).toBeUndefined();
  });
});

describe('UpdateCustomerWebhookCommandHandler', () => {
  beforeEach(() => jest.clearAllMocks());

  it('updates fields and emits CUSTOMER_WEBHOOK_UPDATED', async () => {
    const { prisma, tx } = buildPrisma();
    const { bus } = mockEventBus();
    const handler = new UpdateCustomerWebhookCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(UPDATE_CUSTOMER_WEBHOOK, {
        id: 'hook-1',
        customerId: 'cust-1',
        data: { url: 'https://new-url.example.com', enabled: false },
      })
    );

    expect(result.success).toBe(true);
    expect(tx.customerWebhook.update).toHaveBeenCalledWith({
      where: { id: 'hook-1' },
      data: { url: 'https://new-url.example.com', enabled: false },
    });
    expect(result.events[0].type).toBe(EVENT_TYPES.CUSTOMER_WEBHOOK_UPDATED);
  });

  it('blocks cross-tenant updates: webhook belongs to a different customer', async () => {
    const { prisma } = buildPrisma({
      findUnique: { ...baseHook, customerId: 'cust-other' },
    });
    const { bus } = mockEventBus();
    const handler = new UpdateCustomerWebhookCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(UPDATE_CUSTOMER_WEBHOOK, {
        id: 'hook-1',
        customerId: 'cust-1',
        data: { url: 'https://attacker.com' },
      })
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  it('fails when the webhook does not exist', async () => {
    const { prisma } = buildPrisma({ findUnique: null });
    const { bus } = mockEventBus();
    const handler = new UpdateCustomerWebhookCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(UPDATE_CUSTOMER_WEBHOOK, {
        id: 'missing',
        customerId: 'cust-1',
        data: { url: 'https://x' },
      })
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });
});

describe('DeleteCustomerWebhookCommandHandler', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deletes the webhook and emits CUSTOMER_WEBHOOK_DELETED', async () => {
    const { prisma, tx } = buildPrisma();
    const { bus } = mockEventBus();
    const handler = new DeleteCustomerWebhookCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(DELETE_CUSTOMER_WEBHOOK, { id: 'hook-1', customerId: 'cust-1' })
    );

    expect(result.success).toBe(true);
    expect(tx.customerWebhook.delete).toHaveBeenCalledWith({ where: { id: 'hook-1' } });
    expect(result.events[0].type).toBe(EVENT_TYPES.CUSTOMER_WEBHOOK_DELETED);
  });

  it('blocks cross-tenant deletes', async () => {
    const { prisma } = buildPrisma({
      findUnique: { ...baseHook, customerId: 'cust-other' },
    });
    const { bus } = mockEventBus();
    const handler = new DeleteCustomerWebhookCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(DELETE_CUSTOMER_WEBHOOK, { id: 'hook-1', customerId: 'cust-1' })
    );

    expect(result.success).toBe(false);
  });
});

describe('RotateWebhookSecretCommandHandler', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rotates to the supplied secret and returns the plaintext', async () => {
    const { prisma, tx } = buildPrisma({
      updateReturn: { ...baseHook, secret: 'whsec_new' },
    });
    const { bus } = mockEventBus();
    const handler = new RotateWebhookSecretCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(ROTATE_WEBHOOK_SECRET, {
        id: 'hook-1',
        customerId: 'cust-1',
        newSecret: 'whsec_new',
      })
    );

    expect(result.success).toBe(true);
    expect(tx.customerWebhook.update).toHaveBeenCalledWith({
      where: { id: 'hook-1' },
      data: { secret: 'whsec_new' },
    });
    expect(result.data?.secret).toBe('whsec_new');
  });

  it('does NOT include the secret in the emitted event payload', async () => {
    const { prisma } = buildPrisma({
      updateReturn: { ...baseHook, secret: 'whsec_new' },
    });
    const { bus } = mockEventBus();
    const handler = new RotateWebhookSecretCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(ROTATE_WEBHOOK_SECRET, {
        id: 'hook-1',
        customerId: 'cust-1',
        newSecret: 'whsec_secret_value',
      })
    );

    const payload = result.events[0].payload as any;
    expect(payload.secret).toBeUndefined();
    expect(payload.newSecret).toBeUndefined();
  });

  it('blocks cross-tenant rotation', async () => {
    const { prisma } = buildPrisma({
      findUnique: { ...baseHook, customerId: 'cust-other' },
    });
    const { bus } = mockEventBus();
    const handler = new RotateWebhookSecretCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(ROTATE_WEBHOOK_SECRET, {
        id: 'hook-1',
        customerId: 'cust-1',
        newSecret: 'attacker_secret',
      })
    );

    expect(result.success).toBe(false);
  });
});
