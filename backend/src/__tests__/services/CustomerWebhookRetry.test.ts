import { CustomerWebhookDeliveryService } from '../../services/webhooks/CustomerWebhookDeliveryService';

function makePrisma(overrides: any = {}) {
  return {
    customerWebhookDelivery: {
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
    },
    customerWebhook: { update: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn().mockImplementation(async (ops: Promise<any>[]) => Promise.all(ops)),
    ...overrides,
  } as any;
}

describe('CustomerWebhookDeliveryService.findEligibleForRetry', () => {
  const now = new Date('2026-04-20T12:00:00.000Z');

  function row(minutesAgo: number, attemptCount: number) {
    return {
      id: `del-${attemptCount}`,
      attemptCount,
      createdAt: new Date(now.getTime() - minutesAgo * 60_000),
    };
  }

  it('returns empty when no failed deliveries exist', async () => {
    const prisma = makePrisma();
    prisma.customerWebhookDelivery.findMany.mockResolvedValue([]);
    const svc = new CustomerWebhookDeliveryService(prisma);
    expect(await svc.findEligibleForRetry(5, now)).toEqual([]);
  });

  it('attempt 1 waits 2 minutes before eligible', async () => {
    const prisma = makePrisma();
    prisma.customerWebhookDelivery.findMany.mockResolvedValue([
      row(1, 1),  // 1 min ago - not yet
      row(3, 1),  // 3 min ago - eligible
    ]);
    const svc = new CustomerWebhookDeliveryService(prisma);
    const eligible = await svc.findEligibleForRetry(5, now);
    expect(eligible.map(e => e.id)).toEqual(['del-1']);
  });

  it('attempt 2 waits 4 minutes', async () => {
    const prisma = makePrisma();
    prisma.customerWebhookDelivery.findMany.mockResolvedValue([
      row(3, 2),  // 3 min - no
      row(5, 2),  // 5 min - yes
    ]);
    const svc = new CustomerWebhookDeliveryService(prisma);
    const eligible = await svc.findEligibleForRetry(5, now);
    expect(eligible.map(e => e.attemptCount)).toEqual([2]);
    expect(eligible).toHaveLength(1);
  });

  it('attempt 3 waits 8 minutes', async () => {
    const prisma = makePrisma();
    prisma.customerWebhookDelivery.findMany.mockResolvedValue([
      row(7, 3),  // 7 min - no
      row(10, 3), // 10 min - yes
    ]);
    const svc = new CustomerWebhookDeliveryService(prisma);
    const eligible = await svc.findEligibleForRetry(5, now);
    expect(eligible).toHaveLength(1);
  });

  it('caps backoff at 30 minutes for attempts >= 5', async () => {
    const prisma = makePrisma();
    prisma.customerWebhookDelivery.findMany.mockResolvedValue([
      row(29, 10), // 29 min - no
      row(31, 10), // 31 min - yes (but won't be eligible if attemptCount >= maxAttempts)
    ]);
    const svc = new CustomerWebhookDeliveryService(prisma);
    // With max 5 attempts, attemptCount 10 is excluded by where clause anyway,
    // but verify the backoff math directly with maxAttempts generous
    const eligible = await svc.findEligibleForRetry(50, now);
    // Both attemptCount=10, backoff = min(30, 2^10) = 30 min
    expect(eligible.map(e => e.id)).toEqual(['del-10']); // only the 31-minute-old one
  });

  it('respects maxAttempts in the query', async () => {
    const prisma = makePrisma();
    const svc = new CustomerWebhookDeliveryService(prisma);
    await svc.findEligibleForRetry(3, now);
    expect(prisma.customerWebhookDelivery.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'failed',
          attemptCount: { lt: 3 },
        }),
      }),
    );
  });
});

describe('CustomerWebhookDeliveryService.retry', () => {
  const webhook = {
    id: 'hook-1', customerId: 'cust-1', orgId: 'org-1',
    name: 'retry-target', url: 'https://example.com/hook', secret: 'whsec_test',
    enabled: true, events: ['*'], description: null,
    lastDeliveryAt: null, lastStatusCode: null,
    deliveryCount: 5, failureCount: 1,
    createdAt: new Date(), updatedAt: new Date(),
  };

  function prismaWithDelivery(overrides: any = {}) {
    return makePrisma({
      customerWebhookDelivery: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'del-1', webhookId: webhook.id, webhook,
          eventType: 'rma.authorized', eventId: 'evt-1',
          payload: { event: 'rma.authorized', data: { rmaNumber: 'R-1' } },
          status: 'failed', attemptCount: 1,
          createdAt: new Date('2026-04-20T10:00:00.000Z'),
          ...overrides.delivery,
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      ...overrides,
    });
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('succeeds on retry when endpoint now responds 200', async () => {
    jest.spyOn(global, 'fetch' as any).mockResolvedValue(new Response('ok', { status: 200 }) as any);
    const prisma = prismaWithDelivery();
    const svc = new CustomerWebhookDeliveryService(prisma);

    const r = await svc.retry('del-1');

    expect(r.status).toBe('delivered');
    expect(r.statusCode).toBe(200);
    expect(prisma.customerWebhookDelivery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'del-1' },
        data: expect.objectContaining({
          status: 'delivered',
          statusCode: 200,
          attemptCount: { increment: 1 },
        }),
      }),
    );
  });

  it('increments attemptCount and keeps failed when endpoint still errors', async () => {
    jest.spyOn(global, 'fetch' as any).mockResolvedValue(new Response('server error', { status: 500 }) as any);
    const prisma = prismaWithDelivery();
    const svc = new CustomerWebhookDeliveryService(prisma);

    const r = await svc.retry('del-1');

    expect(r.status).toBe('failed');
    expect(r.statusCode).toBe(500);
    expect(prisma.customerWebhookDelivery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'failed', attemptCount: { increment: 1 } }),
      }),
    );
  });

  it('sets X-OpenTms-Retry header with the current attempt number', async () => {
    const mockFetch = jest.spyOn(global, 'fetch' as any).mockResolvedValue(new Response('ok', { status: 200 }) as any);
    const prisma = prismaWithDelivery({ delivery: { attemptCount: 3 } });
    const svc = new CustomerWebhookDeliveryService(prisma);

    await svc.retry('del-1');

    const call = mockFetch.mock.calls[0][1] as any;
    expect(call.headers['X-OpenTms-Retry']).toBe('3');
    expect(call.headers['X-OpenTms-Signature']).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/);
  });

  it('returns early when delivery is already delivered (idempotent)', async () => {
    const prisma = prismaWithDelivery({ delivery: { status: 'delivered', statusCode: 200 } });
    const mockFetch = jest.spyOn(global, 'fetch' as any);
    const svc = new CustomerWebhookDeliveryService(prisma);

    const r = await svc.retry('del-1');
    expect(r.status).toBe('delivered');
    expect(r.statusCode).toBe(200);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(prisma.customerWebhookDelivery.update).not.toHaveBeenCalled();
  });

  it('throws when delivery does not exist', async () => {
    const prisma = makePrisma();
    prisma.customerWebhookDelivery.findUnique.mockResolvedValue(null);
    const svc = new CustomerWebhookDeliveryService(prisma);
    await expect(svc.retry('missing')).rejects.toThrow(/not found/);
  });

  it('records fetch errors as failed with errorMessage', async () => {
    jest.spyOn(global, 'fetch' as any).mockRejectedValue(new Error('ECONNREFUSED'));
    const prisma = prismaWithDelivery();
    const svc = new CustomerWebhookDeliveryService(prisma);

    const r = await svc.retry('del-1');

    expect(r.status).toBe('failed');
    expect(prisma.customerWebhookDelivery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ errorMessage: expect.stringMatching(/ECONNREFUSED/) }),
      }),
    );
  });
});
