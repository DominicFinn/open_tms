/**
 * SLA Monitor Worker — pg-boss scheduled job that runs the SLA breach detection sweep.
 *
 * This worker runs every 2 minutes (configurable via SLA_MONITOR_CRON).
 * It calls SlaEvaluationService.runBreachSweep() which:
 * 1. Finds evaluations that have passed their warning threshold → transitions to 'warning'
 * 2. Finds evaluations that have passed their due date → transitions to 'breached'
 * 3. Auto-creates triage issues for breached SLAs (if configured on the rule)
 *
 * The event-driven SlaEvaluationHandler handles instant reactions (met, created).
 * This worker handles the time-based half — things that expire.
 */

import { PrismaClient } from '@prisma/client';
import { ISlaEvaluationService } from '../services/SlaEvaluationService.js';

export function createSlaMonitorWorker(
  prisma: PrismaClient,
  slaService: ISlaEvaluationService,
) {
  return async () => {
    console.log('[SlaMonitorWorker] Starting SLA breach detection sweep');

    try {
      const result = await slaService.runBreachSweep();

      console.log(
        `[SlaMonitorWorker] Sweep complete — ` +
        `checked: ${result.evaluationsChecked}, ` +
        `warnings: ${result.warningsIssued}, ` +
        `breaches: ${result.breachesDetected}, ` +
        `issues created: ${result.issuesCreated}`,
      );

      // Log summary — detailed metrics already printed above.
      // Future: write to a dedicated SLA monitor log table if needed.
    } catch (err) {
      console.error('[SlaMonitorWorker] Fatal error in SLA breach sweep:', (err as Error).message);
      throw err; // Let pg-boss retry
    }
  };
}

export async function registerSlaMonitorSchedule(
  boss: any,
  cronExpression?: string,
): Promise<void> {
  const cron = cronExpression || process.env.SLA_MONITOR_CRON || '*/2 * * * *';
  const queueName = 'sla-monitor';

  try {
    await boss.createQueue(queueName, {
      retryLimit: 1,
      retryDelay: 30,
      expireInSeconds: 110, // Must finish before next 2-min run
      deleteAfterSeconds: 86400,
    }).catch(() => {});

    await boss.schedule(queueName, cron, {}, { tz: 'UTC' });

    console.log(`[SlaMonitor] Cron schedule registered: "${cron}" on queue "${queueName}"`);
  } catch (err) {
    console.error('[SlaMonitor] Failed to register cron schedule:', (err as Error).message);
  }
}

export const SLA_MONITOR_QUEUE = 'sla-monitor';
