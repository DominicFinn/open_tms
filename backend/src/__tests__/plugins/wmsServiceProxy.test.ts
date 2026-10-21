import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import wmsServiceProxy, { isPortedToWmsService } from '../../plugins/wmsServiceProxy';

describe('wmsServiceProxy', () => {
  describe('isPortedToWmsService', () => {
    it.each([
      ['GET', '/api/v1/facilities'],
      ['GET', '/api/v1/facilities?perPage=100'],
      ['GET', '/api/v1/facilities/3f1c9a52-0b7e-4a57-9f55-1d0c2f6b2e10'],
    ])('forwards %s %s', (method, url) => {
      expect(isPortedToWmsService(method, url)).toBe(true);
    });

    it.each([
      ['POST', '/api/v1/facilities'],
      ['PUT', '/api/v1/facilities/abc'],
      ['POST', '/api/v1/facilities/abc/archive'],
      ['GET', '/api/v1/facilities/abc/archive'],
      ['GET', '/api/v1/facilitiesx'],
      ['GET', '/api/v1/shipments'],
    ])('keeps %s %s on Node', (method, url) => {
      expect(isPortedToWmsService(method, url)).toBe(false);
    });
  });

  describe('forwarding', () => {
    let upstream: FastifyInstance;
    let upstreamUrl: string;
    let seenAuthorization: string | undefined;

    beforeAll(async () => {
      upstream = Fastify();
      upstream.get('/api/v1/facilities', async (req) => {
        seenAuthorization = req.headers.authorization;
        return { data: [{ id: 'from-dotnet' }], meta: { page: 1, perPage: 50, total: 1 }, error: null };
      });
      upstreamUrl = await upstream.listen({ port: 0, host: '127.0.0.1' });
    });

    afterAll(async () => {
      await upstream.close();
    });

    async function nodeApp(baseUrl: string | undefined): Promise<FastifyInstance> {
      const app = Fastify();
      await app.register(cors, { origin: true });
      await app.register(wmsServiceProxy, { baseUrl });
      app.get('/api/v1/facilities', async () => ({ data: [{ id: 'from-node' }], error: null }));
      app.post('/api/v1/facilities', async () => ({ data: { id: 'created-by-node' }, error: null }));
      await app.ready();
      return app;
    }

    it('serves a ported route from the .NET service, passing the token through', async () => {
      const app = await nodeApp(upstreamUrl);
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/facilities?perPage=100',
        headers: { authorization: 'Bearer token-1', origin: 'http://localhost:5173' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data[0].id).toBe('from-dotnet');
      expect(seenAuthorization).toBe('Bearer token-1');
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
      await app.close();
    });

    it('leaves routes that are not ported on Node', async () => {
      const app = await nodeApp(upstreamUrl);
      const res = await app.inject({ method: 'POST', url: '/api/v1/facilities', payload: {} });

      expect(res.json().data.id).toBe('created-by-node');
      await app.close();
    });

    it('serves everything from Node when no service URL is set', async () => {
      const app = await nodeApp(undefined);
      const res = await app.inject({ method: 'GET', url: '/api/v1/facilities' });

      expect(res.json().data[0].id).toBe('from-node');
      await app.close();
    });

    it('answers 502 in the envelope when the service is down', async () => {
      const app = await nodeApp('http://127.0.0.1:1');
      const res = await app.inject({ method: 'GET', url: '/api/v1/facilities' });

      expect(res.statusCode).toBe(502);
      expect(res.json()).toEqual({ data: null, error: 'WMS service unavailable' });
      await app.close();
    });
  });
});
