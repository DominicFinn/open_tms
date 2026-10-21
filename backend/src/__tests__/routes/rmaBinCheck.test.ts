/**
 * The RMA receive and inspect routes check a named bin exists in the caller's org before dispatching,
 * through the warehouse's IBinDirectory port, since the commands no longer read bins (#359).
 */

import Fastify from 'fastify';

const mockDeps: { bus: any; bins: any } = { bus: null, bins: null };

jest.mock('../../di/index.js', () => ({
  container: {
    resolve: jest.fn((token: symbol) => {
      const name = Symbol.keyFor(token);
      if (name === 'ICommandBus') return mockDeps.bus;
      if (name === 'IBinDirectory') return mockDeps.bins;
      return {};
    }),
  },
  TOKENS: new Proxy({}, { get: (_t, prop) => Symbol.for(String(prop)) }),
}));

import { rmaRoutes } from '../../routes/rma.js';

const ORG = 'org-a';
const BIN = '00000000-0000-4000-8000-0000000000b1';
const LINE = '00000000-0000-4000-8000-0000000000c1';

async function buildApp(binExists: boolean) {
  mockDeps.bus = { dispatch: jest.fn().mockResolvedValue({ success: true, data: { lineId: LINE }, events: [] }) };
  mockDeps.bins = { binExists: jest.fn().mockResolvedValue(binExists) };
  const app = Fastify();
  app.decorate('prisma', {} as any);
  app.addHook('onRequest', async (req) => {
    (req as any).user = { sub: 'user-a', permissions: ['*'], organizationId: ORG };
    (req as any).orgId = ORG;
  });
  await app.register(rmaRoutes);
  await app.ready();
  return app;
}

describe('RMA routes: bin check before dispatch', () => {
  it.each([
    ['receive', `/api/v1/rma-lines/${LINE}/receive`, { receivedQuantity: 1, quarantineBinId: BIN }],
    ['inspect', `/api/v1/rma-lines/${LINE}/inspect`, { inspectionStatus: 'pass', disposition: 'restock', routeToBinId: BIN }],
  ])('%s refuses a bin that is not in the org with 404, dispatching nothing', async (_label, url, payload) => {
    const app = await buildApp(false);

    const res = await app.inject({ method: 'POST', url, payload });

    expect(res.statusCode).toBe(404);
    expect(mockDeps.bins.binExists).toHaveBeenCalledWith(ORG, BIN);
    expect(mockDeps.bus.dispatch).not.toHaveBeenCalled();
    await app.close();
  });

  it('dispatches when the bin is in the org', async () => {
    const app = await buildApp(true);

    const res = await app.inject({ method: 'POST', url: `/api/v1/rma-lines/${LINE}/receive`, payload: { receivedQuantity: 1, quarantineBinId: BIN } });

    expect(res.statusCode).toBe(200);
    expect(mockDeps.bus.dispatch).toHaveBeenCalledWith(expect.objectContaining({ orgId: ORG }));
    await app.close();
  });

  it('does not ask about a bin when none is named', async () => {
    const app = await buildApp(false);

    await app.inject({ method: 'POST', url: `/api/v1/rma-lines/${LINE}/receive`, payload: { receivedQuantity: 1 } });

    expect(mockDeps.bins.binExists).not.toHaveBeenCalled();
    expect(mockDeps.bus.dispatch).toHaveBeenCalled();
    await app.close();
  });
});
