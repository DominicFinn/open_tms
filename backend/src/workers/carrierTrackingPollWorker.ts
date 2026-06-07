/**
 * Carrier Tracking Poll Worker -- pg-boss scheduled job that polls active
 * carrier tracking integrations for shipment status updates.
 *
 * Schedule: Every 5 minutes (configurable via CARRIER_TRACKING_POLL_CRON env var)
 * Default cron: *​/5 * * * * (every 5 minutes)
 *
 * For each active polling integration, checks whether enough time has elapsed
 * since the last poll (based on pollingIntervalSeconds), then calls
 * CarrierTrackingService.pollForUpdates(). Each integration is wrapped in
 * try/catch so one failure does not stop others.
 */

import { PrismaClient } from '@prisma/client';
import { CarrierTrackingService } from '../services/carrierTracking/CarrierTrackingService.js';
import { ICarrierTrackingIntegrationRepository } from '../repositories/CarrierTrackingIntegrationRepository.js';

/**
 * Creates the carrier tracking poll worker function for pg-boss.
 */
export function createCarrierTrackingPollWorker(
  prisma: PrismaClient,
  trackingService: CarrierTrackingService,
  integrationRepo: ICarrierTrackingIntegrationRepository,
) {
  return async () => {
    console.log('[CarrierTrackingPollWorker] Starting carrier tracking poll cycle');

    let polled = 0;
    let skipped = 0;
    let errors = 0;
    let totalEvents = 0;

    try {
      // Find all active integrations with polling enabled
      const integrations = await integrationRepo.findActivePollingIntegrations();

      if (integrations.length === 0) {
        console.log('[CarrierTrackingPollWorker] No active polling integrations found');
        return;
      }

      const now = Date.now();

      // Filter out integrations that haven't waited long enough since their
      // last poll. Counting these once up-front means we don't burn a
      // concurrency slot on a no-op.
      const due = integrations.filter((integration) => {
        const intervalMs = (integration.pollingIntervalSeconds ?? 900) * 1000;
        const lastPolledAt = integration.lastPolledAt ? new Date(integration.lastPolledAt).getTime() : 0;
        if (now - lastPolledAt < intervalMs) {
          skipped++;
          return false;
        }
        return true;
      });

      // Run integrations in parallel with bounded concurrency so one slow
      // carrier (e.g. a DHL OAuth handshake hanging on auth) doesn't delay
      // the rest. Per-provider rate limits are enforced inside each
      // provider, so this only affects worker fan-out, not API courtesy.
      const concurrency = Math.max(1, Math.min(parseInt(process.env.CARRIER_TRACKING_POLL_CONCURRENCY || '', 10) || 5, 20));

      const pollOne = async (integration: typeof due[number]): Promise<void> => {
        try {
          const result = await trackingService.pollForUpdates(integration.id);
          polled++;
          totalEvents += result.eventsCreated;
          if (result.eventsCreated > 0) {
            console.log(
              `[CarrierTrackingPollWorker] Integration ${integration.id} (${integration.carrier.name}): ` +
              `polled ${result.polled} shipments, ${result.eventsCreated} new events`
            );
          }
        } catch (err) {
          errors++;
          console.error(
            `[CarrierTrackingPollWorker] Error polling integration ${integration.id} ` +
            `(${integration.carrier.name}): ${(err as Error).message}`
          );
          // Swallow so one failure doesn't poison the batch
        }
      };

      // Simple worker-pool: each "lane" pulls the next integration off a
      // shared queue until empty. Avoids the chunked-batch problem where
      // the slowest integration in each batch blocks the next batch.
      const queue = [...due];
      const lanes: Array<Promise<void>> = [];
      for (let i = 0; i < Math.min(concurrency, queue.length); i++) {
        lanes.push((async () => {
          while (queue.length > 0) {
            const next = queue.shift();
            if (!next) return;
            await pollOne(next);
          }
        })());
      }
      await Promise.all(lanes);
    } catch (err) {
      console.error('[CarrierTrackingPollWorker] Fatal error in poll cycle:', (err as Error).message);
      throw err; // Let pg-boss retry
    }

    // Structured log line for observability — was previously written to
    // WebhookLog with fields that didn't match the schema, so the create
    // call was a TS error and would have failed at runtime.
    console.log(
      JSON.stringify({
        type: 'carrier_tracking_poll_run',
        polled,
        skipped,
        errors,
        totalEvents,
        status: errors > 0 ? 'partial' : 'success',
        completedAt: new Date().toISOString(),
      })
    );
  };
}

/**
 * Registers the carrier tracking poll as a pg-boss cron schedule.
 */
export async function registerCarrierTrackingPollSchedule(
  boss: any, // PgBoss instance
  cronExpression?: string,
): Promise<void> {
  const cron = cronExpression || process.env.CARRIER_TRACKING_POLL_CRON || '*/5 * * * *';
  const queueName = 'carrier-tracking-poll';

  try {
    await boss.createQueue(queueName, {
      retryLimit: 1,
      retryDelay: 60,
      expireInSeconds: 270, // 4.5 minutes (must finish before next run)
      deleteAfterSeconds: 86400, // Clean up completed jobs after 1 day
    }).catch(() => {});

    await boss.schedule(queueName, cron, {}, {
      tz: 'UTC',
    });

    console.log(`[CarrierTrackingPoll] Cron schedule registered: "${cron}" on queue "${queueName}"`);
  } catch (err) {
    console.error('[CarrierTrackingPoll] Failed to register cron schedule:', (err as Error).message);
  }
}

/** The pg-boss queue name for the carrier tracking poll */
export const CARRIER_TRACKING_POLL_QUEUE = 'carrier-tracking-poll';
