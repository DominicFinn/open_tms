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

      for (const integration of integrations) {
        // Check if enough time has passed since last poll
        const intervalMs = (integration.pollingIntervalSeconds ?? 900) * 1000;
        const lastPolledAt = integration.lastPolledAt ? new Date(integration.lastPolledAt).getTime() : 0;

        if (now - lastPolledAt < intervalMs) {
          skipped++;
          continue;
        }

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
          // Continue to next integration -- do not stop on individual failures
        }
      }
    } catch (err) {
      console.error('[CarrierTrackingPollWorker] Fatal error in poll cycle:', (err as Error).message);
      throw err; // Let pg-boss retry
    }

    console.log(
      `[CarrierTrackingPollWorker] Cycle complete -- ` +
      `polled: ${polled}, skipped: ${skipped}, errors: ${errors}, events: ${totalEvents}`
    );

    // Log summary to database for observability
    await prisma.webhookLog.create({
      data: {
        orgId: 'system',
        provider: 'carrier-tracking-poll',
        direction: 'internal',
        rawPayload: {
          type: 'carrier_tracking_poll_run',
          polled,
          skipped,
          errors,
          totalEvents,
          completedAt: new Date().toISOString(),
        },
        status: errors > 0 ? 'partial' : 'success',
        processedAt: new Date(),
      },
    }).catch((logErr: Error) => {
      // Non-critical: if logging fails, do not break the worker
      console.warn('[CarrierTrackingPollWorker] Failed to log run summary:', logErr.message);
    });
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
