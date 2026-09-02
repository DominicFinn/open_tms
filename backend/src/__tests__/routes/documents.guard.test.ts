/**
 * Document generation permission guard tests (#181, #211).
 *
 * `rate_confirmation:generate` was defined and restricted to
 * dispatcher/broker_admin/broker_agent roles, but neither the sync nor
 * async rate-confirmation route ever enforced it — any authenticated user
 * (including a warehouse-role account with no financial permissions)
 * could generate a margin-sensitive, carrier-facing document.
 *
 * The same gap existed for `documents:generate` (BOL, labels, customs form):
 * the permission is defined and deliberately withheld from the `warehouse`
 * and `readonly` roles, but none of the six generate routes ever enforced
 * it. These tests register the real plugin and assert the guard is now
 * applied to every one of them.
 */

import Fastify from 'fastify';

const readyShipment = {
  id: '33333333-3333-3333-3333-333333333333',
  originId: 'loc-1',
  destinationId: 'loc-2',
  orderShipments: [
    { order: { lineItems: [{ description: 'Pallet of widgets', quantity: 1, weight: 100 }] } },
  ],
};

const stub = {
  all: jest.fn().mockResolvedValue([]),
  generateRateConfirmation: jest.fn().mockResolvedValue({ id: 'doc-1', fileName: 'rate-confirmation.pdf' }),
  generateBOL: jest.fn().mockResolvedValue({ id: 'doc-bol-1', fileName: 'BOL-1.pdf' }),
  generateLabels: jest.fn().mockResolvedValue({ id: 'doc-label-1', fileName: 'Labels-1.pdf' }),
  generateCustomsForm: jest.fn().mockResolvedValue({ id: 'doc-customs-1', fileName: 'Customs-1.pdf' }),
  publish: jest.fn().mockResolvedValue('job-1'),
  shipment: { findUnique: jest.fn().mockResolvedValue(readyShipment) },
};

jest.mock('../../di/container.js', () => ({
  container: { resolve: jest.fn(() => stub) },
}));
jest.mock('../../di/tokens.js', () => ({
  TOKENS: new Proxy({}, { get: (_t, prop) => Symbol.for(String(prop)) }),
}));

import { documentRoutes } from '../../routes/documents';

beforeEach(() => {
  jest.clearAllMocks();
  stub.shipment.findUnique.mockResolvedValue(readyShipment);
});

async function buildApp(permissions: string[]) {
  const app = Fastify();
  app.addHook('preHandler', async (req) => {
    (req as any).user = { sub: 'u-1', email: 'u@test.com', organizationId: 'org-1', roles: ['x'], permissions };
  });
  await app.register(documentRoutes);
  return app;
}

describe('rate confirmation route guards', () => {
  it('a role without rate_confirmation:generate gets 403 on the sync endpoint', async () => {
    const app = await buildApp(['wms:read', 'wms:write']);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/documents/rate-confirmation',
      payload: { shipmentId: 'ship-1' },
    });
    expect(res.statusCode).toBe(403);
    expect(stub.generateRateConfirmation).not.toHaveBeenCalled();
    await app.close();
  });

  it('a role without rate_confirmation:generate gets 403 on the async endpoint', async () => {
    const app = await buildApp(['wms:read', 'wms:write']);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/documents/rate-confirmation/async',
      payload: { shipmentId: '11111111-1111-1111-1111-111111111111' },
    });
    expect(res.statusCode).toBe(403);
    expect(stub.publish).not.toHaveBeenCalled();
    await app.close();
  });

  it('rate_confirmation:generate can call the sync endpoint', async () => {
    const app = await buildApp(['rate_confirmation:generate']);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/documents/rate-confirmation',
      payload: { shipmentId: 'ship-1' },
    });
    expect(res.statusCode).toBe(201);
    expect(stub.generateRateConfirmation).toHaveBeenCalledWith('ship-1');
    await app.close();
  });

  it('rate_confirmation:generate can call the async endpoint', async () => {
    const app = await buildApp(['rate_confirmation:generate']);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/documents/rate-confirmation/async',
      payload: { shipmentId: '11111111-1111-1111-1111-111111111111' },
    });
    expect(res.statusCode).toBe(202);
    expect(stub.publish).toHaveBeenCalled();
    await app.close();
  });

  it('the broker:* wildcard also satisfies the guard', async () => {
    const app = await buildApp(['rate_confirmation:*']);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/documents/rate-confirmation',
      payload: { shipmentId: 'ship-1' },
    });
    expect(res.statusCode).toBe(201);
    await app.close();
  });
});

describe('BOL / labels / customs form route guards', () => {
  const noPermission = ['documents:read']; // e.g. the warehouse or readonly role

  it('a role without documents:generate gets 403 generating a BOL (sync)', async () => {
    const app = await buildApp(noPermission);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/documents/generate/bol',
      payload: { shipmentId: readyShipment.id },
    });
    expect(res.statusCode).toBe(403);
    expect(stub.generateBOL).not.toHaveBeenCalled();
    await app.close();
  });

  it('a role without documents:generate gets 403 generating a BOL (async)', async () => {
    const app = await buildApp(noPermission);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/documents/generate/bol/async',
      payload: { shipmentId: readyShipment.id },
    });
    expect(res.statusCode).toBe(403);
    expect(stub.publish).not.toHaveBeenCalled();
    await app.close();
  });

  it('a role without documents:generate gets 403 generating labels (sync)', async () => {
    const app = await buildApp(noPermission);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/documents/generate/labels',
      payload: { orderId: '22222222-2222-2222-2222-222222222222' },
    });
    expect(res.statusCode).toBe(403);
    expect(stub.generateLabels).not.toHaveBeenCalled();
    await app.close();
  });

  it('a role without documents:generate gets 403 generating labels (async)', async () => {
    const app = await buildApp(noPermission);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/documents/generate/labels/async',
      payload: { orderId: '22222222-2222-2222-2222-222222222222' },
    });
    expect(res.statusCode).toBe(403);
    expect(stub.publish).not.toHaveBeenCalled();
    await app.close();
  });

  it('a role without documents:generate gets 403 generating a customs form (sync)', async () => {
    const app = await buildApp(noPermission);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/documents/generate/customs',
      payload: { shipmentId: readyShipment.id },
    });
    expect(res.statusCode).toBe(403);
    expect(stub.generateCustomsForm).not.toHaveBeenCalled();
    await app.close();
  });

  it('a role without documents:generate gets 403 generating a customs form (async)', async () => {
    const app = await buildApp(noPermission);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/documents/generate/customs/async',
      payload: { shipmentId: readyShipment.id },
    });
    expect(res.statusCode).toBe(403);
    expect(stub.publish).not.toHaveBeenCalled();
    await app.close();
  });

  it('documents:generate can generate a BOL, labels, and a customs form', async () => {
    const app = await buildApp(['documents:generate']);

    const bol = await app.inject({
      method: 'POST',
      url: '/api/v1/documents/generate/bol',
      payload: { shipmentId: readyShipment.id },
    });
    expect(bol.statusCode).toBe(201);
    expect(stub.generateBOL).toHaveBeenCalledWith(readyShipment.id, undefined);

    const labels = await app.inject({
      method: 'POST',
      url: '/api/v1/documents/generate/labels',
      payload: { orderId: '22222222-2222-2222-2222-222222222222' },
    });
    expect(labels.statusCode).toBe(201);
    expect(stub.generateLabels).toHaveBeenCalled();

    const customs = await app.inject({
      method: 'POST',
      url: '/api/v1/documents/generate/customs',
      payload: { shipmentId: readyShipment.id },
    });
    expect(customs.statusCode).toBe(201);
    expect(stub.generateCustomsForm).toHaveBeenCalled();

    await app.close();
  });

  it('documents:* (e.g. dispatcher/broker_admin) satisfies the guard', async () => {
    const app = await buildApp(['documents:*']);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/documents/generate/customs',
      payload: { shipmentId: readyShipment.id },
    });
    expect(res.statusCode).toBe(201);
    await app.close();
  });
});

describe('BOL/customs form share the cargo-readiness gate (#150)', () => {
  const notReadyShipment = {
    id: readyShipment.id,
    originId: 'loc-1',
    destinationId: 'loc-2',
    orderShipments: [], // no orders attached — nothing to declare
  };

  it('refuses to generate a customs form (sync) when the shipment has no cargo detail', async () => {
    stub.shipment.findUnique.mockResolvedValueOnce(notReadyShipment);
    const app = await buildApp(['documents:generate']);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/documents/generate/customs',
      payload: { shipmentId: readyShipment.id },
    });
    expect(res.statusCode).toBe(400);
    expect((res.json() as any).error).toContain('Cannot generate customs form');
    expect(stub.generateCustomsForm).not.toHaveBeenCalled();
    await app.close();
  });

  it('refuses to enqueue a customs form (async) when the shipment has no cargo detail', async () => {
    stub.shipment.findUnique.mockResolvedValueOnce(notReadyShipment);
    const app = await buildApp(['documents:generate']);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/documents/generate/customs/async',
      payload: { shipmentId: readyShipment.id },
    });
    expect(res.statusCode).toBe(400);
    expect((res.json() as any).error).toContain('Cannot generate customs form');
    expect(stub.publish).not.toHaveBeenCalled();
    await app.close();
  });

  it('returns 404 when the shipment does not exist', async () => {
    stub.shipment.findUnique.mockResolvedValueOnce(null);
    const app = await buildApp(['documents:generate']);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/documents/generate/customs',
      payload: { shipmentId: readyShipment.id },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('still generates the customs form when cargo detail is complete', async () => {
    const app = await buildApp(['documents:generate']);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/documents/generate/customs',
      payload: { shipmentId: readyShipment.id },
    });
    expect(res.statusCode).toBe(201);
    expect(stub.generateCustomsForm).toHaveBeenCalled();
    await app.close();
  });
});
