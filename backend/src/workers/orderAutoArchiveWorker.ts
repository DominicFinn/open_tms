import { OrderAutoArchiveService } from '../services/OrderAutoArchiveService.js';

export const ORDER_AUTO_ARCHIVE_QUEUE = 'order-auto-archive';

export function createOrderAutoArchiveWorker(service: OrderAutoArchiveService) {
  return async () => {
    console.log('[OrderAutoArchiveWorker] Scanning orders eligible for auto-archive');
    try {
      const result = await service.runOnce();
      console.log(
        `[OrderAutoArchiveWorker] Scanned ${result.scanned} candidates, archived ${result.archived}, errors ${result.errors}`,
      );
    } catch (err) {
      console.error('[OrderAutoArchiveWorker] Fatal error during scan:', (err as Error).message);
      throw err;
    }
  };
}

export async function registerOrderAutoArchiveSchedule(boss: any, cronExpression?: string): Promise<void> {
  const cron = cronExpression || process.env.ORDER_AUTO_ARCHIVE_CRON || '0 2 * * *';
  try {
    await boss.createQueue(ORDER_AUTO_ARCHIVE_QUEUE, {
      retryLimit: 1,
      retryDelay: 60,
      expireInSeconds: 600,
      deleteAfterSeconds: 86400,
    }).catch(() => {});

    await boss.schedule(ORDER_AUTO_ARCHIVE_QUEUE, cron, {}, { tz: 'UTC' });
    console.log(`[OrderAutoArchive] Cron schedule registered: "${cron}" on queue "${ORDER_AUTO_ARCHIVE_QUEUE}"`);
  } catch (err) {
    console.error('[OrderAutoArchive] Failed to register cron schedule:', (err as Error).message);
  }
}
