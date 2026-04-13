/**
 * EDI Retry Worker - pg-boss scheduled job that retries failed EDI deliveries.
 *
 * Runs every 15 minutes (configurable via EDI_RETRY_CRON env var).
 * Finds EdiTransactionLog entries with status='error' and retryCount < maxRetries,
 * then re-attempts delivery for outbound or re-processing for inbound.
 *
 * Schedule: Every 15 minutes
 * Default cron: * /15 * * * *
 */

import { PrismaClient } from '@prisma/client';
import { ITradingPartnerRepository } from '../repositories/TradingPartnerRepository.js';
import { IOutboundEdiDeliveryService } from '../services/OutboundEdiDeliveryService.js';

export const EDI_RETRY_QUEUE = 'edi-retry';
const MAX_RETRIES = 3;

export function createEdiRetryWorker(
  prisma: PrismaClient,
  partnerRepo: ITradingPartnerRepository,
  deliveryService: IOutboundEdiDeliveryService,
) {
  return async () => {
    console.log('[EdiRetryWorker] Starting retry cycle');

    // Find failed logs eligible for retry
    const failedLogs = await prisma.ediTransactionLog.findMany({
      where: {
        status: 'error',
        retryCount: { lt: MAX_RETRIES },
        fileContent: { not: null }, // Need content to retry
      },
      include: {
        partner: { select: { id: true, name: true, active: true, outboundEnabled: true, outboundTransport: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 20, // Process max 20 per cycle to avoid overload
    });

    if (failedLogs.length === 0) {
      console.log('[EdiRetryWorker] No failed logs to retry');
      return;
    }

    console.log(`[EdiRetryWorker] Found ${failedLogs.length} failed log(s) to retry`);

    let retried = 0;
    let succeeded = 0;
    let failed = 0;

    for (const log of failedLogs) {
      try {
        // Mark as retrying
        await partnerRepo.updateLog(log.id, {
          retryCount: log.retryCount + 1,
          lastRetryAt: new Date(),
          status: 'processing',
          errorMessage: null,
        });

        if (log.direction === 'outbound' && log.partnerId && log.partner?.active) {
          // Retry outbound delivery
          const result = await deliveryService.deliver({
            partnerId: log.partnerId,
            transactionType: log.transactionType,
            ediContent: log.fileContent!,
            referenceId: log.shipmentReference || log.invoiceNumber || log.id,
            shipmentId: log.shipmentId || undefined,
            tenderId: log.tenderId || undefined,
            orderId: log.orderId || undefined,
          });

          if (result.success) {
            await partnerRepo.updateLog(log.id, {
              status: 'success',
              processedAt: new Date(),
              errorMessage: null,
            });
            succeeded++;
          } else {
            await partnerRepo.updateLog(log.id, {
              status: 'error',
              errorMessage: `Retry ${log.retryCount + 1}/${MAX_RETRIES}: ${result.errorMessage}`,
            });
            failed++;
          }
        } else if (log.direction === 'inbound') {
          // For inbound, re-post to the universal endpoint would be complex
          // Instead, just mark it for manual attention if retries exhausted
          await partnerRepo.updateLog(log.id, {
            status: 'error',
            errorMessage: `Retry ${log.retryCount + 1}/${MAX_RETRIES}: Inbound re-processing requires manual action via /api/v1/edi-logs/${log.id}/retry`,
          });
          failed++;
        } else {
          // Partner inactive or no partner - can't retry
          await partnerRepo.updateLog(log.id, {
            status: 'error',
            errorMessage: `Cannot retry: ${!log.partnerId ? 'no partner' : 'partner inactive'}`,
          });
          failed++;
        }

        retried++;
      } catch (err: any) {
        await partnerRepo.updateLog(log.id, {
          status: 'error',
          errorMessage: `Retry error: ${err.message}`,
        }).catch(() => {});
        failed++;
        retried++;
      }
    }

    console.log(`[EdiRetryWorker] Cycle complete - retried: ${retried}, succeeded: ${succeeded}, failed: ${failed}`);
  };
}

export async function registerEdiRetrySchedule(
  boss: any,
  cronExpression?: string,
): Promise<void> {
  const cron = cronExpression || process.env.EDI_RETRY_CRON || '*/15 * * * *';

  try {
    await boss.schedule(EDI_RETRY_QUEUE, cron, {}, {
      retryLimit: 1,
      retryBackoff: true,
    });
    console.log(`[EdiRetryWorker] Scheduled with cron: ${cron}`);
  } catch (err: any) {
    console.warn(`[EdiRetryWorker] Failed to register schedule: ${err.message}`);
  }
}
