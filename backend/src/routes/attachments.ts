import { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import { container } from '../di/container.js';
import { TOKENS } from '../di/tokens.js';
import { IAttachmentRepository } from '../repositories/AttachmentRepository.js';
import { IBinaryStorageProvider } from '../storage/IBinaryStorageProvider.js';

const VALID_ENTITY_TYPES = ['shipment', 'order', 'carrier', 'customer', 'location'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

const attachmentObject = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    entityType: { type: 'string', enum: VALID_ENTITY_TYPES },
    entityId: { type: 'string', format: 'uuid' },
    fileName: { type: 'string' },
    mimeType: { type: 'string' },
    fileSize: { type: 'integer' },
    storageBackend: { type: 'string', enum: ['s3', 'database'] },
    uploadedBy: { type: 'string', nullable: true },
    description: { type: 'string', nullable: true },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
} as const;

const errorResponse = {
  type: 'object',
  properties: {
    data: { type: 'object', nullable: true },
    error: { type: 'string' },
  },
} as const;

export async function attachmentRoutes(server: FastifyInstance) {
  const attachmentRepo = container.resolve<IAttachmentRepository>(TOKENS.IAttachmentRepository);
  const storageProvider = container.resolve<IBinaryStorageProvider>(TOKENS.IBinaryStorageProvider);
  const storageBackend = process.env.S3_ENDPOINT && process.env.S3_BUCKET ? 's3' : 'database';

  // GET /api/v1/attachments?entityType=X&entityId=Y
  server.get('/api/v1/attachments', {
    schema: {
      description: 'List file attachments for a specific entity. Both entityType and entityId are required.',
      tags: ['Attachments'],
      querystring: {
        type: 'object',
        required: ['entityType', 'entityId'],
        properties: {
          entityType: { type: 'string', enum: VALID_ENTITY_TYPES, description: 'Entity type to list attachments for' },
          entityId: { type: 'string', format: 'uuid', description: 'Entity ID to list attachments for' },
        },
      },
      response: {
        200: {
          description: 'List of attachments',
          type: 'object',
          properties: {
            data: { type: 'array', items: attachmentObject },
            error: { type: 'object', nullable: true },
          },
        },
        400: errorResponse,
      },
    },
  }, async (req, reply) => {
    const { entityType, entityId } = req.query as { entityType?: string; entityId?: string };

    if (!entityType || !entityId) {
      reply.code(400);
      return { data: null, error: 'entityType and entityId are required' };
    }

    if (!VALID_ENTITY_TYPES.includes(entityType)) {
      reply.code(400);
      return { data: null, error: `entityType must be one of: ${VALID_ENTITY_TYPES.join(', ')}` };
    }

    const attachments = await attachmentRepo.findByEntity(entityType, entityId);
    return { data: attachments, error: null };
  });

  // POST /api/v1/attachments — multipart upload
  server.post('/api/v1/attachments', {
    schema: {
      description: 'Upload a file attachment to an entity. Send as multipart/form-data with fields: file (the file), entityType, entityId, and optionally description. Maximum file size: 50 MB.',
      tags: ['Attachments'],
      consumes: ['multipart/form-data'],
      response: {
        201: {
          description: 'Attachment created',
          type: 'object',
          properties: {
            data: attachmentObject,
            error: { type: 'object', nullable: true },
          },
        },
        400: errorResponse,
      },
    },
  }, async (req, reply) => {
    const data = await req.file();
    if (!data) {
      reply.code(400);
      return { data: null, error: 'No file uploaded. Send multipart form with field "file".' };
    }

    const entityType = (data.fields.entityType as any)?.value as string | undefined;
    const entityId = (data.fields.entityId as any)?.value as string | undefined;
    const description = (data.fields.description as any)?.value as string | undefined;

    if (!entityType || !entityId) {
      reply.code(400);
      return { data: null, error: 'entityType and entityId are required fields' };
    }

    if (!VALID_ENTITY_TYPES.includes(entityType)) {
      reply.code(400);
      return { data: null, error: `entityType must be one of: ${VALID_ENTITY_TYPES.join(', ')}` };
    }

    // Read file buffer
    const fileBuffer = await data.toBuffer();
    if (fileBuffer.length > MAX_FILE_SIZE) {
      reply.code(400);
      return { data: null, error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024} MB.` };
    }

    const fileName = data.filename;
    const mimeType = data.mimetype || 'application/octet-stream';
    const fileId = randomUUID();
    const storageKey = `attachments/${entityType}/${entityId}/${fileId}-${fileName}`;

    // Store in S3 or database
    await storageProvider.store(storageKey, fileBuffer, {
      'content-type': mimeType,
      'original-filename': fileName,
    });

    // Create attachment record
    const attachment = await attachmentRepo.create({
      entityType,
      entityId,
      fileName,
      mimeType,
      fileSize: fileBuffer.length,
      storageKey,
      storageBackend,
      description,
    });

    reply.code(201);
    return { data: attachment, error: null };
  });

  // GET /api/v1/attachments/:id/download
  server.get('/api/v1/attachments/:id/download', {
    schema: {
      description: 'Download an attachment file. Returns the binary file with appropriate Content-Type and Content-Disposition headers.',
      tags: ['Attachments'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid', description: 'Attachment ID' },
        },
      },
      response: {
        404: errorResponse,
      },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const attachment = await attachmentRepo.findById(id);
    if (!attachment) {
      reply.code(404);
      return { data: null, error: 'Attachment not found' };
    }

    const content = await storageProvider.retrieve(attachment.storageKey);
    reply.header('Content-Type', attachment.mimeType);
    reply.header('Content-Disposition', `attachment; filename="${attachment.fileName}"`);
    reply.header('Content-Length', content.length);
    return reply.send(content);
  });

  // DELETE /api/v1/attachments/:id
  server.delete('/api/v1/attachments/:id', {
    schema: {
      description: 'Delete an attachment. Removes both the database record and the stored file.',
      tags: ['Attachments'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid', description: 'Attachment ID' },
        },
      },
      response: {
        200: {
          description: 'Attachment deleted',
          type: 'object',
          properties: {
            data: { type: 'object', properties: { message: { type: 'string' } } },
            error: { type: 'object', nullable: true },
          },
        },
        404: errorResponse,
      },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const attachment = await attachmentRepo.findById(id);
    if (!attachment) {
      reply.code(404);
      return { data: null, error: 'Attachment not found' };
    }

    // Delete from storage backend
    try {
      await storageProvider.delete(attachment.storageKey);
    } catch {
      // Storage deletion failure shouldn't prevent DB cleanup
    }

    // Delete DB record
    await attachmentRepo.delete(id);
    return { data: { message: 'Attachment deleted' }, error: null };
  });
}
