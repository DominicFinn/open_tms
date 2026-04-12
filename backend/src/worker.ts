/**
 * Worker Process — runs in a SEPARATE Docker container from the API server.
 *
 * This process:
 * - Does NOT start Fastify or listen on any HTTP port
 * - Creates its own PrismaClient with its own connection pool
 * - Creates its own PgBossQueueAdapter
 * - Registers event handlers (audit, notifications, email, webhooks, triage)
 * - Optionally runs the existing operational workers (outbound carrier/tracking, inbound webhook)
 *
 * The API server (index.ts) only publishes events — this process consumes them.
 * This ensures workers never starve the API of resources (CPU, memory, connections).
 *
 * Environment variables:
 *   WORKER_MODE: "all" | "events" | "integrations" (default: "all")
 *   DATABASE_URL: PostgreSQL connection string (use ?connection_limit=5 for worker pools)
 *
 * Docker usage:
 *   docker compose up --scale worker=3
 */

import { PrismaClient } from '@prisma/client';
import { PgBossQueueAdapter } from './queue/PgBossQueueAdapter.js';
import { PgBossEventBus } from './events/PgBossEventBus.js';
import { registerEventHandlers } from './events/registerHandlers.js';
import { QUEUES } from './queue/events.js';
import { createOutboundCarrierWorker } from './workers/outboundCarrierWorker.js';
import { createOutboundTrackingWorker } from './workers/outboundTrackingWorker.js';
import { createInboundWebhookWorker } from './workers/inboundWebhookWorker.js';
import { OrderDeliveryService } from './services/OrderDeliveryService.js';
import { IEmailService } from './services/IEmailService.js';
import { SmtpEmailService } from './services/SmtpEmailService.js';
import { ConsoleEmailService } from './services/ConsoleEmailService.js';
import { IBinaryStorageProvider } from './storage/IBinaryStorageProvider.js';
import { DatabaseBinaryStorage } from './storage/DatabaseBinaryStorage.js';
import { S3FileStorage } from './storage/S3FileStorage.js';
import { AnthropicLlmProvider } from './services/llm/AnthropicLlmProvider.js';
import { ILlmProvider } from './services/llm/ILlmProvider.js';
import { CommandBus, ICommandBus } from './commands/CommandBus.js';
import { CreateAgentDecisionCommandHandler } from './commands/agentDecisions/CreateAgentDecisionCommand.js';
import { RecordDecisionOutcomeCommandHandler } from './commands/agentDecisions/RecordDecisionOutcomeCommand.js';
import { PromoteDecisionCommandHandler } from './commands/agentDecisions/PromoteDecisionCommand.js';
import { CreateIssueCommandHandler } from './commands/issues/CreateIssueCommand.js';
import { UpdateIssueCommandHandler } from './commands/issues/UpdateIssueCommand.js';
import { EscalateIssueCommandHandler } from './commands/issues/EscalateIssueCommand.js';

const WORKER_MODE = process.env.WORKER_MODE || 'all';

async function startWorker() {
  console.log(`[Worker] Starting in mode="${WORKER_MODE}"`);
  console.log(`[Worker] PID: ${process.pid}`);

  // Own Prisma client with dedicated connection pool
  const prisma = new PrismaClient();
  await prisma.$connect();
  console.log('[Worker] Database connected');

  // Own queue adapter
  const dbUrl = process.env.DATABASE_URL || '';
  const queue = new PgBossQueueAdapter(dbUrl);
  await queue.start();
  console.log('[Worker] Queue adapter started');

  // Integration workers (outbound carrier, outbound tracking, inbound webhook)
  if (WORKER_MODE === 'all' || WORKER_MODE === 'integrations') {
    const deliveryService = new OrderDeliveryService(prisma);
    await queue.subscribe(QUEUES.OUTBOUND_CARRIER, createOutboundCarrierWorker(prisma));
    await queue.subscribe(QUEUES.OUTBOUND_TRACKING, createOutboundTrackingWorker(prisma));
    await queue.subscribe(QUEUES.INBOUND_WEBHOOK, createInboundWebhookWorker(prisma, deliveryService));
    console.log('[Worker] Integration workers registered');
  }

  // Event handlers (audit, notifications, email, webhooks, triage)
  if (WORKER_MODE === 'all' || WORKER_MODE === 'events') {
    // Create email service for the worker
    const emailProvider = process.env.EMAIL_PROVIDER || 'console';
    let emailService: IEmailService;
    if (emailProvider === 'smtp') {
      emailService = new SmtpEmailService({
        host: process.env.SMTP_HOST || 'localhost',
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        user: process.env.SMTP_USER || '',
        password: process.env.SMTP_PASSWORD || '',
        fromEmail: process.env.EMAIL_FROM_ADDRESS || 'noreply@opentms.local',
        fromName: process.env.EMAIL_FROM_NAME || 'Open TMS',
      });
      console.log(`[Worker] Email service: SMTP (${process.env.SMTP_HOST}:${process.env.SMTP_PORT})`);
    } else {
      emailService = new ConsoleEmailService();
      console.log('[Worker] Email service: console (emails logged to stdout)');
    }

    // Create storage provider for compliance report generation
    let storageProvider: IBinaryStorageProvider;
    const s3Endpoint = process.env.S3_ENDPOINT;
    const s3Bucket = process.env.S3_BUCKET;
    if (s3Endpoint && s3Bucket) {
      storageProvider = new S3FileStorage({
        endpoint: s3Endpoint,
        bucket: s3Bucket,
        region: process.env.S3_REGION || 'us-east-1',
        accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
      });
    } else {
      storageProvider = new DatabaseBinaryStorage(prisma);
    }

    const eventBus = new PgBossEventBus(prisma, queue);

    // LLM provider for AI agent features (optional)
    // Priority: org database config > environment variables
    let llmProvider: ILlmProvider | undefined;
    let workerCommandBus: ICommandBus | undefined;

    const org = await prisma.organization.findFirst({
      select: { llmProvider: true, llmApiKey: true, llmModel: true, llmEnabled: true },
    });

    const llmApiKey = org?.llmApiKey || process.env.ANTHROPIC_API_KEY;
    const llmEnabled = org?.llmEnabled ?? !!process.env.ANTHROPIC_API_KEY;
    const llmModel = org?.llmModel || process.env.ANTHROPIC_MODEL;

    if (llmApiKey && llmEnabled) {
      llmProvider = new AnthropicLlmProvider({
        apiKey: llmApiKey,
        model: llmModel,
        baseURL: process.env.ANTHROPIC_BASE_URL,
      });

      // Worker-local command bus for agent handlers to dispatch commands
      const bus = new CommandBus();
      bus.register(new CreateAgentDecisionCommandHandler(prisma, eventBus));
      bus.register(new RecordDecisionOutcomeCommandHandler(prisma, eventBus));
      bus.register(new PromoteDecisionCommandHandler(prisma, eventBus));
      bus.register(new CreateIssueCommandHandler(prisma, eventBus));
      bus.register(new UpdateIssueCommandHandler(prisma, eventBus));
      bus.register(new EscalateIssueCommandHandler(prisma, eventBus));
      workerCommandBus = bus;

      const source = org?.llmApiKey ? 'org config' : 'env var';
      console.log(`[Worker] LLM provider configured (Anthropic via ${source}), AI agents enabled`);
    } else if (llmApiKey && !llmEnabled) {
      console.log('[Worker] LLM API key found but agents disabled (llmEnabled=false)');
    }

    await registerEventHandlers(eventBus, prisma, emailService, storageProvider, llmProvider, workerCommandBus);
    await eventBus.start();
    console.log('[Worker] Event handlers registered and started');
  }

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`[Worker] Received ${signal}, shutting down gracefully...`);
    try {
      await queue.stop();
      await prisma.$disconnect();
    } catch (err) {
      console.error('[Worker] Error during shutdown:', err);
    }
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  console.log(`[Worker] Running in "${WORKER_MODE}" mode. Waiting for jobs...`);
}

startWorker().catch((err) => {
  console.error('[Worker] Fatal error:', err);
  process.exit(1);
});
