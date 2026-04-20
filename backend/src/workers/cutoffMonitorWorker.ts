/**
 * Cutoff-at-risk monitor worker.
 *
 * Runs on a pg-boss cron schedule (default every 5 minutes). For every open,
 * carrier-assigned shipment: look up today's carrier cutoff, estimate projected
 * warehouse-ready time from remaining pick/pack/load work, and fire
 * shipment.cutoff_at_risk (+ auto-create an Issue) when the projected ready
 * time is past or within the warning/critical window of the cutoff.
 */

import { ShipmentCutoffMonitorService } from '../services/cutoff/ShipmentCutoffMonitorService.js';

export function createCutoffMonitorWorker(service: ShipmentCutoffMonitorService) {
  return async () => {
    console.log('[CutoffMonitorWorker] Scanning shipments for cutoff risk');
    try {
      const results = await service.runOnce();
      const atRisk = results.filter(r => r.severity && r.severity !== null);
      const notified = results.filter(r => r.notified).length;
      const critical = atRisk.filter(r => r.severity === 'critical').length;
      const warning = atRisk.filter(r => r.severity === 'warning').length;
      console.log(
        `[CutoffMonitorWorker] Evaluated ${results.length} shipments - ` +
        `at risk: ${atRisk.length} (${critical} critical, ${warning} warning), ` +
        `notifications fired: ${notified}`,
      );
    } catch (err) {
      console.error('[CutoffMonitorWorker] Fatal error during scan:', (err as Error).message);
      throw err;
    }
  };
}

export const CUTOFF_MONITOR_QUEUE = 'cutoff-monitor';

export async function registerCutoffMonitorSchedule(boss: any, cronExpression?: string): Promise<void> {
  const cron = cronExpression || process.env.CUTOFF_MONITOR_CRON || '*/5 * * * *';
  try {
    await boss.createQueue(CUTOFF_MONITOR_QUEUE, {
      retryLimit: 1,
      retryDelay: 30,
      expireInSeconds: 260,
      deleteAfterSeconds: 86400,
    }).catch(() => {});

    await boss.schedule(CUTOFF_MONITOR_QUEUE, cron, {}, { tz: 'UTC' });
    console.log(`[CutoffMonitor] Cron schedule registered: "${cron}" on queue "${CUTOFF_MONITOR_QUEUE}"`);
  } catch (err) {
    console.error('[CutoffMonitor] Failed to register cron schedule:', (err as Error).message);
  }
}
