/**
 * Coverage for the tracking-integration status included in
 * GET /api/v1/shipments/:shipmentId/carrier-tracking (#179).
 *
 * The route previously returned only the events array, so the frontend
 * had no way to distinguish "no tracking integration configured" from
 * "integration exists but hasn't reported anything yet".
 */

import Fastify from 'fastify';

jest.mock('../../di/index.js', () => {
  const { TOKENS } = jest.requireActual('../../di/tokens.js');
  return {
    container: { resolve: jest.fn() },
    TOKENS,
  };
});

import { container, TOKENS } from '../../di/index.js';
import { carrierTrackingRoutes } from '../../routes/carrierTracking.js';

function buildApp(opts: {
  shipment: { carrierId: string | null } | null;
  integration: { status: string } | null;
  events?: any[];
}) {
  const integrationRepo = {
    findByCarrierId: jest.fn().mockResolvedValue(opts.integration),
  };
  const shipmentsRepo = {
    findById: jest.fn().mockResolvedValue(opts.shipment),
  };

  (container.resolve as jest.Mock).mockImplementation((token: symbol) => {
    switch (token) {
      case TOKENS.ICarrierTrackingIntegrationRepository:
        return integrationRepo;
      case TOKENS.IShipmentsRepository:
        return shipmentsRepo;
      default:
        return {};
    }
  });

  const app = Fastify();
  app.decorate('prisma', {
    carrierTrackingEvent: {
      findMany: jest.fn().mockResolvedValue(opts.events ?? []),
    },
  } as any);

  return app;
}

describe('GET /api/v1/shipments/:shipmentId/carrier-tracking — tracking status', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reports hasIntegration:false when the carrier has no integration row', async () => {
    const app = buildApp({ shipment: { carrierId: 'carrier-1' }, integration: null });
    await app.register(carrierTrackingRoutes);

    const res = await app.inject({ method: 'GET', url: '/api/v1/shipments/ship-1/carrier-tracking' });
    const body = JSON.parse(res.body);

    expect(body.data.tracking).toEqual({ hasCarrier: true, hasIntegration: false, integrationStatus: null });
    await app.close();
  });

  it('reports hasCarrier:false when the shipment has no carrier assigned', async () => {
    const app = buildApp({ shipment: { carrierId: null }, integration: null });
    await app.register(carrierTrackingRoutes);

    const res = await app.inject({ method: 'GET', url: '/api/v1/shipments/ship-1/carrier-tracking' });
    const body = JSON.parse(res.body);

    expect(body.data.tracking).toEqual({ hasCarrier: false, hasIntegration: false, integrationStatus: null });
    await app.close();
  });

  it('surfaces the integration status when one exists', async () => {
    const app = buildApp({ shipment: { carrierId: 'carrier-1' }, integration: { status: 'pending_setup' } });
    await app.register(carrierTrackingRoutes);

    const res = await app.inject({ method: 'GET', url: '/api/v1/shipments/ship-1/carrier-tracking' });
    const body = JSON.parse(res.body);

    expect(body.data.tracking).toEqual({ hasCarrier: true, hasIntegration: true, integrationStatus: 'pending_setup' });
    await app.close();
  });

  it('still returns the events array under data.events', async () => {
    const events = [{ id: 'ev-1', status: 'in_transit' }];
    const app = buildApp({ shipment: { carrierId: 'carrier-1' }, integration: { status: 'active' }, events });
    await app.register(carrierTrackingRoutes);

    const res = await app.inject({ method: 'GET', url: '/api/v1/shipments/ship-1/carrier-tracking' });
    const body = JSON.parse(res.body);

    expect(body.data.events).toEqual(events);
    await app.close();
  });
});
