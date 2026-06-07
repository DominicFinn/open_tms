/**
 * documentGenerationWorker — async PDF generation.
 *
 * Subscribers to QUEUES.DOCUMENT_GENERATION receive { kind, entityId,
 * templateId, correlationId } payloads, call the corresponding method on
 * DocumentGenerationService, and stamp the resulting GeneratedDocument row's
 * metadata with the correlationId so the status endpoint can resolve it.
 *
 * Clients poll GET /api/v1/documents/jobs/:correlationId.
 *
 * This was previously inline in the request path which blocked Fastify
 * for the full PDF render time (typically 100-500ms of CPU per document).
 */

import type { PrismaClient } from '@prisma/client';
import type { IDocumentGenerationService } from '../services/DocumentGenerationService.js';
import type { QueueMessage } from '../queue/IQueueAdapter.js';
import type { DocumentGenerationJob } from '../queue/events.js';

export function createDocumentGenerationWorker(
  docService: IDocumentGenerationService,
  prisma: PrismaClient,
) {
  return async (message: QueueMessage): Promise<void> => {
    const job = message.payload as DocumentGenerationJob;
    if (!job?.kind || !job?.entityId) {
      throw new Error('Invalid document generation job payload');
    }

    const startedAt = Date.now();
    try {
      let result: { id: string; fileName: string };
      switch (job.kind) {
        case 'bol':
          result = await docService.generateBOL(job.entityId, job.templateId ?? undefined, job.requestedBy ?? undefined);
          break;
        case 'labels':
          result = await docService.generateLabels(job.entityId, job.templateId ?? undefined, job.requestedBy ?? undefined);
          break;
        case 'customs':
          result = await docService.generateCustomsForm(job.entityId, job.templateId ?? undefined, job.requestedBy ?? undefined);
          break;
        case 'rate_confirmation':
          result = await docService.generateRateConfirmation(job.entityId, job.requestedBy ?? undefined);
          break;
        default: {
          const exhaustive: never = job.kind;
          throw new Error(`Unsupported document kind: ${String(exhaustive)}`);
        }
      }

      // Stamp the correlationId onto the document's metadata so the status
      // endpoint can resolve "did my job finish?" with a single query.
      const existing = await prisma.generatedDocument.findUnique({
        where: { id: result.id },
        select: { metadata: true },
      });
      const mergedMetadata = {
        ...((existing?.metadata as Record<string, unknown>) ?? {}),
        correlationId: job.correlationId,
        generationKind: job.kind,
      };
      await prisma.generatedDocument.update({
        where: { id: result.id },
        data: { metadata: mergedMetadata },
      });

      console.log(
        `[DocumentGenerationWorker] Completed kind=${job.kind} entityId=${job.entityId} ` +
        `correlationId=${job.correlationId} -> ${result.id} in ${Date.now() - startedAt}ms`
      );
    } catch (err: any) {
      console.error(
        `[DocumentGenerationWorker] Failed kind=${job.kind} entityId=${job.entityId} ` +
        `correlationId=${job.correlationId}: ${err.message}`
      );
      // Re-throw so pg-boss retries the job. After retryLimit, it lands
      // on the dead-letter queue and the status endpoint will report
      // 'failed'.
      throw err;
    }
  };
}
