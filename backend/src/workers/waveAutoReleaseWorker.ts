/**
 * Wave Auto-Release Worker
 *
 * Scans wave templates with `autoRelease = true` and fires APPLY_WAVE_TEMPLATE
 * when their scheduled release time has passed and they haven't been auto-released
 * within the dedup window.
 *
 * Default cron: every 5 minutes. Override with `WAVE_AUTO_RELEASE_CRON`.
 */

import { WaveAutoReleaseService } from '../services/waves/WaveAutoReleaseService.js';

export function createWaveAutoReleaseWorker(service: WaveAutoReleaseService) {
  return async () => {
    console.log('[WaveAutoReleaseWorker] Scanning templates for due auto-release');
    try {
      const r = await service.runOnce();
      console.log(
        `[WaveAutoReleaseWorker] Checked ${r.templatesChecked} templates, triggered ${r.templatesTriggered}. ` +
        r.triggered.map(t => `${t.name}${t.waveNumber ? ` → ${t.waveNumber}` : ''}${t.skipped ? ` (skipped: ${t.reason ?? 'no eligible'})` : ''}`).join(', '),
      );
    } catch (err) {
      console.error('[WaveAutoReleaseWorker] Fatal:', (err as Error).message);
      throw err;
    }
  };
}

export const WAVE_AUTO_RELEASE_QUEUE = 'wave-auto-release';

export async function registerWaveAutoReleaseSchedule(boss: any, cronExpression?: string): Promise<void> {
  const cron = cronExpression || process.env.WAVE_AUTO_RELEASE_CRON || '*/5 * * * *';
  try {
    await boss.createQueue(WAVE_AUTO_RELEASE_QUEUE, {
      retryLimit: 1,
      retryDelay: 30,
      expireInSeconds: 260,
      deleteAfterSeconds: 86400,
    }).catch(() => {});
    await boss.schedule(WAVE_AUTO_RELEASE_QUEUE, cron, {}, { tz: 'UTC' });
    console.log(`[WaveAutoRelease] Cron registered: "${cron}" on queue "${WAVE_AUTO_RELEASE_QUEUE}"`);
  } catch (err) {
    console.error('[WaveAutoRelease] Failed to register cron:', (err as Error).message);
  }
}
