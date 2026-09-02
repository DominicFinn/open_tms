/**
 * ETA Monitor Worker — pg-boss scheduled job that runs the ETA monitoring cycle.
 *
 * This worker is registered as a cron schedule in pg-boss, running every 10 minutes.
 * It calls ShipmentEtaMonitorService.runEtaCheck() which internally handles
 * adaptive polling to avoid unnecessary API calls.
 *
 * Schedule: Every 10 minutes (configurable via ETA_MONITOR_CRON env var)
 * Default cron: * /10 * * * * (every 10 minutes)
 */

import { IShipmentEtaMonitorService } from '../services/routing/ShipmentEtaMonitorService.js';

/**
 * Creates the ETA monitor worker function for pg-boss.
 */
export function createEtaMonitorWorker(etaMonitorService: IShipmentEtaMonitorService) {
  return async () => {
    console.log('[EtaMonitorWorker] Starting ETA monitoring cycle');

    try {
      const result = await etaMonitorService.runEtaCheck();

      console.log(
        `[EtaMonitorWorker] Cycle complete — ` +
        `checked: ${result.shipmentsChecked}, ` +
        `skipped: ${result.shipmentsSkipped}, ` +
        `delays: ${result.delaysDetected}, ` +
        `errors: ${result.errorsEncountered}`,
      );

      // The run summary used to be written to WebhookLog. That table records
      // inbound HTTP webhooks and has no column for an internal run, so the
      // write never compiled and never ran. The console summary above is the
      // record; a proper counter belongs on /metrics.
    } catch (err) {
      console.error('[EtaMonitorWorker] Fatal error in ETA monitoring cycle:', (err as Error).message);
      throw err; // Let pg-boss retry
    }
  };
}

/**
 * Registers the ETA monitor as a pg-boss cron schedule.
 *
 * pg-boss v12+ supports boss.schedule() for cron-based recurring jobs.
 * This creates a self-re-enqueuing job that runs on the specified interval.
 */
export async function registerEtaMonitorSchedule(
  boss: any, // PgBoss instance
  cronExpression?: string,
): Promise<void> {
  const cron = cronExpression || process.env.ETA_MONITOR_CRON || '*/10 * * * *';
  const queueName = 'eta-monitor';

  try {
    await boss.createQueue(queueName, {
      retryLimit: 1,
      retryDelay: 60,
      expireInSeconds: 540, // 9 minutes (must finish before next run)
      deleteAfterSeconds: 86400, // Clean up completed jobs after 1 day
    }).catch(() => {});

    await boss.schedule(queueName, cron, {}, {
      tz: 'UTC',
    });

    console.log(`[EtaMonitor] Cron schedule registered: "${cron}" on queue "${queueName}"`);
  } catch (err) {
    console.error('[EtaMonitor] Failed to register cron schedule:', (err as Error).message);
  }
}

/** The pg-boss queue name for the ETA monitor */
export const ETA_MONITOR_QUEUE = 'eta-monitor';
