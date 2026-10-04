/**
 * Worker Process — runs in a SEPARATE Docker container from the API server.
 *
 * This process:
 * - Does NOT start Fastify or listen on any HTTP port
 * - Creates its own PrismaClient with its own connection pool
 * - Sets up the same DI container as the API (queue adapter, event bus, full command bus)
 * - Registers event handlers (audit, notifications, email, webhooks, triage)
 * - Optionally runs the existing operational workers (inbound webhook)
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
import { PgBossEventBus } from './events/PgBossEventBus.js';
import { registerEventHandlers } from './events/registerHandlers.js';
import { QUEUES } from './queue/events.js';
import { createInboundWebhookWorker } from './workers/inboundWebhookWorker.js';
import { IEmailService } from './services/IEmailService.js';
import { SmtpEmailService } from './services/SmtpEmailService.js';
import { ConsoleEmailService } from './services/ConsoleEmailService.js';
import { IBinaryStorageProvider } from './storage/IBinaryStorageProvider.js';
import { DatabaseBinaryStorage } from './storage/DatabaseBinaryStorage.js';
import { S3FileStorage } from './storage/S3FileStorage.js';
import { AnthropicLlmProvider } from './services/llm/AnthropicLlmProvider.js';
import { ILlmProvider } from './services/llm/ILlmProvider.js';
import { ICommandBus } from './commands/CommandBus.js';
import { registerDependencies } from './di/index.js';
import { container } from './di/container.js';
import { TOKENS } from './di/tokens.js';
import type { IQueueAdapter } from './queue/IQueueAdapter.js';
import type { IOrderDeliveryService } from './services/OrderDeliveryService.js';
import type { IArrivalCriteriaEvaluationService } from './services/ArrivalCriteriaEvaluationService.js';
import { DEFAULT_TRIAGE_PROMPT, DEFAULT_TRIAGE_EVENTS } from './events/handlers/TriageAgentHandler.js';
import { SkillRegistry } from './services/skills/SkillRegistry.js';
import { DocumentGenerationService, IDocumentGenerationService } from './services/DocumentGenerationService.js';
import { DocumentTemplateRepository } from './repositories/DocumentTemplateRepository.js';
import { GeneratedDocumentRepository } from './repositories/GeneratedDocumentRepository.js';
import { CreateIssueSkill } from './services/skills/CreateIssueSkill.js';
import { EscalateIssueSkill } from './services/skills/EscalateIssueSkill.js';
import { SendEmailSkill } from './services/skills/SendEmailSkill.js';
import { CallWebhookSkill } from './services/skills/CallWebhookSkill.js';
import { resolveSoleOrganizationId } from './auth/orgScope.js';

const WORKER_MODE = process.env.WORKER_MODE || 'all';

/** Give every org without one the default triage agent config. Safe to run on every start. */
async function seedTriageAgentConfigs(prisma: PrismaClient): Promise<void> {
  const orgs = await prisma.organization.findMany({
    where: { NOT: { agentConfigs: { some: { agentType: 'triage' } } } },
    select: { id: true },
  });
  for (const { id: orgId } of orgs) {
    const config = await prisma.agentConfig.create({
      data: {
        orgId,
        agentType: 'triage',
        name: 'Shipment Triage Agent',
        description: 'Analyzes shipment exceptions, SLA breaches, cargo issues, and cold chain excursions using AI to decide what action to take.',
        enabled: true,
        subscribedEvents: DEFAULT_TRIAGE_EVENTS,
        versions: {
          create: {
            versionNumber: 1,
            systemPrompt: DEFAULT_TRIAGE_PROMPT,
            changeNote: 'Default prompt (auto-seeded)',
            createdBy: 'system',
          },
        },
      },
      include: { versions: true },
    });
    await prisma.agentConfig.update({
      where: { id: config.id, orgId },
      data: { activeVersionId: config.versions[0].id },
    });
    console.log('[Worker] Auto-seeded default triage agent config (version 1)', { orgId });
  }
}

async function startWorker() {
  console.log(`[Worker] Starting in mode="${WORKER_MODE}"`);
  console.log(`[Worker] PID: ${process.pid}`);

  // Own Prisma client with dedicated connection pool
  const prisma = new PrismaClient();
  await prisma.$connect();
  console.log('[Worker] Database connected');

  // The same container as the API (#327): one queue adapter, one event bus and the full command
  // bus, so every command-driven handler runs here whether or not an LLM is configured.
  registerDependencies(prisma);
  const queue = container.resolve<IQueueAdapter>(TOKENS.IQueueAdapter);
  await queue.start();
  console.log('[Worker] Queue adapter started');
  const eventBus = container.resolve<PgBossEventBus>(TOKENS.IEventBus);
  const commandBus = container.resolve<ICommandBus>(TOKENS.ICommandBus);

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

    // LLM provider for AI agent features (optional).
    // BUSINESS RULE (#303): the worker builds one provider for the whole process, so an org's own
    // LLM key may only drive it when that org is the only tenant. With several orgs, one tenant's
    // key would pay for, and see, every other tenant's agent traffic, so the environment is used.
    let llmProvider: ILlmProvider | undefined;

    const soleOrgId = await resolveSoleOrganizationId(prisma);
    const org = soleOrgId
      ? await prisma.organization.findUnique({
          where: { id: soleOrgId },
          select: { llmProvider: true, llmApiKey: true, llmModel: true, llmEnabled: true },
        })
      : null;

    const llmApiKey = org?.llmApiKey || process.env.ANTHROPIC_API_KEY;
    const llmEnabled = org?.llmEnabled ?? !!process.env.ANTHROPIC_API_KEY;
    const llmModel = org?.llmModel || process.env.ANTHROPIC_MODEL;

    if (llmApiKey && llmEnabled) {
      llmProvider = new AnthropicLlmProvider({
        apiKey: llmApiKey,
        model: llmModel,
        baseURL: process.env.ANTHROPIC_BASE_URL,
      });


      const source = org?.llmApiKey ? 'org config' : 'env var';
      console.log(`[Worker] LLM provider configured (Anthropic via ${source}), AI agents enabled`);

      await seedTriageAgentConfigs(prisma);
    } else if (llmApiKey && !llmEnabled) {
      console.log('[Worker] LLM API key found but agents disabled (llmEnabled=false)');
    }

    // Build skill registry for automation rules (always available, even without LLM)
    const skillRegistry = new SkillRegistry();
    skillRegistry.register(new CreateIssueSkill(commandBus));
    skillRegistry.register(new EscalateIssueSkill(commandBus));
    skillRegistry.register(new CallWebhookSkill());
    if (emailService) {
      skillRegistry.register(new SendEmailSkill(emailService));
    }
    console.log(`[Worker] Skill registry: ${skillRegistry.getAll().length} skills registered`);

    // Document generation is what turns a completed load plan into a BOL. The worker builds its
    // own services rather than using the container, so it needs binary storage to be available;
    // without it there is no BOL subscriber and loads still complete and seal.
    const documentService: IDocumentGenerationService | undefined = storageProvider
      ? new DocumentGenerationService(
          prisma,
          new DocumentTemplateRepository(prisma),
          new GeneratedDocumentRepository(prisma),
          storageProvider
        )
      : undefined;

    await registerEventHandlers(eventBus, prisma, emailService, storageProvider, llmProvider, commandBus, skillRegistry, documentService);
    await eventBus.start();
    console.log('[Worker] Event handlers registered and started');
  }

  // Integration workers (inbound webhook). The legacy outbound carrier and
  // outbound tracking workers were removed — outbound EDI is now driven by
  // Edi856AutoSendHandler and Edi810AutoSendHandler off domain events.
  // In integrations-only mode this process runs no handlers, so its events go to the dispatch queue
  // for an events worker to fan out (#327).
  if (WORKER_MODE === 'all' || WORKER_MODE === 'integrations') {
    const deliveryService = container.resolve<IOrderDeliveryService>(TOKENS.IOrderDeliveryService);
    const arrivalCriteriaService = container.resolve<IArrivalCriteriaEvaluationService>(TOKENS.IArrivalCriteriaEvaluationService);
    await queue.subscribe(
      QUEUES.INBOUND_WEBHOOK,
      createInboundWebhookWorker(prisma, deliveryService, arrivalCriteriaService, eventBus),
    );
    console.log('[Worker] Integration workers registered');
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
