/**
 * Customer Webhook Retry Worker
 *
 * Scans CustomerWebhookDelivery rows with status='failed' and re-sends each
 * one whose exponential-backoff window has elapsed. Caps at 5 attempts per
 * delivery. Runs every minute by default; override with `WEBHOOK_RETRY_CRON`.
 *
 * Backoff per attempt:
 *   attempt 1 → wait 2 min
 *   attempt 2 → 4 min
 *   attempt 3 → 8 min
 *   attempt 4 → 16 min
 *   attempt 5+ → 30 min (capped)
 */

import { CustomerWebhookDeliveryService } from '../services/webhooks/CustomerWebhookDeliveryService.js';

const MAX_ATTEMPTS = 5;

export function createWebhookRetryWorker(service: CustomerWebhookDeliveryService) {
  return async () => {
    console.log('[WebhookRetryWorker] Scanning for eligible retries');
    try {
      const eligible = await service.findEligibleForRetry(MAX_ATTEMPTS);
      if (eligible.length === 0) {
        return;
      }
      let delivered = 0, stillFailed = 0;
      for (const row of eligible) {
        try {
          const r = await service.retry(row.id);
          if (r.status === 'delivered') delivered++;
          else stillFailed++;
        } catch (err) {
          console.error(`[WebhookRetryWorker] Retry ${row.id} threw:`, (err as Error).message);
          stillFailed++;
        }
      }
      console.log(`[WebhookRetryWorker] Retried ${eligible.length}: ${delivered} delivered, ${stillFailed} still failed`);
    } catch (err) {
      console.error('[WebhookRetryWorker] Fatal:', (err as Error).message);
      throw err;
    }
  };
}

export const WEBHOOK_RETRY_QUEUE = 'webhook-retry';

export async function registerWebhookRetrySchedule(boss: any, cronExpression?: string): Promise<void> {
  const cron = cronExpression || process.env.WEBHOOK_RETRY_CRON || '*/1 * * * *';
  try {
    await boss.createQueue(WEBHOOK_RETRY_QUEUE, {
      retryLimit: 1,
      retryDelay: 30,
      expireInSeconds: 50,
      deleteAfterSeconds: 86400,
    }).catch(() => {});
    await boss.schedule(WEBHOOK_RETRY_QUEUE, cron, {}, { tz: 'UTC' });
    console.log(`[WebhookRetry] Cron registered: "${cron}" on queue "${WEBHOOK_RETRY_QUEUE}"`);
  } catch (err) {
    console.error('[WebhookRetry] Failed to register cron:', (err as Error).message);
  }
}
