import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { ICarrierTrackingIntegrationRepository } from '../repositories/CarrierTrackingIntegrationRepository.js';
import { IShipmentsRepository } from '../repositories/ShipmentsRepository.js';
import { CarrierTrackingService } from '../services/carrierTracking/CarrierTrackingService.js';
import { CarrierTrackingProviderRegistry } from '../services/carrierTracking/ProviderRegistry.js';
import { ICommandBus } from '../commands/CommandBus.js';
import { ICarriersRepository } from '../repositories/CarriersRepository.js';
import { CREATE_CARRIER_TRACKING_INTEGRATION } from '../commands/carrierTracking/CreateCarrierTrackingIntegrationCommand.js';
import { UPDATE_CARRIER_TRACKING_INTEGRATION } from '../commands/carrierTracking/UpdateCarrierTrackingIntegrationCommand.js';
import { DELETE_CARRIER_TRACKING_INTEGRATION } from '../commands/carrierTracking/DeleteCarrierTrackingIntegrationCommand.js';
import { container, TOKENS } from '../di/index.js';
import { openCredentials } from '../security/secretVault.js';
import { registerOrgScope } from '../auth/orgScopeMiddleware.js';

/** Standard { data, error } response schema for Swagger */
const dataErrorResponse = {
  type: 'object' as const,
  properties: {
    data: {},
    error: { type: ['string', 'null'] as const },
  },
};

/** Mask sensitive credential values, showing only the last 4 chars */
function maskCredentials(creds: Record<string, any> | null): Record<string, any> {
  if (!creds || typeof creds !== 'object') return {};
  const masked: Record<string, any> = {};
  for (const [key, value] of Object.entries(creds)) {
    if (typeof value === 'string' && value.length > 4) {
      masked[key] = '****' + value.slice(-4);
    } else if (typeof value === 'string') {
      masked[key] = '****';
    } else {
      masked[key] = value;
    }
  }
  return masked;
}

/** Map raw DB integration to the shape the frontend expects */
function mapIntegration(i: any) {
  return {
    id: i.id,
    carrierId: i.carrierId,
    carrierName: i.carrier?.name ?? 'Unknown',
    providerType: i.providerType,
    status: i.status,
    pollingEnabled: i.pollingEnabled,
    pollingIntervalMinutes: Math.round((i.pollingIntervalSeconds ?? 900) / 60),
    webhookEnabled: i.webhookEnabled ?? false,
    lastPolledAt: i.lastPolledAt,
    lastError: i.lastErrorMessage ?? null,
    errorCount: i.lastErrorMessage ? 1 : 0,
    callsToday: i.rateLimitCallsToday ?? 0,
    dailyMax: i.rateLimitDailyMax ?? null,
    credentials: maskCredentials(openCredentials(i.credentials) as Record<string, any>),
    notes: i.notes ?? null,
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
  };
}

/** Body accepted by PUT and PATCH, which behave identically. */
const updateIntegrationBody = z.object({
  providerType: z.string().optional(),
  status: z.string().optional(),
  credentials: z.record(z.unknown()).optional(),
  webhookEnabled: z.boolean().optional(),
  webhookSecret: z.string().optional(),
  webhookEndpointId: z.string().optional(),
  pollingEnabled: z.boolean().optional(),
  pollingIntervalSeconds: z.number().min(60).optional(),
  rateLimitDailyMax: z.number().optional(),
  notes: z.string().optional(),
});

const updateIntegrationSchema = {
  type: 'object',
  properties: {
    providerType: { type: 'string' },
    status: { type: 'string' },
    credentials: { type: 'object' },
    webhookEnabled: { type: 'boolean' },
    webhookSecret: { type: 'string' },
    pollingEnabled: { type: 'boolean' },
    pollingIntervalSeconds: { type: 'number' },
    rateLimitDailyMax: { type: 'number' },
    notes: { type: 'string' },
  },
};

const NOT_FOUND = 'Carrier tracking integration not found';

/**
 * Admin routes for carrier tracking integrations. Registered in the authenticated block, so every
 * request runs inside the caller's tenant (#303). Integrations have no orgId of their own; the
 * repository scopes them through their carrier. The public webhook lives in
 * carrierTrackingWebhook.ts.
 */
export async function carrierTrackingRoutes(server: FastifyInstance) {
  const integrationRepo = container.resolve<ICarrierTrackingIntegrationRepository>(TOKENS.ICarrierTrackingIntegrationRepository);
  const shipmentsRepo = container.resolve<IShipmentsRepository>(TOKENS.IShipmentsRepository);
  const carriersRepo = container.resolve<ICarriersRepository>(TOKENS.ICarriersRepository);
  const trackingService = container.resolve<CarrierTrackingService>(TOKENS.ICarrierTrackingService);
  const providerRegistry = container.resolve<CarrierTrackingProviderRegistry>(TOKENS.ICarrierTrackingProviderRegistry);
  const commandBus = container.resolve<ICommandBus>(TOKENS.ICommandBus);

  await registerOrgScope(server);

  async function dispatchIntegrationCommand(
    req: FastifyRequest,
    reply: FastifyReply,
    type: string,
    payload: Record<string, unknown>,
    fallbackError: string,
  ): Promise<{ ok: true; data: unknown } | { ok: false; body: { data: null; error: string } }> {
    try {
      const result = await commandBus.dispatch({
        type,
        orgId: req.orgId!,
        actorId: req.user?.sub ?? null,
        payload,
        metadata: { correlationId: randomUUID(), source: 'api' },
      });
      if (result.success) return { ok: true, data: result.data };
      reply.code(400);
      return { ok: false, body: { data: null, error: result.error ?? fallbackError } };
    } catch (err) {
      reply.code(400);
      return { ok: false, body: { data: null, error: (err as Error).message } };
    }
  }

  /** The integration if it belongs to the caller's org; otherwise sends 404 and returns null. */
  async function loadIntegration(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const integration = await integrationRepo.findById(id, req.orgId!);
    if (!integration) reply.code(404);
    return integration;
  }

  // ── Provider info ──

  server.get('/api/v1/carrier-tracking/providers', {
    schema: {
      tags: ['Carrier Tracking'],
      summary: 'List supported carrier tracking providers',
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  supportsWebhooks: { type: 'boolean' },
                  supportsPolling: { type: 'boolean' },
                  description: { type: 'string' },
                },
              },
            },
            error: { type: ['string', 'null'] },
          },
        },
      },
    },
  }, async (_req: FastifyRequest, _reply: FastifyReply) => {
    const providerTypes = providerRegistry.getSupportedProviders();
    const providers = providerTypes.map((type) => {
      try {
        const instance = providerRegistry.create(type);
        return {
          name: instance.name,
          providerType: type,
          supportsWebhooks: instance.supportsWebhooks,
          supportsPolling: instance.supportsPolling,
          maxBatchSize: instance.maxBatchSize,
        };
      } catch {
        return {
          name: type,
          providerType: type,
          supportsWebhooks: false,
          supportsPolling: false,
          maxBatchSize: 1,
        };
      }
    });
    return { data: providers, error: null };
  });

  // ── Integration CRUD ──

  server.get('/api/v1/carrier-tracking/integrations', {
    schema: {
      tags: ['Carrier Tracking'],
      summary: 'List all carrier tracking integrations',
      querystring: {
        type: 'object',
        properties: {
          providerType: { type: 'string' },
          status: { type: 'string' },
        },
      },
      response: { 200: dataErrorResponse },
    },
  }, async (req: FastifyRequest, _reply: FastifyReply) => {
    const { providerType, status } = req.query as { providerType?: string; status?: string };
    const integrations = await integrationRepo.findAll(req.orgId!, { providerType, status });
    return { data: integrations.map(mapIntegration), error: null };
  });

  server.get('/api/v1/carrier-tracking/integrations/:id', {
    schema: {
      tags: ['Carrier Tracking'],
      summary: 'Get carrier tracking integration by ID',
      response: { 200: dataErrorResponse, 404: dataErrorResponse },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const integration = await loadIntegration(req, reply);
    if (!integration) return { data: null, error: NOT_FOUND };
    return { data: mapIntegration(integration), error: null };
  });

  server.post('/api/v1/carrier-tracking/integrations', {
    schema: {
      tags: ['Carrier Tracking'],
      summary: 'Create a carrier tracking integration',
      body: {
        type: 'object',
        required: ['carrierId', 'providerType'],
        properties: {
          carrierId: { type: 'string' },
          providerType: { type: 'string' },
          credentials: { type: 'object' },
          pollingEnabled: { type: 'boolean' },
          pollingIntervalSeconds: { type: 'number' },
          pollingIntervalMinutes: { type: 'number' },
          notes: { type: 'string' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            data: { type: 'object' },
            error: { type: ['string', 'null'] },
          },
        },
        404: dataErrorResponse,
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const raw = z.object({
      carrierId: z.string().min(1),
      providerType: z.string().min(1),
      credentials: z.record(z.unknown()).optional(),
      pollingEnabled: z.boolean().optional(),
      pollingIntervalSeconds: z.number().min(60).optional(),
      pollingIntervalMinutes: z.number().min(1).optional(),
      notes: z.string().optional(),
    }).parse(req.body);

    if (!(await carriersRepo.findById(raw.carrierId, req.orgId!))) {
      reply.code(404);
      return { data: null, error: 'Carrier not found' };
    }

    // Accept pollingIntervalMinutes from frontend, convert to seconds
    const pollingIntervalSeconds = raw.pollingIntervalMinutes
      ? raw.pollingIntervalMinutes * 60
      : raw.pollingIntervalSeconds;

    const outcome = await dispatchIntegrationCommand(req, reply, CREATE_CARRIER_TRACKING_INTEGRATION, {
      carrierId: raw.carrierId,
      providerType: raw.providerType,
      credentials: raw.credentials,
      pollingEnabled: raw.pollingEnabled,
      pollingIntervalSeconds,
      notes: raw.notes,
    }, 'Failed to create integration');
    if (!outcome.ok) return outcome.body;

    reply.code(201);
    return { data: outcome.data, error: null };
  });

  const updateHandler = async (req: FastifyRequest, reply: FastifyReply) => {
    const body = updateIntegrationBody.parse(req.body);
    const integration = await loadIntegration(req, reply);
    if (!integration) return { data: null, error: NOT_FOUND };

    const outcome = await dispatchIntegrationCommand(
      req, reply, UPDATE_CARRIER_TRACKING_INTEGRATION, { id: integration.id, ...body }, 'Failed to update integration',
    );
    return outcome.ok ? { data: outcome.data, error: null } : outcome.body;
  };

  server.put('/api/v1/carrier-tracking/integrations/:id', {
    schema: {
      tags: ['Carrier Tracking'],
      summary: 'Update a carrier tracking integration',
      body: updateIntegrationSchema,
      response: { 200: dataErrorResponse, 404: dataErrorResponse },
    },
  }, updateHandler);

  // PATCH behaves like PUT; the frontend detail page uses it.
  server.patch('/api/v1/carrier-tracking/integrations/:id', {
    schema: {
      tags: ['Carrier Tracking'],
      summary: 'Partially update a carrier tracking integration',
      body: updateIntegrationSchema,
      response: { 200: dataErrorResponse, 404: dataErrorResponse },
    },
  }, updateHandler);

  server.delete('/api/v1/carrier-tracking/integrations/:id', {
    schema: {
      tags: ['Carrier Tracking'],
      summary: 'Delete a carrier tracking integration',
      response: { 200: dataErrorResponse, 404: dataErrorResponse },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const integration = await loadIntegration(req, reply);
    if (!integration) return { data: null, error: NOT_FOUND };

    const outcome = await dispatchIntegrationCommand(
      req, reply, DELETE_CARRIER_TRACKING_INTEGRATION, { id: integration.id }, 'Failed to delete integration',
    );
    return outcome.ok ? { data: { deleted: true }, error: null } : outcome.body;
  });

  // ── Actions ──

  server.post('/api/v1/carrier-tracking/integrations/:id/test', {
    schema: {
      tags: ['Carrier Tracking'],
      summary: 'Test a carrier tracking integration connection',
      response: { 200: dataErrorResponse, 404: dataErrorResponse },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const integration = await loadIntegration(req, reply);
    if (!integration) return { data: null, error: NOT_FOUND };

    try {
      const result = await trackingService.testConnection(integration.id);
      return { data: result, error: null };
    } catch (err) {
      reply.code(502);
      return { data: null, error: (err as Error).message };
    }
  });

  const statusHandler = (status: 'active' | 'disabled') => async (req: FastifyRequest, reply: FastifyReply) => {
    const integration = await loadIntegration(req, reply);
    if (!integration) return { data: null, error: NOT_FOUND };

    const outcome = await dispatchIntegrationCommand(
      req, reply, UPDATE_CARRIER_TRACKING_INTEGRATION, { id: integration.id, status }, `Failed to set integration ${status}`,
    );
    if (!outcome.ok) return outcome.body;
    return { data: status === 'active' ? { enabled: true } : { disabled: true }, error: null };
  };

  server.post('/api/v1/carrier-tracking/integrations/:id/enable', {
    schema: {
      tags: ['Carrier Tracking'],
      summary: 'Enable a carrier tracking integration',
      response: { 200: dataErrorResponse, 404: dataErrorResponse },
    },
  }, statusHandler('active'));

  server.post('/api/v1/carrier-tracking/integrations/:id/disable', {
    schema: {
      tags: ['Carrier Tracking'],
      summary: 'Disable a carrier tracking integration',
      response: { 200: dataErrorResponse, 404: dataErrorResponse },
    },
  }, statusHandler('disabled'));

  server.get('/api/v1/carrier-tracking/integrations/:id/events', {
    schema: {
      tags: ['Carrier Tracking'],
      summary: 'Get recent tracking events for a carrier tracking integration',
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 100 },
        },
      },
      response: { 200: dataErrorResponse, 404: dataErrorResponse },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const integration = await loadIntegration(req, reply);
    if (!integration) return { data: null, error: NOT_FOUND };

    const { limit } = req.query as { limit?: number };
    const events = await integrationRepo.findRecentEvents(integration.id, req.orgId!, Math.min(limit || 20, 100));
    const mapped = events.map((e) => ({
      id: e.id,
      trackingNumber: e.trackingNumber,
      status: e.status,
      statusDetail: e.statusDetail,
      city: e.city,
      state: e.state,
      country: e.country,
      occurredAt: e.occurredAt,
      source: e.source,
      shipmentId: e.shipmentId,
      location: [e.city, e.state, e.country].filter(Boolean).join(', '),
    }));
    return { data: mapped, error: null };
  });

  server.post('/api/v1/carrier-tracking/integrations/:id/poll', {
    schema: {
      tags: ['Carrier Tracking'],
      summary: 'Manually trigger polling for a carrier tracking integration',
      response: { 200: dataErrorResponse, 404: dataErrorResponse },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const integration = await loadIntegration(req, reply);
    if (!integration) return { data: null, error: NOT_FOUND };

    if (integration.status !== 'active') {
      reply.code(409);
      return { data: null, error: 'Integration is not active' };
    }

    try {
      const result = await trackingService.pollForUpdates(integration.id);
      return { data: result, error: null };
    } catch (err) {
      reply.code(502);
      return { data: null, error: (err as Error).message };
    }
  });

  // ── Tracking data ──

  server.get('/api/v1/shipments/:shipmentId/carrier-tracking', {
    schema: {
      tags: ['Carrier Tracking'],
      summary: 'Get carrier tracking events for a shipment',
      response: { 200: dataErrorResponse, 404: dataErrorResponse },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { shipmentId } = req.params as { shipmentId: string };
    const orgId = req.orgId!;

    const shipment = await shipmentsRepo.findById(shipmentId, orgId);
    if (!shipment) {
      reply.code(404);
      return { data: null, error: 'Shipment not found' };
    }

    const events = await integrationRepo.findEventsByShipment(shipmentId, orgId, 1000);
    const integration = shipment.carrierId ? await integrationRepo.findByCarrierId(shipment.carrierId, orgId) : null;
    const tracking = {
      hasCarrier: !!shipment.carrierId,
      hasIntegration: !!integration,
      integrationStatus: integration?.status ?? null,
    };

    return { data: { events, tracking }, error: null };
  });

  server.post('/api/v1/shipments/:shipmentId/carrier-tracking/poll', {
    schema: {
      tags: ['Carrier Tracking'],
      summary: 'Manually poll carrier tracking for a shipment',
      response: { 200: dataErrorResponse, 404: dataErrorResponse, 409: dataErrorResponse },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { shipmentId } = req.params as { shipmentId: string };
    const orgId = req.orgId!;

    const shipment = await shipmentsRepo.findById(shipmentId, orgId);
    if (!shipment) {
      reply.code(404);
      return { data: null, error: 'Shipment not found' };
    }
    if (!shipment.carrierId) {
      reply.code(409);
      return { data: null, error: 'Shipment has no carrier assigned' };
    }
    if (!shipment.trackingNumber) {
      reply.code(409);
      return { data: null, error: 'Shipment has no tracking number' };
    }

    const integration = await integrationRepo.findByCarrierId(shipment.carrierId, orgId);
    if (!integration) {
      reply.code(404);
      return { data: null, error: 'No carrier tracking integration found for this carrier' };
    }
    if (integration.status !== 'active') {
      reply.code(409);
      return { data: null, error: 'Carrier tracking integration is not active' };
    }

    try {
      const result = await trackingService.pollForUpdates(integration.id);
      return { data: result, error: null };
    } catch (err) {
      reply.code(502);
      return { data: null, error: (err as Error).message };
    }
  });
}
