/**
 * Rate confirmation permission guard tests (#181).
 *
 * `rate_confirmation:generate` was defined and restricted to
 * dispatcher/broker_admin/broker_agent roles, but neither the sync nor
 * async rate-confirmation route ever enforced it — any authenticated user
 * (including a warehouse-role account with no financial permissions)
 * could generate a margin-sensitive, carrier-facing document. These tests
 * register the real plugin and assert the guard is now applied to both
 * endpoints.
 */

import Fastify from 'fastify';

const stub = {
  all: jest.fn().mockResolvedValue([]),
  generateRateConfirmation: jest.fn().mockResolvedValue({ id: 'doc-1', fileName: 'rate-confirmation.pdf' }),
  publish: jest.fn().mockResolvedValue('job-1'),
};

jest.mock('../../di/container.js', () => ({
  container: { resolve: jest.fn(() => stub) },
}));
jest.mock('../../di/tokens.js', () => ({
  TOKENS: new Proxy({}, { get: (_t, prop) => Symbol.for(String(prop)) }),
}));

import { documentRoutes } from '../../routes/documents';

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
