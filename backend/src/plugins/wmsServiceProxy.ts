/**
 * Routes ported to the FinnWMS .NET service (ADR 0004, #352).
 *
 * When WMS_SERVICE_URL is set, requests matching PORTED_ROUTES are forwarded to services/wms
 * before any Node hook or handler runs. The .NET service authenticates the same JWT and resolves
 * the tenant itself, so nothing is checked twice. The Node implementations stay registered:
 * unsetting WMS_SERVICE_URL routes everything back to them.
 *
 * Remove a route's Node implementation, and its entry here, once the whole of its module is served
 * by .NET and the proxy is replaced by routing at the edge.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import replyFrom from '@fastify/reply-from';

interface PortedRoute {
  method: string;
  path: RegExp;
}

const PORTED_ROUTES: readonly PortedRoute[] = [
  { method: 'GET', path: /^\/api\/v1\/facilities(\/[^/]+)?$/ },
];

export function isPortedToWmsService(method: string, url: string): boolean {
  const path = url.split('?')[0];
  return PORTED_ROUTES.some(route => route.method === method && route.path.test(path));
}

interface WmsServiceProxyOptions {
  /** Defaults to WMS_SERVICE_URL. Unset means no proxying. */
  baseUrl?: string;
}

async function wmsServiceProxy(server: FastifyInstance, options: WmsServiceProxyOptions): Promise<void> {
  const baseUrl = options.baseUrl ?? process.env.WMS_SERVICE_URL;
  if (!baseUrl) return;

  await server.register(replyFrom, { base: baseUrl });

  server.addHook('onRequest', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!isPortedToWmsService(req.method, req.url)) return;
    return reply.from(req.url, {
      onError: (failed, { error }) => {
        failed.log.error({ err: error, url: req.url }, 'WMS service unreachable');
        failed.code(502).send({ data: null, error: 'WMS service unavailable' });
      },
    });
  });

  server.log.info({ baseUrl }, 'WMS service proxy enabled');
}

export default fp(wmsServiceProxy, { name: 'wms-service-proxy' });
