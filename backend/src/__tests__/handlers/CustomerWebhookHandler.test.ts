import { CustomerWebhookHandler } from '../../events/handlers/CustomerWebhookHandler';

function makeEvent(overrides: Partial<any> = {}): any {
  return {
    id: 'evt-1',
    type: 'rma.authorized',
    orgId: 'org1',
    actorId: 'u1',
    entityType: 'rma',
    entityId: 'rma-1',
    payload: { customerId: 'cust-1', rmaNumber: 'RMA-001' },
    timestamp: new Date().toISOString(),
    metadata: { correlationId: 'c1', source: 'test', schemaVersion: 1 },
    ...overrides,
  };
}

function makePrisma(overrides: any = {}) {
  return {
    customerWebhook: { findMany: jest.fn().mockResolvedValue([]) },
    customerWebhookDelivery: {
      create: jest.fn().mockResolvedValue({ id: 'del-1' }),
      update: jest.fn().mockResolvedValue({}),
    },
    packTask: { findUnique: jest.fn() },
    order: { findUnique: jest.fn() },
    $transaction: jest.fn().mockImplementation(async (ops: Promise<any>[]) => Promise.all(ops)),
    ...overrides,
  } as any;
}

describe('CustomerWebhookHandler - subscription patterns', () => {
  const handler = new CustomerWebhookHandler(makePrisma());

  it('includes pack audit events in its subscription list', () => {
    expect(handler.eventPatterns).toContain('pack.audit_recorded');
    expect(handler.eventPatterns).toContain('pack.audit_variance_detected');
  });

  it('keeps the pre-existing RMA, order, shipment, invoice coverage', () => {
    expect(handler.eventPatterns).toContain('rma.*');
    expect(handler.eventPatterns).toContain('order.delivered');
    expect(handler.eventPatterns).toContain('shipment.delivered');
    expect(handler.eventPatterns).toContain('invoice.sent');
  });
});

describe('CustomerWebhookHandler - customerId resolution', () => {
  it('uses payload.customerId when present (rma event)', async () => {
    const hook = {
      id: 'hook-1', customerId: 'cust-1', enabled: true,
      events: ['rma.*'], url: 'https://example.com', secret: 'x',
      name: 'test', description: null, lastDeliveryAt: null,
      lastStatusCode: null, deliveryCount: 0, failureCount: 0,
      orgId: 'org1', createdAt: new Date(), updatedAt: new Date(),
    };
    const prisma = makePrisma({
      customerWebhook: { findMany: jest.fn().mockResolvedValue([hook]) },
    });
    // Mock fetch so delivery call doesn't actually run
    const mockFetch = jest.spyOn(global, 'fetch' as any).mockResolvedValue(new Response('ok', { status: 200 }) as any);

    const handler = new CustomerWebhookHandler(prisma);
    await handler.handle(makeEvent());

    expect(prisma.customerWebhook.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { customerId: 'cust-1', enabled: true } }),
    );
    mockFetch.mockRestore();
  });

  it('resolves customerId from pack task → order for pack.audit_recorded', async () => {
    const prisma = makePrisma({
      packTask: {
        findUnique: jest.fn().mockResolvedValue({ orderId: 'order-42' }),
      },
      order: {
        findUnique: jest.fn().mockResolvedValue({ customerId: 'cust-42' }),
      },
      customerWebhook: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    });

    const handler = new CustomerWebhookHandler(prisma);
    await handler.handle(makeEvent({
      type: 'pack.audit_recorded',
      entityType: 'pack_audit',
      entityId: 'audit-1',
      payload: { packTaskId: 'pt-1', verdict: 'pass' }, // no customerId
    }));

    expect(prisma.packTask.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'pt-1' }, select: { orderId: true } }),
    );
    expect(prisma.order.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'order-42' }, select: { customerId: true } }),
    );
    expect(prisma.customerWebhook.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { customerId: 'cust-42', enabled: true } }),
    );
  });

  it('skips delivery when pack task has no order', async () => {
    const prisma = makePrisma({
      packTask: { findUnique: jest.fn().mockResolvedValue(null) },
    });
    const handler = new CustomerWebhookHandler(prisma);
    await handler.handle(makeEvent({
      type: 'pack.audit_variance_detected',
      payload: { packTaskId: 'pt-missing', verdict: 'fail' },
    }));
    expect(prisma.customerWebhook.findMany).not.toHaveBeenCalled();
  });

  it('skips delivery when event has no customerId and is not a pack audit event', async () => {
    const prisma = makePrisma();
    const handler = new CustomerWebhookHandler(prisma);
    await handler.handle(makeEvent({
      type: 'unknown.event',
      payload: { something: 'else' },
    }));
    expect(prisma.customerWebhook.findMany).not.toHaveBeenCalled();
  });
});
