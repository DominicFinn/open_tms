import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { ICarrierTrackingIntegrationRepository } from '../repositories/CarrierTrackingIntegrationRepository.js';
import { CarrierTrackingService } from '../services/carrierTracking/CarrierTrackingService.js';
import { CarrierTrackingProviderRegistry } from '../services/carrierTracking/ProviderRegistry.js';
import { ICommandBus } from '../commands/CommandBus.js';
import { CREATE_CARRIER_TRACKING_INTEGRATION } from '../commands/carrierTracking/CreateCarrierTrackingIntegrationCommand.js';
import { UPDATE_CARRIER_TRACKING_INTEGRATION } from '../commands/carrierTracking/UpdateCarrierTrackingIntegrationCommand.js';
import { DELETE_CARRIER_TRACKING_INTEGRATION } from '../commands/carrierTracking/DeleteCarrierTrackingIntegrationCommand.js';
import { container, TOKENS } from '../di/index.js';

export async function carrierTrackingRoutes(server: FastifyInstance) {
  const integrationRepo = container.resolve<ICarrierTrackingIntegrationRepository>(TOKENS.ICarrierTrackingIntegrationRepository);
  const trackingService = container.resolve<CarrierTrackingService>(TOKENS.ICarrierTrackingService);
  const providerRegistry = container.resolve<CarrierTrackingProviderRegistry>(TOKENS.ICarrierTrackingProviderRegistry);
  const commandBus = container.resolve<ICommandBus>(TOKENS.ICommandBus);

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

  // List all integrations
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
    },
  }, async (req: FastifyRequest, _reply: FastifyReply) => {
    const { providerType, status } = req.query as { providerType?: string; status?: string };
    const integrations = await integrationRepo.findAll({ providerType, status });
    return { data: integrations, error: null };
  });

  // Get integration by ID
  server.get('/api/v1/carrier-tracking/integrations/:id', {
    schema: {
      tags: ['Carrier Tracking'],
      summary: 'Get carrier tracking integration by ID',
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const integration = await integrationRepo.findById(id);
    if (!integration) {
      reply.code(404);
      return { data: null, error: 'Carrier tracking integration not found' };
    }
    return { data: integration, error: null };
  });

  // Create integration
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
          notes: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      carrierId: z.string().min(1),
      providerType: z.string().min(1),
      credentials: z.record(z.unknown()).optional(),
      pollingEnabled: z.boolean().optional(),
      pollingIntervalSeconds: z.number().min(60).optional(),
      notes: z.string().optional(),
    }).parse((req as any).body);

    try {
      const result = await commandBus.dispatch({
        type: CREATE_CARRIER_TRACKING_INTEGRATION,
        orgId: 'default',
        actorId: null,
        payload: body,
        metadata: { correlationId: randomUUID(), source: 'api' },
      });

      if (!result.success) {
        reply.code(400);
        return { data: null, error: result.error ?? 'Failed to create integration' };
      }

      reply.code(201);
      return { data: result.data, error: null };
    } catch (err: any) {
      reply.code(400);
      return { data: null, error: err.message };
    }
  });

  // Update integration
  server.put('/api/v1/carrier-tracking/integrations/:id', {
    schema: {
      tags: ['Carrier Tracking'],
      summary: 'Update a carrier tracking integration',
      body: {
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
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
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
    }).parse((req as any).body);

    try {
      const result = await commandBus.dispatch({
        type: UPDATE_CARRIER_TRACKING_INTEGRATION,
        orgId: 'default',
        actorId: null,
        payload: { id, ...body },
        metadata: { correlationId: randomUUID(), source: 'api' },
      });

      if (!result.success) {
        reply.code(400);
        return { data: null, error: result.error ?? 'Failed to update integration' };
      }

      return { data: result.data, error: null };
    } catch (err: any) {
      reply.code(400);
      return { data: null, error: err.message };
    }
  });

  // Delete integration
  server.delete('/api/v1/carrier-tracking/integrations/:id', {
    schema: {
      tags: ['Carrier Tracking'],
      summary: 'Delete a carrier tracking integration',
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    try {
      const result = await commandBus.dispatch({
        type: DELETE_CARRIER_TRACKING_INTEGRATION,
        orgId: 'default',
        actorId: null,
        payload: { id },
        metadata: { correlationId: randomUUID(), source: 'api' },
      });

      if (!result.success) {
        reply.code(400);
        return { data: null, error: result.error ?? 'Failed to delete integration' };
      }

      return { data: { deleted: true }, error: null };
    } catch (err: any) {
      reply.code(400);
      return { data: null, error: err.message };
    }
  });

  // ── Actions ──

  // Test connection
  server.post('/api/v1/carrier-tracking/integrations/:id/test', {
    schema: {
      tags: ['Carrier Tracking'],
      summary: 'Test a carrier tracking integration connection',
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    try {
      const result = await trackingService.testConnection(id);
      return { data: result, error: null };
    } catch (err: any) {
      reply.code(500);
      return { data: null, error: err.message };
    }
  });

  // Enable integration
  server.post('/api/v1/carrier-tracking/integrations/:id/enable', {
    schema: {
      tags: ['Carrier Tracking'],
      summary: 'Enable a carrier tracking integration',
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    try {
      const result = await commandBus.dispatch({
        type: UPDATE_CARRIER_TRACKING_INTEGRATION,
        orgId: 'default',
        actorId: null,
        payload: { id, status: 'active' },
        metadata: { correlationId: randomUUID(), source: 'api' },
      });

      if (!result.success) {
        reply.code(400);
        return { data: null, error: result.error ?? 'Failed to enable integration' };
      }

      return { data: { enabled: true }, error: null };
    } catch (err: any) {
      reply.code(400);
      return { data: null, error: err.message };
    }
  });

  // Disable integration
  server.post('/api/v1/carrier-tracking/integrations/:id/disable', {
    schema: {
      tags: ['Carrier Tracking'],
      summary: 'Disable a carrier tracking integration',
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    try {
      const result = await commandBus.dispatch({
        type: UPDATE_CARRIER_TRACKING_INTEGRATION,
        orgId: 'default',
        actorId: null,
        payload: { id, status: 'disabled' },
        metadata: { correlationId: randomUUID(), source: 'api' },
      });

      if (!result.success) {
        reply.code(400);
        return { data: null, error: result.error ?? 'Failed to disable integration' };
      }

      return { data: { disabled: true }, error: null };
    } catch (err: any) {
      reply.code(400);
      return { data: null, error: err.message };
    }
  });

  // ── Tracking data ──

  // Get carrier tracking events for a shipment
  server.get('/api/v1/shipments/:shipmentId/carrier-tracking', {
    schema: {
      tags: ['Carrier Tracking'],
      summary: 'Get carrier tracking events for a shipment',
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { shipmentId } = req.params as { shipmentId: string };

    try {
      const events = await server.prisma.carrierTrackingEvent.findMany({
        where: { shipmentId },
        orderBy: { occurredAt: 'desc' },
      });
      return { data: events, error: null };
    } catch (err: any) {
      reply.code(500);
      return { data: null, error: err.message };
    }
  });

  // Manual poll for a shipment
  server.post('/api/v1/shipments/:shipmentId/carrier-tracking/poll', {
    schema: {
      tags: ['Carrier Tracking'],
      summary: 'Manually poll carrier tracking for a shipment',
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { shipmentId } = req.params as { shipmentId: string };

    try {
      // Find the shipment and its carrier
      const shipment = await server.prisma.shipment.findUnique({
        where: { id: shipmentId },
        select: { id: true, carrierId: true, trackingNumber: true },
      });

      if (!shipment) {
        reply.code(404);
        return { data: null, error: 'Shipment not found' };
      }

      if (!shipment.carrierId) {
        reply.code(400);
        return { data: null, error: 'Shipment has no carrier assigned' };
      }

      if (!shipment.trackingNumber) {
        reply.code(400);
        return { data: null, error: 'Shipment has no tracking number' };
      }

      // Find the carrier tracking integration
      const integration = await integrationRepo.findByCarrierId(shipment.carrierId);

      if (!integration) {
        reply.code(404);
        return { data: null, error: 'No carrier tracking integration found for this carrier' };
      }

      if (integration.status !== 'active') {
        reply.code(400);
        return { data: null, error: 'Carrier tracking integration is not active' };
      }

      const result = await trackingService.pollForUpdates(integration.id);
      return { data: result, error: null };
    } catch (err: any) {
      reply.code(500);
      return { data: null, error: err.message };
    }
  });

  // ── Webhook receiver ──

  server.post('/api/v1/carrier-tracking/webhook/:providerType', {
    schema: {
      tags: ['Carrier Tracking'],
      summary: 'Receive inbound webhook from a carrier tracking provider',
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { providerType } = req.params as { providerType: string };

    try {
      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(req.headers)) {
        if (typeof value === 'string') {
          headers[key] = value;
        }
      }

      const result = await trackingService.processWebhook(providerType, req.body, headers);
      return { data: result, error: null };
    } catch (err: any) {
      reply.code(400);
      return { data: null, error: err.message };
    }
  });
}
