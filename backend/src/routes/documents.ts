import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { container } from '../di/container.js';
import { TOKENS } from '../di/tokens.js';
import { IDocumentTemplateRepository } from '../repositories/DocumentTemplateRepository.js';
import { IGeneratedDocumentRepository } from '../repositories/GeneratedDocumentRepository.js';
import { IDocumentGenerationService } from '../services/DocumentGenerationService.js';
import { IBinaryStorageProvider } from '../storage/IBinaryStorageProvider.js';

const createTemplateSchema = z.object({
  name: z.string().min(1),
  documentType: z.enum(['bol', 'label', 'customs', 'daily_report']),
  description: z.string().optional(),
  htmlTemplate: z.string().min(1),
  config: z.any().optional(),
  isDefault: z.boolean().optional(),
});

const updateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  htmlTemplate: z.string().min(1).optional(),
  config: z.any().optional(),
  isDefault: z.boolean().optional(),
  active: z.boolean().optional(),
});

const generateBolSchema = z.object({
  shipmentId: z.string().uuid(),
  templateId: z.string().uuid().optional(),
});

const generateLabelsSchema = z.object({
  orderId: z.string().uuid(),
  templateId: z.string().uuid().optional(),
});

const generateCustomsSchema = z.object({
  shipmentId: z.string().uuid(),
  templateId: z.string().uuid().optional(),
});

// ── Swagger schema fragments ───────────────────────────────────────────────

const templateObject = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    documentType: { type: 'string', enum: ['bol', 'label', 'customs', 'daily_report'] },
    description: { type: 'string', nullable: true },
    htmlTemplate: { type: 'string' },
    config: { type: 'object', nullable: true },
    isDefault: { type: 'boolean' },
    active: { type: 'boolean' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
} as const;

const documentMetaObject = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    documentType: { type: 'string', enum: ['bol', 'label', 'customs', 'daily_report', 'attachment'] },
    documentNumber: { type: 'string', nullable: true },
    fileName: { type: 'string' },
    mimeType: { type: 'string' },
    fileSize: { type: 'integer', nullable: true },
    storageKey: { type: 'string', nullable: true },
    storageBackend: { type: 'string', enum: ['s3', 'database'] },
    templateId: { type: 'string', nullable: true },
    shipmentId: { type: 'string', nullable: true },
    orderId: { type: 'string', nullable: true },
    carrierId: { type: 'string', nullable: true },
    customerId: { type: 'string', nullable: true },
    generatedBy: { type: 'string', nullable: true },
    metadata: { type: 'object', nullable: true },
    notes: { type: 'string', nullable: true },
    retentionExpiresAt: { type: 'string', format: 'date-time', nullable: true, description: 'Retention expiry date (default: 10 years from generation)' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
} as const;

const generatedResult = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    fileName: { type: 'string' },
  },
} as const;

const errorResponse = {
  type: 'object',
  properties: {
    data: { type: 'object', nullable: true },
    error: { type: 'string' },
  },
} as const;

const idParam = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid', description: 'Resource ID' },
  },
} as const;

export async function documentRoutes(server: FastifyInstance) {
  const templateRepo = container.resolve<IDocumentTemplateRepository>(TOKENS.IDocumentTemplateRepository);
  const docRepo = container.resolve<IGeneratedDocumentRepository>(TOKENS.IGeneratedDocumentRepository);
  const docService = container.resolve<IDocumentGenerationService>(TOKENS.IDocumentGenerationService);
  const storageProvider = container.resolve<IBinaryStorageProvider>(TOKENS.IBinaryStorageProvider);

  // ── Template CRUD ─────────────────────────────────────────────────────

  server.get('/api/v1/document-templates', {
    schema: {
      description: 'List all document templates.',
      tags: ['Document Templates'],
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: 'array', items: templateObject },
            error: { type: 'object', nullable: true },
          },
        },
      },
    },
  }, async () => {
    const templates = await templateRepo.all();
    return { data: templates, error: null };
  });

  server.get('/api/v1/document-templates/:id', {
    schema: {
      description: 'Get a single document template by ID.',
      tags: ['Document Templates'],
      params: idParam,
      response: { 200: { type: 'object', properties: { data: templateObject, error: { type: 'object', nullable: true } } }, 404: errorResponse },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const template = await templateRepo.findById(id);
    if (!template) {
      reply.code(404);
      return { data: null, error: 'Template not found' };
    }
    return { data: template, error: null };
  });

  server.post('/api/v1/document-templates', {
    schema: {
      description: 'Create a new document template. Templates use Handlebars syntax for variable substitution in HTML.',
      tags: ['Document Templates'],
      body: {
        type: 'object',
        required: ['name', 'documentType', 'htmlTemplate'],
        properties: {
          name: { type: 'string', description: 'Template name (e.g., "International BOL")' },
          documentType: { type: 'string', enum: ['bol', 'label', 'customs', 'daily_report'], description: 'Document type this template is for' },
          description: { type: 'string', description: 'Optional description' },
          htmlTemplate: { type: 'string', description: 'HTML with Handlebars placeholders (e.g., {{bolNumber}})' },
          config: { type: 'object', description: 'Type-specific configuration JSON' },
          isDefault: { type: 'boolean', description: 'Set as default template for this document type' },
        },
      },
      response: { 201: { type: 'object', properties: { data: templateObject, error: { type: 'object', nullable: true } } }, 400: errorResponse },
    },
  }, async (req, reply) => {
    const parsed = createTemplateSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { data: null, error: parsed.error.issues.map(i => i.message).join('. ') };
    }

    const template = await templateRepo.create(parsed.data);
    reply.code(201);
    return { data: template, error: null };
  });

  server.put('/api/v1/document-templates/:id', {
    schema: {
      description: 'Update an existing document template.',
      tags: ['Document Templates'],
      params: idParam,
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          htmlTemplate: { type: 'string' },
          config: { type: 'object' },
          isDefault: { type: 'boolean' },
          active: { type: 'boolean' },
        },
      },
      response: { 200: { type: 'object', properties: { data: templateObject, error: { type: 'object', nullable: true } } }, 404: errorResponse },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = updateTemplateSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { data: null, error: parsed.error.issues.map(i => i.message).join('. ') };
    }

    const existing = await templateRepo.findById(id);
    if (!existing) {
      reply.code(404);
      return { data: null, error: 'Template not found' };
    }

    const updated = await templateRepo.update(id, parsed.data);
    return { data: updated, error: null };
  });

  server.delete('/api/v1/document-templates/:id', {
    schema: {
      description: 'Delete a document template.',
      tags: ['Document Templates'],
      params: idParam,
      response: {
        200: { type: 'object', properties: { data: { type: 'object', properties: { message: { type: 'string' } } }, error: { type: 'object', nullable: true } } },
        404: errorResponse,
      },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await templateRepo.findById(id);
    if (!existing) {
      reply.code(404);
      return { data: null, error: 'Template not found' };
    }

    await templateRepo.delete(id);
    return { data: { message: 'Template deleted' }, error: null };
  });

  // ── Document Generation ───────────────────────────────────────────────

  server.post('/api/v1/documents/generate/bol', {
    schema: {
      description: 'Generate a Bill of Lading PDF for a shipment. The BOL number is auto-incremented per organization. The generated document is stored via the configured storage provider (S3 or database).',
      tags: ['Document Generation'],
      body: {
        type: 'object',
        required: ['shipmentId'],
        properties: {
          shipmentId: { type: 'string', format: 'uuid', description: 'Shipment to generate BOL for' },
          templateId: { type: 'string', format: 'uuid', description: 'Custom template ID (uses default if omitted)' },
        },
      },
      response: {
        201: { type: 'object', properties: { data: generatedResult, error: { type: 'object', nullable: true } } },
        400: errorResponse,
        500: errorResponse,
      },
    },
  }, async (req, reply) => {
    const parsed = generateBolSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { data: null, error: parsed.error.issues.map(i => i.message).join('. ') };
    }

    try {
      const result = await docService.generateBOL(parsed.data.shipmentId, parsed.data.templateId);
      reply.code(201);
      return { data: result, error: null };
    } catch (err: any) {
      reply.code(500);
      return { data: null, error: err.message };
    }
  });

  server.post('/api/v1/documents/generate/labels', {
    schema: {
      description: 'Generate shipping labels PDF for an order. Creates one label per trackable unit.',
      tags: ['Document Generation'],
      body: {
        type: 'object',
        required: ['orderId'],
        properties: {
          orderId: { type: 'string', format: 'uuid', description: 'Order with trackable units to label' },
          templateId: { type: 'string', format: 'uuid', description: 'Custom template ID' },
        },
      },
      response: {
        201: { type: 'object', properties: { data: generatedResult, error: { type: 'object', nullable: true } } },
        400: errorResponse,
        500: errorResponse,
      },
    },
  }, async (req, reply) => {
    const parsed = generateLabelsSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { data: null, error: parsed.error.issues.map(i => i.message).join('. ') };
    }

    try {
      const result = await docService.generateLabels(parsed.data.orderId, parsed.data.templateId);
      reply.code(201);
      return { data: result, error: null };
    } catch (err: any) {
      reply.code(500);
      return { data: null, error: err.message };
    }
  });

  server.post('/api/v1/documents/generate/customs', {
    schema: {
      description: 'Generate a customs/commercial invoice PDF for a shipment. Includes blank fields for HS codes, declared values, and other customs data not yet in the schema.',
      tags: ['Document Generation'],
      body: {
        type: 'object',
        required: ['shipmentId'],
        properties: {
          shipmentId: { type: 'string', format: 'uuid', description: 'Shipment for customs form' },
          templateId: { type: 'string', format: 'uuid', description: 'Custom template ID' },
        },
      },
      response: {
        201: { type: 'object', properties: { data: generatedResult, error: { type: 'object', nullable: true } } },
        400: errorResponse,
        500: errorResponse,
      },
    },
  }, async (req, reply) => {
    const parsed = generateCustomsSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { data: null, error: parsed.error.issues.map(i => i.message).join('. ') };
    }

    try {
      const result = await docService.generateCustomsForm(parsed.data.shipmentId, parsed.data.templateId);
      reply.code(201);
      return { data: result, error: null };
    } catch (err: any) {
      reply.code(500);
      return { data: null, error: err.message };
    }
  });

  // ── Generated Documents ───────────────────────────────────────────────

  server.get('/api/v1/documents', {
    schema: {
      description: 'List generated documents with optional filters. Returns metadata only (no binary content).',
      tags: ['Generated Documents'],
      querystring: {
        type: 'object',
        properties: {
          shipmentId: { type: 'string', format: 'uuid', description: 'Filter by shipment' },
          orderId: { type: 'string', format: 'uuid', description: 'Filter by order' },
          documentType: { type: 'string', enum: ['bol', 'label', 'customs', 'daily_report'], description: 'Filter by document type' },
        },
      },
      response: {
        200: { type: 'object', properties: { data: { type: 'array', items: documentMetaObject }, error: { type: 'object', nullable: true } } },
      },
    },
  }, async (req) => {
    const { shipmentId, orderId, documentType } = req.query as {
      shipmentId?: string;
      orderId?: string;
      documentType?: string;
    };

    const docs = await docRepo.findAll({ shipmentId, orderId, documentType });
    return { data: docs, error: null };
  });

  server.get('/api/v1/documents/:id', {
    schema: {
      description: 'Get document metadata by ID. Does not include the binary file content — use /download for that.',
      tags: ['Generated Documents'],
      params: idParam,
      response: {
        200: { type: 'object', properties: { data: documentMetaObject, error: { type: 'object', nullable: true } } },
        404: errorResponse,
      },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const doc = await docRepo.findById(id);
    if (!doc) {
      reply.code(404);
      return { data: null, error: 'Document not found' };
    }

    // Return metadata only (no binary content)
    const { fileContent, ...metadata } = doc;
    return { data: metadata, error: null };
  });

  server.get('/api/v1/documents/:id/download', {
    schema: {
      description: 'Download a generated document file. Retrieves from S3 or database depending on storage backend. Returns the binary file with appropriate Content-Type and Content-Disposition headers.',
      tags: ['Generated Documents'],
      params: idParam,
      response: {
        404: errorResponse,
      },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const doc = await docRepo.findById(id);
    if (!doc) {
      reply.code(404);
      return { data: null, error: 'Document not found' };
    }

    let content: Buffer;
    if (doc.storageKey && storageProvider) {
      // Retrieve from storage provider (S3/MinIO or DatabaseBinaryStorage)
      content = await storageProvider.retrieve(doc.storageKey);
    } else if (doc.fileContent) {
      // Legacy: inline DB storage (no storageKey)
      content = doc.fileContent;
    } else {
      reply.code(404);
      return { data: null, error: 'Document content not found' };
    }

    reply.header('Content-Type', doc.mimeType);
    reply.header('Content-Disposition', `attachment; filename="${doc.fileName}"`);
    reply.header('Content-Length', content.length);
    return reply.send(content);
  });

  server.delete('/api/v1/documents/:id', {
    schema: {
      description: 'Delete a generated document. Removes both the database record and the stored file from S3/storage.',
      tags: ['Generated Documents'],
      params: idParam,
      response: {
        200: { type: 'object', properties: { data: { type: 'object', properties: { message: { type: 'string' } } }, error: { type: 'object', nullable: true } } },
        404: errorResponse,
      },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const doc = await docRepo.findById(id);
    if (!doc) {
      reply.code(404);
      return { data: null, error: 'Document not found' };
    }

    // Clean up external storage if applicable
    if (doc.storageKey) {
      try { await storageProvider.delete(doc.storageKey); } catch { /* best effort */ }
    }

    await docRepo.delete(id);
    return { data: { message: 'Document deleted' }, error: null };
  });
}
