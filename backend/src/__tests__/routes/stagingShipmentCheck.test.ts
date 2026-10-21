/**
 * Creating a staging assignment that names a shipment checks it exists in the caller's org through
 * TMS's IShipmentDirectory port before dispatching, since the command no longer reads shipments (#359).
 */

import Fastify from 'fastify';

const mockDeps: { bus: any; shipments: any } = { bus: null, shipments: null };

jest.mock('../../di/index.js', () => ({
  container: {
    resolve: jest.fn((token: symbol) => {
      const name = Symbol.keyFor(token);
      if (name === 'ICommandBus') return mockDeps.bus;
      if (name === 'IShipmentDirectory') return mockDeps.shipments;
      return {};
    }),
  },
  TOKENS: new Proxy({}, { get: (_t, prop) => Symbol.for(String(prop)) }),
}));

jest.mock('../../auth/wmsGuard.js', () => ({ registerWmsGuard: jest.fn() }));

import { packingRoutes } from '../../routes/packing.js';

const ORG = 'org-a';
const body = {
  facilityId: '00000000-0000-4000-8000-0000000000f1',
  orderId: '00000000-0000-4000-8000-0000000000a1',
  trackableUnitId: '00000000-0000-4000-8000-0000000000u1'.replace('u', 'b'),
  stagingBinId: '00000000-0000-4000-8000-0000000000c1',
};

async function buildApp(shipmentExists: boolean) {
  mockDeps.bus = { dispatch: jest.fn().mockResolvedValue({ success: true, data: { id: 'sa-1' }, events: [] }) };
  mockDeps.shipments = { shipmentExists: jest.fn().mockResolvedValue(shipmentExists) };
  const app = Fastify();
  app.addHook('onRequest', async (req) => {
    (req as any).user = { sub: 'user-a', permissions: ['*'], organizationId: ORG };
    (req as any).orgId = ORG;
  });
  await app.register(packingRoutes);
  await app.ready();
  return app;
}

describe('POST /api/v1/staging: shipment check', () => {
  it('refuses a shipment not in the org with 404 and dispatches nothing', async () => {
    const app = await buildApp(false);

    const res = await app.inject({ method: 'POST', url: '/api/v1/staging', payload: { ...body, shipmentId: 'ship-other' } });

    expect(res.statusCode).toBe(404);
    expect(mockDeps.shipments.shipmentExists).toHaveBeenCalledWith(ORG, 'ship-other');
    expect(mockDeps.bus.dispatch).not.toHaveBeenCalled();
    await app.close();
  });

  it('dispatches when the shipment is in the org, or when none is named', async () => {
    const app = await buildApp(true);

    const withShipment = await app.inject({ method: 'POST', url: '/api/v1/staging', payload: { ...body, shipmentId: 'ship-1' } });
    const withoutShipment = await app.inject({ method: 'POST', url: '/api/v1/staging', payload: body });

    expect(withShipment.statusCode).toBe(201);
    expect(withoutShipment.statusCode).toBe(201);
    expect(mockDeps.shipments.shipmentExists).toHaveBeenCalledTimes(1);
    expect(mockDeps.bus.dispatch).toHaveBeenCalledTimes(2);
    await app.close();
  });
});
