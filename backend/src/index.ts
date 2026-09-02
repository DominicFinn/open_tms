import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import prismaPlugin from './plugins/prisma.js';
import errorHandlerPlugin from './plugins/errorHandler.js';
import { registerDependencies } from './di/index.js';
import { container } from './di/container.js';
import { TOKENS } from './di/tokens.js';
import { IQueueAdapter } from './queue/IQueueAdapter.js';
import { QUEUES } from './queue/events.js';
import { createInboundWebhookWorker } from './workers/inboundWebhookWorker.js';
import { createDocumentGenerationWorker } from './workers/documentGenerationWorker.js';
import type { IDocumentGenerationService } from './services/DocumentGenerationService.js';
import { createEtaMonitorWorker, registerEtaMonitorSchedule, ETA_MONITOR_QUEUE } from './workers/etaMonitorWorker.js';
import { createSlaMonitorWorker, registerSlaMonitorSchedule, SLA_MONITOR_QUEUE } from './workers/slaMonitorWorker.js';
import { createCutoffMonitorWorker, registerCutoffMonitorSchedule, CUTOFF_MONITOR_QUEUE } from './workers/cutoffMonitorWorker.js';
import { ShipmentCutoffMonitorService } from './services/cutoff/ShipmentCutoffMonitorService.js';
import { createWaveAutoReleaseWorker, registerWaveAutoReleaseSchedule, WAVE_AUTO_RELEASE_QUEUE } from './workers/waveAutoReleaseWorker.js';
import { WaveAutoReleaseService } from './services/waves/WaveAutoReleaseService.js';
import { createOrderAutoArchiveWorker, registerOrderAutoArchiveSchedule, ORDER_AUTO_ARCHIVE_QUEUE } from './workers/orderAutoArchiveWorker.js';
import { OrderAutoArchiveService } from './services/OrderAutoArchiveService.js';
import { createCarrierUserAnonymizeWorker, registerCarrierUserAnonymizeSchedule, CARRIER_USER_ANONYMIZE_QUEUE } from './workers/carrierUserAnonymizeWorker.js';
import { CarrierUserAnonymizationService } from './services/CarrierUserAnonymizationService.js';
import { registerEventHandlers } from './events/registerHandlers.js';
import type { IEventBus } from './events/IEventBus.js';
import { createWebhookRetryWorker, registerWebhookRetrySchedule, WEBHOOK_RETRY_QUEUE } from './workers/webhookRetryWorker.js';
import { CustomerWebhookDeliveryService } from './services/webhooks/CustomerWebhookDeliveryService.js';
import {
  createQuoteExpirationWorker, registerQuoteExpirationSchedule, QUOTE_EXPIRATION_QUEUE,
  createInvoiceOverdueWorker, registerInvoiceOverdueSchedule, INVOICE_OVERDUE_QUEUE,
  createInvoiceConsolidationWorker, registerInvoiceConsolidationSchedule, INVOICE_CONSOLIDATION_QUEUE,
  createCarrierPaymentBatchWorker, registerCarrierPaymentBatchSchedule, CARRIER_PAYMENT_BATCH_QUEUE,
} from './workers/financialCronWorkers.js';
import { ISlaEvaluationService } from './services/SlaEvaluationService.js';
import { OrderDeliveryService } from './services/OrderDeliveryService.js';
import { ArrivalCriteriaEvaluationService } from './services/ArrivalCriteriaEvaluationService.js';
import { IShipmentEtaMonitorService } from './services/routing/ShipmentEtaMonitorService.js';
import {
  createCarrierTrackingPollWorker, registerCarrierTrackingPollSchedule, CARRIER_TRACKING_POLL_QUEUE,
} from './workers/carrierTrackingPollWorker.js';
import { CarrierTrackingService } from './services/carrierTracking/CarrierTrackingService.js';
import { ICarrierTrackingIntegrationRepository } from './repositories/CarrierTrackingIntegrationRepository.js';
import { authenticateJWT } from './middleware/jwtAuth.js';
import { registerCorePublicRoutes, registerCoreAuthenticatedRoutes } from './routes/modules/core.js';
import { registerFinancePublicRoutes, registerFinanceAuthenticatedRoutes } from './routes/modules/finance.js';
import { registerInventoryPublicRoutes, registerInventoryAuthenticatedRoutes } from './routes/modules/inventory.js';
import { registerQualityPublicRoutes, registerQualityAuthenticatedRoutes } from './routes/modules/quality.js';
import { registerTmsPublicRoutes, registerTmsAuthenticatedRoutes } from './routes/modules/tms.js';
import { registerWmsPublicRoutes, registerWmsAuthenticatedRoutes } from './routes/modules/wms.js';

const server = Fastify({ logger: true });

async function start() {
  // CORS: restrict origins in production, allow all in dev
  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'];
  await server.register(cors, {
    origin: process.env.NODE_ENV === 'production' ? allowedOrigins : true,
    credentials: true,
  });
  await server.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } });
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
          },
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'Internal user JWT from POST /api/v1/auth/login. Required for most admin/back-office endpoints.'
          }
        }
      },
      // Default security requirement for any operation that doesn't declare
      // its own `security` array. Most routes sit behind the global
      // authenticateJWT hook (see the authenticatedRoutes block below), so
      // BearerAuth is the sane default; self-authenticating routes (login,
      // customer/carrier portals, ApiKeyAuth-scoped endpoints, etc.) already
      // override this with their own per-route `security`.
      security: [{ BearerAuth: [] }]
    }
  });
  // Only expose Swagger UI in non-production environments
  if (process.env.NODE_ENV !== 'production') {
    await server.register(swaggerUI, { routePrefix: '/docs' });
  }
  await server.register(prismaPlugin);
  await server.register(errorHandlerPlugin);

  // Initialize Dependency Injection Container
  registerDependencies(server.prisma);

  // Seed built-in shipment types (idempotent)
  try {
    const { seedBuiltInShipmentTypes } = await import('./bootstrap/seedShipmentTypes.js');
    await seedBuiltInShipmentTypes(server.prisma);
  } catch (err) {
    server.log.warn(`[Bootstrap] Shipment type seed failed: ${(err as Error).message}`);
  }

  // Health check
  server.get('/health', async () => ({ status: 'ok' }));

  // ── Public & self-authenticating routes ──────────────────────────────
  // These routes either need no auth or manage their own auth internally.
  // Each is registered at the root level so the global JWT hook does NOT apply.

  await registerCorePublicRoutes(server);
  await registerFinancePublicRoutes(server);
  await registerInventoryPublicRoutes(server);
  await registerQualityPublicRoutes(server);
  await registerTmsPublicRoutes(server);
  await registerWmsPublicRoutes(server);

  // ── Authenticated routes (require JWT) ───────────────────────────────
  // All routes below require a valid internal user JWT token.
  // The onRequest hook rejects unauthenticated requests with 401 before
  // the route handler runs.
  await server.register(async function authenticatedRoutes(app) {
    app.addHook('onRequest', authenticateJWT);
    await registerCoreAuthenticatedRoutes(app);
    await registerFinanceAuthenticatedRoutes(app);
    await registerInventoryAuthenticatedRoutes(app);
    await registerQualityAuthenticatedRoutes(app);
    await registerTmsAuthenticatedRoutes(app);
    await registerWmsAuthenticatedRoutes(app);
  });

  // Start queue adapter (needed for publishing events, even if workers run elsewhere)
  try {
    const queue = container.resolve<IQueueAdapter>(TOKENS.IQueueAdapter);
    await queue.start();
    server.log.info('Queue adapter started');

    // Register embedded workers ONLY if no separate worker container is running.
    // Set DISABLE_EMBEDDED_WORKERS=true when using `docker compose up` with the worker service.
    if (process.env.DISABLE_EMBEDDED_WORKERS !== 'true') {
      // CQRS event handlers (projections, audit, notifications) — wired in the
      // backend process for dev. In prod with a separate worker container,
      // DISABLE_EMBEDDED_WORKERS=true keeps these out so they aren't processed twice.
      try {
        const eventBus = container.resolve<IEventBus>(TOKENS.IEventBus);
        await registerEventHandlers(eventBus, server.prisma);
        await eventBus.start();
        server.log.info('Embedded event handlers registered (projections + audit + notifications)');
      } catch (err) {
        server.log.warn('Failed to register embedded event handlers: ' + (err as Error).message);
      }

      const deliveryService = new OrderDeliveryService(server.prisma);
      const arrivalCriteriaService = new ArrivalCriteriaEvaluationService(server.prisma, deliveryService);
      // Legacy outbound carrier/tracking workers removed — replaced by Edi856AutoSendHandler + Edi810AutoSendHandler
      await queue.subscribe(QUEUES.INBOUND_WEBHOOK, createInboundWebhookWorker(server.prisma, deliveryService, arrivalCriteriaService));

      // Async document generation worker. Pulls PDF rendering off the
      // request path; clients poll /api/v1/documents/jobs/:correlationId
      // for completion.
      try {
        const docService = container.resolve<IDocumentGenerationService>(TOKENS.IDocumentGenerationService);
        await queue.subscribe(QUEUES.DOCUMENT_GENERATION, createDocumentGenerationWorker(docService, server.prisma));
        server.log.info('Document generation worker registered');
      } catch (err) {
        server.log.warn('Document generation worker failed to register: ' + (err as Error).message);
      }

      // ETA Monitor — register cron schedule and worker if routing provider is configured
      if (process.env.ROUTING_PROVIDER && process.env.ROUTING_PROVIDER !== 'none') {
        try {
          const etaMonitorService = container.resolve<IShipmentEtaMonitorService>(TOKENS.IShipmentEtaMonitorService);
          const boss = (queue as any).boss; // Access pg-boss instance for schedule()
          if (boss) {
            await registerEtaMonitorSchedule(boss);
            await queue.subscribe(ETA_MONITOR_QUEUE, createEtaMonitorWorker(server.prisma, etaMonitorService));
            server.log.info(`ETA monitor worker registered (provider: ${process.env.ROUTING_PROVIDER})`);
          }
        } catch (err) {
          server.log.warn('ETA monitor worker failed to register: ' + (err as Error).message);
        }
      }

      // Cutoff-at-risk monitor — register cron schedule and worker (always enabled)
      try {
        const cutoffBoss = (queue as any).boss;
        if (cutoffBoss) {
          const eventBus = container.resolve<any>(TOKENS.IEventBus);
          const cutoffService = new ShipmentCutoffMonitorService(server.prisma, eventBus);
          await registerCutoffMonitorSchedule(cutoffBoss);
          await queue.subscribe(CUTOFF_MONITOR_QUEUE, createCutoffMonitorWorker(cutoffService));
          server.log.info('Cutoff-at-risk monitor worker registered');
        }
      } catch (err) {
        server.log.warn('Cutoff monitor worker failed to register: ' + (err as Error).message);
      }

      // Wave auto-release worker — applies templates at their scheduled HH:MM
      try {
        const waveBoss = (queue as any).boss;
        if (waveBoss) {
          const commandBus = container.resolve<any>(TOKENS.ICommandBus);
          const waveService = new WaveAutoReleaseService(server.prisma, commandBus);
          await registerWaveAutoReleaseSchedule(waveBoss);
          await queue.subscribe(WAVE_AUTO_RELEASE_QUEUE, createWaveAutoReleaseWorker(waveService));
          server.log.info('Wave auto-release worker registered');
        }
      } catch (err) {
        server.log.warn('Wave auto-release worker failed to register: ' + (err as Error).message);
      }

      // Order auto-archive worker — archives delivered/cancelled orders after the retention window
      try {
        const archiveBoss = (queue as any).boss;
        if (archiveBoss) {
          const commandBus = container.resolve<any>(TOKENS.ICommandBus);
          const retentionDays = Number(process.env.ORDER_AUTO_ARCHIVE_DAYS) || 30;
          const archiveService = new OrderAutoArchiveService(server.prisma, commandBus, retentionDays);
          await registerOrderAutoArchiveSchedule(archiveBoss);
          await queue.subscribe(ORDER_AUTO_ARCHIVE_QUEUE, createOrderAutoArchiveWorker(archiveService));
          server.log.info(`Order auto-archive worker registered (retention: ${retentionDays} days)`);
        }
      } catch (err) {
        server.log.warn('Order auto-archive worker failed to register: ' + (err as Error).message);
      }

      // Carrier-user anonymisation worker — scrubs PII from portal users whose
      // carrier has been archived/deleted for longer than the retention window.
      try {
        const anonBoss = (queue as any).boss;
        if (anonBoss) {
          const anonDays = Number(process.env.CARRIER_USER_ANONYMIZE_DAYS) || 365;
          const anonService = new CarrierUserAnonymizationService(server.prisma, anonDays);
          await registerCarrierUserAnonymizeSchedule(anonBoss);
          await queue.subscribe(CARRIER_USER_ANONYMIZE_QUEUE, createCarrierUserAnonymizeWorker(anonService));
          server.log.info(`Carrier-user anonymisation worker registered (retention: ${anonDays} days)`);
        }
      } catch (err) {
        server.log.warn('Carrier-user anonymisation worker failed to register: ' + (err as Error).message);
      }

      // Webhook retry worker — re-sends failed CustomerWebhookDelivery rows with exponential backoff
      try {
        const retryBoss = (queue as any).boss;
        if (retryBoss) {
          const deliveryService = new CustomerWebhookDeliveryService(server.prisma);
          await registerWebhookRetrySchedule(retryBoss);
          await queue.subscribe(WEBHOOK_RETRY_QUEUE, createWebhookRetryWorker(deliveryService));
          server.log.info('Webhook retry worker registered');
        }
      } catch (err) {
        server.log.warn('Webhook retry worker failed to register: ' + (err as Error).message);
      }

      // SLA Monitor — register cron schedule and worker (always enabled)
      try {
        const slaService = container.resolve<ISlaEvaluationService>(TOKENS.ISlaEvaluationService);
        const slaBoss = (queue as any).boss;
        if (slaBoss) {
          await registerSlaMonitorSchedule(slaBoss);
          await queue.subscribe(SLA_MONITOR_QUEUE, createSlaMonitorWorker(server.prisma, slaService));
          server.log.info('SLA monitor worker registered');
        }
      } catch (err) {
        server.log.warn('SLA monitor worker failed to register: ' + (err as Error).message);
      }

      // Financial cron workers — always enabled
      try {
        const finBoss = (queue as any).boss;
        if (finBoss) {
          await registerQuoteExpirationSchedule(finBoss);
          await queue.subscribe(QUOTE_EXPIRATION_QUEUE, createQuoteExpirationWorker(server.prisma));
          await registerInvoiceOverdueSchedule(finBoss);
          await queue.subscribe(INVOICE_OVERDUE_QUEUE, createInvoiceOverdueWorker(server.prisma));
          await registerInvoiceConsolidationSchedule(finBoss);
          await queue.subscribe(INVOICE_CONSOLIDATION_QUEUE, createInvoiceConsolidationWorker(server.prisma));
          await registerCarrierPaymentBatchSchedule(finBoss);
          await queue.subscribe(CARRIER_PAYMENT_BATCH_QUEUE, createCarrierPaymentBatchWorker(server.prisma));
          server.log.info('Financial cron workers registered (quote expiration, invoice overdue, invoice consolidation, carrier payment batch)');
        }
      } catch (err) {
        server.log.warn('Financial cron workers failed to register: ' + (err as Error).message);
      }

      // Carrier Tracking Poll -- register cron schedule and worker (always enabled)
      try {
        const carrierTrackingService = container.resolve<CarrierTrackingService>(TOKENS.ICarrierTrackingService);
        const carrierTrackingRepo = container.resolve<ICarrierTrackingIntegrationRepository>(TOKENS.ICarrierTrackingIntegrationRepository);
        const ctBoss = (queue as any).boss;
        if (ctBoss) {
          await registerCarrierTrackingPollSchedule(ctBoss);
          await queue.subscribe(
            CARRIER_TRACKING_POLL_QUEUE,
            createCarrierTrackingPollWorker(server.prisma, carrierTrackingService, carrierTrackingRepo),
          );
          server.log.info('Carrier tracking poll worker registered');
        }
      } catch (err) {
        server.log.warn('Carrier tracking poll worker failed to register: ' + (err as Error).message);
      }

      // EDI Retry Worker — retries failed outbound EDI deliveries
      try {
        const ediRetryBoss = (queue as any).boss;
        if (ediRetryBoss) {
          const { createEdiRetryWorker, registerEdiRetrySchedule, EDI_RETRY_QUEUE } = await import('./workers/ediRetryWorker.js');
          const ediPartnerRepo = container.resolve<ITradingPartnerRepository>(TOKENS.ITradingPartnerRepository);
          const ediDeliveryService = container.resolve<IOutboundEdiDeliveryService>(TOKENS.IOutboundEdiDeliveryService);
          await registerEdiRetrySchedule(ediRetryBoss);
          await queue.subscribe(EDI_RETRY_QUEUE, createEdiRetryWorker(server.prisma, ediPartnerRepo, ediDeliveryService));
          server.log.info('EDI retry worker registered');
        }
      } catch (err) {
        server.log.warn('EDI retry worker failed to register: ' + (err as Error).message);
      }

      server.log.info('Embedded queue workers registered (set DISABLE_EMBEDDED_WORKERS=true to use separate worker container)');
    } else {
      server.log.info('Embedded workers disabled — using separate worker container');
    }

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
