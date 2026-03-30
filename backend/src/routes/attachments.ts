import { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import { container } from '../di/container.js';
import { TOKENS } from '../di/tokens.js';
import { IAttachmentRepository } from '../repositories/AttachmentRepository.js';
import { IBinaryStorageProvider } from '../storage/IBinaryStorageProvider.js';

const VALID_ENTITY_TYPES = ['shipment', 'order', 'carrier', 'customer', 'location'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

export async function attachmentRoutes(server: FastifyInstance) {
  const attachmentRepo = container.resolve<IAttachmentRepository>(TOKENS.IAttachmentRepository);
  const storageProvider = container.resolve<IBinaryStorageProvider>(TOKENS.IBinaryStorageProvider);
  const storageBackend = process.env.S3_ENDPOINT && process.env.S3_BUCKET ? 's3' : 'database';

  // GET /api/v1/attachments?entityType=X&entityId=Y
  server.get('/api/v1/attachments', async (req, reply) => {
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
  server.post('/api/v1/attachments', async (req, reply) => {
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
  server.get('/api/v1/attachments/:id/download', async (req, reply) => {
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
  server.delete('/api/v1/attachments/:id', async (req, reply) => {
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
