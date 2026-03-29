import Fastify from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import prismaPlugin from './plugins/prisma.js';
import { registerDependencies } from './di/index.js';
import { container } from './di/container.js';
import { TOKENS } from './di/tokens.js';
import { IQueueAdapter } from './queue/IQueueAdapter.js';
import { QUEUES } from './queue/events.js';
import { createOutboundCarrierWorker } from './workers/outboundCarrierWorker.js';
import { createOutboundTrackingWorker } from './workers/outboundTrackingWorker.js';
import { createInboundWebhookWorker } from './workers/inboundWebhookWorker.js';
import { OrderDeliveryService } from './services/OrderDeliveryService.js';
import { customerRoutes } from './routes/customers.js';
import { carrierRoutes } from './routes/carriers.js';
import { locationRoutes } from './routes/locations.js';
import { shipmentRoutes } from './routes/shipments.js';
import { laneRoutes } from './routes/lanes.js';
import { orderRoutes } from './routes/orders.js';
import { organizationRoutes } from './routes/organization.js';
import { pendingLaneRequestRoutes } from './routes/pendingLaneRequests.js';
import { seedRoutes } from './routes/seed.js';
import { distanceRoutes } from './routes/distance.js';
import { apiKeyRoutes } from './routes/apiKeys.js';
import { webhookRoutes } from './routes/webhook.js';
import { webhookLogRoutes } from './routes/webhookLogs.js';
import { outboundIntegrationRoutes } from './routes/outboundIntegrations.js';
import { outboundIntegrationLogRoutes } from './routes/outboundIntegrationLogs.js';
import { customerApiRoutes } from './routes/customerApi.js';
import { ediImportRoutes } from './routes/ediImport.js';
import { ediPartnerRoutes } from './routes/ediPartners.js';
import { ediFileRoutes } from './routes/ediFiles.js';
import { queueMonitoringRoutes } from './routes/queueMonitoring.js';

const server = Fastify({ logger: true });

async function start() {
  await server.register(cors, { origin: true });
  await server.register(swagger, {
    openapi: {
      info: { title: 'Open TMS API', version: '0.1.0' },
      components: {
        securitySchemes: {
          ApiKeyAuth: {
            type: 'apiKey',
            in: 'header',
            name: 'x-api-key',
            description: 'Customer-scoped API key. Create one via POST /api/v1/api-keys with a customerId. Can also be passed as Authorization: Bearer <key>.'
          }
        }
      }
    }
  });
  await server.register(swaggerUI, { routePrefix: '/docs' });
  await server.register(prismaPlugin);

  // Initialize Dependency Injection Container
  registerDependencies(server.prisma);

  // Health check
  server.get('/health', async () => ({ status: 'ok' }));

  // Register route modules
  await server.register(customerRoutes);
  await server.register(carrierRoutes);
  await server.register(locationRoutes);
  await server.register(shipmentRoutes);
  await server.register(laneRoutes);
  await server.register(orderRoutes);
  await server.register(organizationRoutes);
  await server.register(pendingLaneRequestRoutes);
  await server.register(seedRoutes);
  await server.register(distanceRoutes);
  await server.register(apiKeyRoutes);
  await server.register(webhookRoutes);
  await server.register(webhookLogRoutes);
  await server.register(outboundIntegrationRoutes);
  await server.register(outboundIntegrationLogRoutes);
  await server.register(customerApiRoutes);
  await server.register(ediImportRoutes);
  await server.register(ediPartnerRoutes);
  await server.register(ediFileRoutes);
  await server.register(queueMonitoringRoutes);

  // Start queue and register workers
  try {
    const queue = container.resolve<IQueueAdapter>(TOKENS.IQueueAdapter);
    await queue.start();
    server.log.info('Queue adapter started');

    const deliveryService = new OrderDeliveryService(server.prisma);
    await queue.subscribe(QUEUES.OUTBOUND_CARRIER, createOutboundCarrierWorker(server.prisma));
    await queue.subscribe(QUEUES.OUTBOUND_TRACKING, createOutboundTrackingWorker(server.prisma));
    await queue.subscribe(QUEUES.INBOUND_WEBHOOK, createInboundWebhookWorker(server.prisma, deliveryService));
    server.log.info('Queue workers registered');

    // Graceful shutdown
    server.addHook('onClose', async () => {
      server.log.info('Stopping queue adapter...');
      await queue.stop();
    });
  } catch (err) {
    server.log.warn('Queue adapter failed to start, running without queue processing: ' + (err as Error).message);
  }

  // Start the server with automatic port retry
  const preferredPort = Number(process.env.PORT || 3001);
  let port = preferredPort;
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    try {
      await server.listen({ port, host: '0.0.0.0' });
      server.log.info(`API running on http://localhost:${port}`);
      if (port !== preferredPort) {
        server.log.warn(`Port ${preferredPort} was unavailable, using port ${port} instead`);
        server.log.warn(`Update VITE_API_URL in frontend/.env to: http://localhost:${port}`);
      }
      break;
    } catch (err: any) {
      if (err.code === 'EADDRINUSE') {
        attempts++;
        port++;
        if (attempts < maxAttempts) {
          server.log.warn(`Port ${port - 1} is in use, trying ${port}...`);
        } else {
          server.log.error(`Could not find available port after ${maxAttempts} attempts`);
          throw err;
        }
      } else {
        throw err;
      }
    }
  }
}

// Start the application
start().catch((err) => {
  server.log.error(err);
  process.exit(1);
});
