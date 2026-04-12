import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
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
import { createEtaMonitorWorker, registerEtaMonitorSchedule, ETA_MONITOR_QUEUE } from './workers/etaMonitorWorker.js';
import { createSlaMonitorWorker, registerSlaMonitorSchedule, SLA_MONITOR_QUEUE } from './workers/slaMonitorWorker.js';
import { ISlaEvaluationService } from './services/SlaEvaluationService.js';
import { OrderDeliveryService } from './services/OrderDeliveryService.js';
import { ArrivalCriteriaEvaluationService } from './services/ArrivalCriteriaEvaluationService.js';
import { IShipmentEtaMonitorService } from './services/routing/ShipmentEtaMonitorService.js';
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
import { documentRoutes } from './routes/documents.js';
import { dailyReportRoutes } from './routes/dailyReport.js';
import { locationReportRoutes } from './routes/locationReports.js';
import { attachmentRoutes } from './routes/attachments.js';
import { customFieldRoutes } from './routes/customFields.js';
import { themeRoutes } from './routes/theme.js';
import { notificationRoutes } from './routes/notifications.js';
import { eventRoutes } from './routes/events.js';
import { emailSettingsRoutes } from './routes/emailSettings.js';
import { emailTemplateRoutes } from './routes/emailTemplates.js';
import { mapsSettingsRoutes } from './routes/mapsSettings.js';
import { metricsRoutes } from './routes/metrics.js';
import { arrivalCriteriaRoutes } from './routes/arrivalCriteria.js';
import { tenderRoutes } from './routes/tenders.js';
import { carrierPortalRoutes } from './routes/carrierPortal.js';
import { carrierUserRoutes } from './routes/carrierUsers.js';
import { ediTenderRoutes } from './routes/ediTender.js';
import { edi214Routes } from './routes/edi214.js';
import { tradingPartnerRoutes } from './routes/tradingPartners.js';
import deviceRoutes from './routes/devices.js';
import telemetryRoutes from './routes/telemetry.js';
import { cargoTrackingRoutes } from './routes/cargoTracking.js';
import { coldChainRoutes } from './routes/coldChain.js';
import { etaMonitorRoutes } from './routes/etaMonitor.js';
import { slaRoutes } from './routes/sla.js';
import { slaReportRoutes } from './routes/slaReports.js';
import { mapRoutes } from './routes/map.js';
import { locationOpsRoutes } from './routes/locationOps.js';
import { warehouseRoutes } from './routes/warehouse.js';
import { agentDecisionRoutes } from './routes/agentDecisions.js';
import { llmSettingsRoutes } from './routes/llmSettings.js';
import { agentConfigRoutes } from './routes/agentConfig.js';
import { automationRuleRoutes } from './routes/automationRules.js';
import { skillRoutes } from './routes/skills.js';

const server = Fastify({ logger: true });

async function start() {
  await server.register(cors, { origin: true });
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
  await server.register(documentRoutes);
  await server.register(dailyReportRoutes);
  await server.register(locationReportRoutes);
  await server.register(attachmentRoutes);
  await server.register(customFieldRoutes);
  await server.register(themeRoutes);
  await server.register(notificationRoutes);
  await server.register(eventRoutes);
  await server.register(emailSettingsRoutes);
  await server.register(emailTemplateRoutes);
  await server.register(mapsSettingsRoutes);
  await server.register(metricsRoutes);
  await server.register(arrivalCriteriaRoutes);
  await server.register(tenderRoutes);
  await server.register(carrierPortalRoutes);
  await server.register(carrierUserRoutes);
  await server.register(ediTenderRoutes);
  await server.register(edi214Routes);
  await server.register(tradingPartnerRoutes);
  await server.register(deviceRoutes);
  await server.register(telemetryRoutes);
  await server.register(cargoTrackingRoutes);
  await server.register(coldChainRoutes);
  await server.register(etaMonitorRoutes);
  await server.register(slaRoutes);
  await server.register(slaReportRoutes);
  await server.register(mapRoutes);
  await server.register(locationOpsRoutes);
  await server.register(warehouseRoutes);
  await server.register(agentDecisionRoutes);
  await server.register(llmSettingsRoutes);
  await server.register(agentConfigRoutes);
  await server.register(automationRuleRoutes);
  await server.register(skillRoutes);

  // Start queue adapter (needed for publishing events, even if workers run elsewhere)
  try {
    const queue = container.resolve<IQueueAdapter>(TOKENS.IQueueAdapter);
    await queue.start();
    server.log.info('Queue adapter started');

    // Register embedded workers ONLY if no separate worker container is running.
    // Set DISABLE_EMBEDDED_WORKERS=true when using `docker compose up` with the worker service.
    if (process.env.DISABLE_EMBEDDED_WORKERS !== 'true') {
      const deliveryService = new OrderDeliveryService(server.prisma);
      const arrivalCriteriaService = new ArrivalCriteriaEvaluationService(server.prisma, deliveryService);
      await queue.subscribe(QUEUES.OUTBOUND_CARRIER, createOutboundCarrierWorker(server.prisma));
      await queue.subscribe(QUEUES.OUTBOUND_TRACKING, createOutboundTrackingWorker(server.prisma));
      await queue.subscribe(QUEUES.INBOUND_WEBHOOK, createInboundWebhookWorker(server.prisma, deliveryService, arrivalCriteriaService));

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
