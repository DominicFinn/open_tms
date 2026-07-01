import { CarrierUserAnonymizationService } from '../services/CarrierUserAnonymizationService.js';

export const CARRIER_USER_ANONYMIZE_QUEUE = 'carrier-user-anonymize';

export function createCarrierUserAnonymizeWorker(service: CarrierUserAnonymizationService) {
  return async () => {
    console.log('[CarrierUserAnonymizeWorker] Scanning carrier users eligible for anonymisation');
    try {
      const result = await service.runOnce();
      console.log(
        `[CarrierUserAnonymizeWorker] Scanned ${result.scanned}, anonymised ${result.anonymized}, errors ${result.errors}`,
      );
    } catch (err) {
      console.error('[CarrierUserAnonymizeWorker] Fatal error during scan:', (err as Error).message);
      throw err;
    }
  };
}

export async function registerCarrierUserAnonymizeSchedule(boss: any, cronExpression?: string): Promise<void> {
  const cron = cronExpression || process.env.CARRIER_USER_ANONYMIZE_CRON || '0 3 * * *';
  try {
    await boss.createQueue(CARRIER_USER_ANONYMIZE_QUEUE, {
      retryLimit: 1,
      retryDelay: 60,
      expireInSeconds: 600,
      deleteAfterSeconds: 86400,
    }).catch(() => {});

    await boss.schedule(CARRIER_USER_ANONYMIZE_QUEUE, cron, {}, { tz: 'UTC' });
    console.log(`[CarrierUserAnonymize] Cron schedule registered: "${cron}" on queue "${CARRIER_USER_ANONYMIZE_QUEUE}"`);
  } catch (err) {
    console.error('[CarrierUserAnonymize] Failed to register cron schedule:', (err as Error).message);
  }
}
