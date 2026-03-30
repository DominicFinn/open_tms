import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { container } from '../di/container.js';
import { TOKENS } from '../di/tokens.js';
import { IDocumentTemplateRepository } from '../repositories/DocumentTemplateRepository.js';
import { IGeneratedDocumentRepository } from '../repositories/GeneratedDocumentRepository.js';
import { IDocumentGenerationService } from '../services/DocumentGenerationService.js';

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

export async function documentRoutes(server: FastifyInstance) {
  const templateRepo = container.resolve<IDocumentTemplateRepository>(TOKENS.IDocumentTemplateRepository);
  const docRepo = container.resolve<IGeneratedDocumentRepository>(TOKENS.IGeneratedDocumentRepository);
  const docService = container.resolve<IDocumentGenerationService>(TOKENS.IDocumentGenerationService);

  // ── Template CRUD ─────────────────────────────────────────────────────

  // GET /api/v1/document-templates
  server.get('/api/v1/document-templates', async () => {
    const templates = await templateRepo.all();
    return { data: templates, error: null };
  });

  // GET /api/v1/document-templates/:id
  server.get('/api/v1/document-templates/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const template = await templateRepo.findById(id);
    if (!template) {
      reply.code(404);
      return { data: null, error: 'Template not found' };
    }
    return { data: template, error: null };
  });

  // POST /api/v1/document-templates
  server.post('/api/v1/document-templates', async (req, reply) => {
    const parsed = createTemplateSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { data: null, error: parsed.error.issues.map(i => i.message).join('. ') };
    }

    const template = await templateRepo.create(parsed.data);
    reply.code(201);
    return { data: template, error: null };
  });

  // PUT /api/v1/document-templates/:id
  server.put('/api/v1/document-templates/:id', async (req, reply) => {
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

  // DELETE /api/v1/document-templates/:id
  server.delete('/api/v1/document-templates/:id', async (req, reply) => {
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

  // POST /api/v1/documents/generate/bol
  server.post('/api/v1/documents/generate/bol', async (req, reply) => {
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

  // POST /api/v1/documents/generate/labels
  server.post('/api/v1/documents/generate/labels', async (req, reply) => {
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

  // POST /api/v1/documents/generate/customs
  server.post('/api/v1/documents/generate/customs', async (req, reply) => {
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

  // GET /api/v1/documents
  server.get('/api/v1/documents', async (req) => {
    const { shipmentId, orderId, documentType } = req.query as {
      shipmentId?: string;
      orderId?: string;
      documentType?: string;
    };

    const docs = await docRepo.findAll({ shipmentId, orderId, documentType });
    return { data: docs, error: null };
  });

  // GET /api/v1/documents/:id
  server.get('/api/v1/documents/:id', async (req, reply) => {
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

  // GET /api/v1/documents/:id/download
  server.get('/api/v1/documents/:id/download', async (req, reply) => {
    const { id } = req.params as { id: string };
    const doc = await docRepo.findById(id);
    if (!doc) {
      reply.code(404);
      return { data: null, error: 'Document not found' };
    }

    reply.header('Content-Type', doc.mimeType);
    reply.header('Content-Disposition', `attachment; filename="${doc.fileName}"`);
    reply.header('Content-Length', doc.fileContent.length);
    return reply.send(doc.fileContent);
  });

  // DELETE /api/v1/documents/:id
  server.delete('/api/v1/documents/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const doc = await docRepo.findById(id);
    if (!doc) {
      reply.code(404);
      return { data: null, error: 'Document not found' };
    }

    await docRepo.delete(id);
    return { data: { message: 'Document deleted' }, error: null };
  });
}
