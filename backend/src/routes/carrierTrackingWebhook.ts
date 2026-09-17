import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { container, TOKENS } from '../di/index.js';
import {
  CarrierTrackingService,
  CarrierWebhookUnauthenticatedError,
} from '../services/carrierTracking/CarrierTrackingService.js';

const dataErrorResponse = {
  type: 'object' as const,
  properties: {
    data: {},
    error: { type: ['string', 'null'] as const },
  },
};

/**
 * Public carrier tracking webhook, split from the admin routes so those can sit behind the JWT
 * (#303). There is no request-level tenant: a carrier callback can concern several integrations,
 * so the service attributes each event to the org of the integration whose secret verified it.
 * That is the scope, and the reason this plugin is declared in tooling/tenancy/policy.ts.
 */
export async function carrierTrackingWebhookRoutes(server: FastifyInstance) {
  const trackingService = container.resolve<CarrierTrackingService>(TOKENS.ICarrierTrackingService);

  server.post('/api/v1/carrier-tracking/webhook/:providerType', {
    schema: {
      tags: ['Carrier Tracking'],
      summary: 'Receive inbound webhook from a carrier tracking provider',
      params: {
        type: 'object',
        required: ['providerType'],
        properties: { providerType: { type: 'string', pattern: '^[A-Za-z0-9_-]{1,40}$' } },
      },
      response: { 200: dataErrorResponse, 400: dataErrorResponse, 401: dataErrorResponse },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { providerType } = req.params as { providerType: string };

    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === 'string') headers[key] = value;
    }

    try {
      const result = await trackingService.processWebhook(providerType, req.body, headers);
      return { data: result, error: null };
    } catch (err) {
      if (err instanceof CarrierWebhookUnauthenticatedError) {
        req.log.warn({ providerType, ip: req.ip }, 'Carrier webhook failed signature verification');
        reply.code(401);
        return { data: null, error: 'Webhook signature could not be verified' };
      }
      reply.code(400);
      return { data: null, error: (err as Error).message };
    }
  });
}
