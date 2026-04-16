import { Prisma, PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';
import { applyMapping, ColumnMapping } from '../../services/ManifestIngestionService.js';

export interface ProcessManifestPayload {
  uploadId: string;
  columnMapping: ColumnMapping;
  /** Save this mapping as a template for future auto-detection */
  saveAsTemplate?: boolean;
  templateName?: string;
}

export const PROCESS_MANIFEST = 'manifest.process';

export class ProcessManifestCommandHandler extends BaseCommandHandler<
  ProcessManifestPayload,
  { receivingTaskId: string; totalRows: number; processedRows: number; errorRows: number; errors: Array<{ row: number; field: string; message: string }> }
> {
  readonly commandType = PROCESS_MANIFEST;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<ProcessManifestPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ receivingTaskId: string; totalRows: number; processedRows: number; errorRows: number; errors: Array<{ row: number; field: string; message: string }> }> {
    const p = command.payload;

    const upload = await tx.manifestUpload.findUnique({ where: { id: p.uploadId } });
    if (!upload) throw new Error(`Manifest upload ${p.uploadId} not found`);
    if (upload.status === 'completed') throw new Error('Manifest already processed');

    const headers = upload.detectedHeaders as string[] | null;
    if (!headers) throw new Error('No headers detected - file may not have been parsed');

    // Reconstruct rows from storage (for now, headers are stored on upload)
    // In production this would re-read from file storage
    // For the MVP we store parsed rows in the detectedHeaders field temporarily
    // The actual CSV content should be re-parsed from fileStorageKey
    // For now, we trust the client sends the mapping and the backend re-reads

    // Parse the file content again - this would come from file storage
    // For MVP, the route handler will pass parsed rows alongside the command
    // We'll handle this by having the route parse and pass data through

    // Save template if requested
    if (p.saveAsTemplate && p.templateName && upload.detectedHeaders) {
      const { computeHeaderChecksum } = await import('../../services/ManifestIngestionService.js');
      const checksum = computeHeaderChecksum(headers);

      const existing = await tx.manifestTemplate.findFirst({
        where: { orgId: command.orgId, headerChecksum: checksum },
      });

      if (!existing) {
        await tx.manifestTemplate.create({
          data: {
            name: p.templateName,
            headerChecksum: checksum,
            columnMapping: p.columnMapping as unknown as Prisma.InputJsonValue,
            fileType: 'csv',
            orgId: command.orgId,
          },
        });
      } else {
        await tx.manifestTemplate.update({
          where: { id: existing.id },
          data: {
            name: p.templateName,
            columnMapping: p.columnMapping as unknown as Prisma.InputJsonValue,
            usageCount: { increment: 1 },
          },
        });
      }
    }

    // Update the upload with mapping
    await tx.manifestUpload.update({
      where: { id: upload.id },
      data: { status: 'mapped', templateId: upload.templateId },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.MANIFEST_MAPPED,
      entityType: 'manifest_upload',
      entityId: upload.id,
      payload: { fileName: upload.fileName, mapping: p.columnMapping },
    }));

    // The actual processing (applying mapping to rows and creating receiving task)
    // happens in the route handler since it has the parsed CSV data
    // This command handles the template save and status update
    // The route will call CREATE_RECEIVING_TASK with the mapped lines

    return {
      receivingTaskId: '', // Set by route after creating receiving task
      totalRows: upload.totalRows,
      processedRows: 0,
      errorRows: 0,
      errors: [],
    };
  }
}
