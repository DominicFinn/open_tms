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
    const eventBus = new PgBossEventBus(prisma, queue);
    await registerEventHandlers(eventBus, prisma);
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
