import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { container, TOKENS } from '../di/index.js';
import { ICommandBus } from '../commands/CommandBus.js';
import { CREATE_RECEIVING_TASK } from '../commands/warehouse/CreateReceivingTaskCommand.js';
import { PrismaClient, Prisma } from '@prisma/client';
import { parseCSV, computeHeaderChecksum, applyMapping, MANIFEST_FIELDS, ColumnMapping } from '../services/ManifestIngestionService.js';
import crypto from 'crypto';

export async function manifestIngestionRoutes(server: FastifyInstance) {
  const commandBus = container.resolve<ICommandBus>(TOKENS.ICommandBus);
  const prisma = container.resolve<PrismaClient>(TOKENS.PrismaClient);

  // GET /api/v1/manifest/fields — available mapping target fields
  server.get('/api/v1/manifest/fields', {
    schema: { tags: ['WMS - Manifest Ingestion'], summary: 'List available manifest mapping fields' },
  }, async () => {
    return { data: MANIFEST_FIELDS, error: null };
  });

  // GET /api/v1/manifest/templates?orgId=xxx
  server.get('/api/v1/manifest/templates', {
    schema: { tags: ['WMS - Manifest Ingestion'], summary: 'List saved column mapping templates' },
  }, async (req: FastifyRequest) => {
    const orgId = (req as any).orgId || 'default-org';
    const templates = await prisma.manifestTemplate.findMany({
      where: { orgId },
      orderBy: { usageCount: 'desc' },
    });
    return { data: templates, error: null };
  });

  // DELETE /api/v1/manifest/templates/:id
  server.delete('/api/v1/manifest/templates/:id', {
    schema: { tags: ['WMS - Manifest Ingestion'], summary: 'Delete a mapping template' },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    await prisma.manifestTemplate.delete({ where: { id } }).catch(() => null);
    return { data: { deleted: true }, error: null };
  });

  // POST /api/v1/manifest/upload — upload CSV and detect headers
  server.post('/api/v1/manifest/upload', {
    schema: {
      tags: ['WMS - Manifest Ingestion'],
      summary: 'Upload a CSV file for manifest ingestion',
      description: 'Parses the file, detects column headers, checks for matching templates. Returns headers and matched template (if any).',
      body: {
        type: 'object',
        required: ['locationId', 'csvContent'],
        properties: {
          locationId: { type: 'string', format: 'uuid' },
          csvContent: { type: 'string', description: 'Raw CSV content' },
          fileName: { type: 'string' },
          delimiter: { type: 'string', description: 'Column delimiter (default: comma)' },
          supplierName: { type: 'string', nullable: true },
          reference: { type: 'string', nullable: true },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      locationId: z.string().uuid(),
      csvContent: z.string().min(1),
      fileName: z.string().optional().default('manifest.csv'),
      delimiter: z.string().optional().default(','),
      supplierName: z.string().nullable().optional(),
      reference: z.string().nullable().optional(),
    }).parse((req as any).body);

    const orgId = (req as any).orgId || 'default-org';

    // Parse CSV
    const parsed = parseCSV(body.csvContent, body.delimiter);
    if (parsed.headers.length === 0) {
      reply.code(400);
      return { data: null, error: 'No headers found in file' };
    }
    if (parsed.totalRows === 0) {
      reply.code(400);
      return { data: null, error: 'File has headers but no data rows' };
    }

    // Check for matching template
    const matchedTemplate = await prisma.manifestTemplate.findFirst({
      where: { orgId, headerChecksum: parsed.headerChecksum },
    });

    // Create upload record
    const upload = await prisma.manifestUpload.create({
      data: {
        locationId: body.locationId,
        fileName: body.fileName,
        status: matchedTemplate ? 'mapped' : 'uploaded',
        templateId: matchedTemplate?.id ?? null,
        totalRows: parsed.totalRows,
        detectedHeaders: parsed.headers as unknown as Prisma.InputJsonValue,
        supplierName: body.supplierName ?? null,
        reference: body.reference ?? null,
        orgId,
      },
    });

    // If template matched, increment usage count
    if (matchedTemplate) {
      await prisma.manifestTemplate.update({
        where: { id: matchedTemplate.id },
        data: { usageCount: { increment: 1 } },
      });
    }

    reply.code(201);
    return {
      data: {
        uploadId: upload.id,
        headers: parsed.headers,
        headerChecksum: parsed.headerChecksum,
        totalRows: parsed.totalRows,
        sampleRows: parsed.rows.slice(0, 5),
        matchedTemplate: matchedTemplate ? {
          id: matchedTemplate.id,
          name: matchedTemplate.name,
          columnMapping: matchedTemplate.columnMapping,
        } : null,
      },
      error: null,
    };
  });

  // POST /api/v1/manifest/:id/process — apply mapping and create receiving task
  server.post('/api/v1/manifest/:id/process', {
    schema: {
      tags: ['WMS - Manifest Ingestion'],
      summary: 'Process uploaded manifest with column mapping into a receiving task',
      body: {
        type: 'object',
        required: ['columnMapping', 'csvContent'],
        properties: {
          columnMapping: { type: 'object', description: 'Maps system fields to CSV column headers' },
          csvContent: { type: 'string', description: 'Raw CSV content (re-sent for processing)' },
          delimiter: { type: 'string' },
          saveAsTemplate: { type: 'boolean' },
          templateName: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      columnMapping: z.record(z.string()),
      csvContent: z.string().min(1),
      delimiter: z.string().optional().default(','),
      saveAsTemplate: z.boolean().optional(),
      templateName: z.string().optional(),
    }).parse((req as any).body);

    const orgId = (req as any).orgId || 'default-org';
    const actorId = (req as any).userId || 'system';

    const upload = await prisma.manifestUpload.findUnique({ where: { id } });
    if (!upload) { reply.code(404); return { data: null, error: 'Upload not found' }; }
    if (upload.status === 'completed') { reply.code(400); return { data: null, error: 'Already processed' }; }

    // Validate required fields are mapped
    if (!body.columnMapping.sku) {
      reply.code(400);
      return { data: null, error: 'SKU field mapping is required' };
    }
    if (!body.columnMapping.quantity) {
      reply.code(400);
      return { data: null, error: 'Quantity field mapping is required' };
    }

    // Re-parse CSV and apply mapping
    const parsed = parseCSV(body.csvContent, body.delimiter);
    const result = applyMapping(parsed.rows, body.columnMapping as ColumnMapping);

    if (result.processedRows === 0) {
      await prisma.manifestUpload.update({
        where: { id: upload.id },
        data: { status: 'failed', errors: result.errors as unknown as Prisma.InputJsonValue, errorRows: result.errorRows },
      });
      reply.code(400);
      return { data: null, error: `No valid rows to process. ${result.errorRows} rows had errors.`, errors: result.errors };
    }

    // Save template if requested
    if (body.saveAsTemplate && body.templateName) {
      const checksum = computeHeaderChecksum(parsed.headers);
      const existing = await prisma.manifestTemplate.findFirst({
        where: { orgId, headerChecksum: checksum },
      });

      if (!existing) {
        const template = await prisma.manifestTemplate.create({
          data: {
            name: body.templateName,
            headerChecksum: checksum,
            columnMapping: body.columnMapping as unknown as Prisma.InputJsonValue,
            fileType: 'csv',
            orgId,
          },
        });
        await prisma.manifestUpload.update({ where: { id: upload.id }, data: { templateId: template.id } });
      } else {
        await prisma.manifestTemplate.update({
          where: { id: existing.id },
          data: { columnMapping: body.columnMapping as unknown as Prisma.InputJsonValue, usageCount: { increment: 1 } },
        });
      }
    }

    // Create receiving task with lines from the manifest
    const taskResult = await commandBus.dispatch({
      type: CREATE_RECEIVING_TASK,
      orgId,
      actorId,
      payload: {
        locationId: upload.locationId,
        receivingType: 'asn',
        expectedLines: result.lines,
      },
      metadata: { correlationId: crypto.randomUUID(), source: 'manifest' },
    });

    if (!taskResult.success) {
      await prisma.manifestUpload.update({
        where: { id: upload.id },
        data: { status: 'failed', errors: [{ row: 0, field: 'system', message: taskResult.error }] as unknown as Prisma.InputJsonValue },
      });
      reply.code(400);
      return { data: null, error: taskResult.error };
    }

    // Update upload status
    await prisma.manifestUpload.update({
      where: { id: upload.id },
      data: {
        status: 'completed',
        receivingTaskId: (taskResult.data as any)?.id,
        processedRows: result.processedRows,
        errorRows: result.errorRows,
        errors: result.errors.length > 0 ? result.errors as unknown as Prisma.InputJsonValue : Prisma.JsonNull,
      },
    });

    return {
      data: {
        uploadId: upload.id,
        receivingTaskId: (taskResult.data as any)?.id,
        totalRows: result.totalRows,
        processedRows: result.processedRows,
        errorRows: result.errorRows,
        errors: result.errors,
      },
      error: null,
    };
  });

  // GET /api/v1/manifest/uploads?locationId=xxx
  server.get('/api/v1/manifest/uploads', {
    schema: {
      tags: ['WMS - Manifest Ingestion'],
      summary: 'List manifest uploads',
      querystring: { type: 'object', properties: { locationId: { type: 'string', format: 'uuid' } } },
    },
  }, async (req: FastifyRequest) => {
    const q = req.query as any;
    const orgId = (req as any).orgId || 'default-org';
    const where: any = { orgId };
    if (q.locationId) where.locationId = q.locationId;

    const uploads = await prisma.manifestUpload.findMany({
      where,
      include: { template: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return { data: uploads, error: null };
  });
}
