/**
 * Email Template Routes — CRUD for email templates managed from Admin.
 *
 * GET    /api/v1/email/templates          — list all templates
 * GET    /api/v1/email/templates/:id      — get single template
 * POST   /api/v1/email/templates          — create template
 * PUT    /api/v1/email/templates/:id      — update template
 * DELETE /api/v1/email/templates/:id      — delete template
 * POST   /api/v1/email/templates/preview  — preview rendered template
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { EmailTemplateRenderer } from '../services/EmailTemplateRenderer.js';
import { EVENT_TYPES } from '../events/eventTypes.js';

const renderer = new EmailTemplateRenderer();

// All supported event types for email templates
const SUPPORTED_EVENT_TYPES = [
  EVENT_TYPES.SHIPMENT_CREATED,
  EVENT_TYPES.SHIPMENT_STATUS_CHANGED,
  EVENT_TYPES.SHIPMENT_DELIVERED,
  EVENT_TYPES.SHIPMENT_EXCEPTION,
  EVENT_TYPES.ORDER_STATUS_CHANGED,
  EVENT_TYPES.ORDER_DELIVERED,
  EVENT_TYPES.ORDER_EXCEPTION,
];

export async function emailTemplateRoutes(server: FastifyInstance) {
  // List all email templates
  server.get('/api/v1/email/templates', {
    schema: {
      tags: ['Email'],
      summary: 'List email templates',
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: 'array', items: { type: 'object' } },
            error: { type: 'string', nullable: true },
          },
        },
      },
    },
  }, async (_req, _reply) => {
    const org = await server.prisma.organization.findFirst({ select: { id: true } });
    if (!org) return { data: [], error: null };

    const templates = await server.prisma.emailTemplate.findMany({
      where: { organizationId: org.id },
      orderBy: { eventType: 'asc' },
    });

    // Also return the list of supported event types so the UI can show "create" for missing ones
    return {
      data: {
        templates,
        supportedEventTypes: SUPPORTED_EVENT_TYPES,
      },
      error: null,
    };
  });

  // Get single template
  server.get('/api/v1/email/templates/:id', {
    schema: {
      tags: ['Email'],
      summary: 'Get email template by ID',
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const template = await server.prisma.emailTemplate.findUnique({ where: { id } });
    if (!template) {
      reply.code(404);
      return { data: null, error: 'Template not found' };
    }
    return { data: template, error: null };
  });

  // Create template
  server.post('/api/v1/email/templates', {
    schema: {
      tags: ['Email'],
      summary: 'Create email template',
    },
  }, async (req, reply) => {
    const schema = z.object({
      name: z.string().min(1),
      eventType: z.string().min(1),
      description: z.string().optional(),
      subject: z.string().min(1),
      htmlBody: z.string().min(1),
      textBody: z.string().optional(),
      active: z.boolean().default(true),
    });

    const body = schema.parse((req as any).body);

    const org = await server.prisma.organization.findFirst({ select: { id: true } });
    if (!org) {
      reply.code(400);
      return { data: null, error: 'Organization not found' };
    }

    // Check if a template already exists for this event type
    const existing = await server.prisma.emailTemplate.findFirst({
      where: { organizationId: org.id, eventType: body.eventType },
    });

    if (existing) {
      reply.code(409);
      return { data: null, error: `A template for event type "${body.eventType}" already exists. Update it instead.` };
    }

    const template = await server.prisma.emailTemplate.create({
      data: {
        ...body,
        organizationId: org.id,
      },
    });

    reply.code(201);
    return { data: template, error: null };
  });

  // Update template
  server.put('/api/v1/email/templates/:id', {
    schema: {
      tags: ['Email'],
      summary: 'Update email template',
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const schema = z.object({
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      subject: z.string().min(1).optional(),
      htmlBody: z.string().min(1).optional(),
      textBody: z.string().nullable().optional(),
      active: z.boolean().optional(),
    });

    const body = schema.parse((req as any).body);

    const existing = await server.prisma.emailTemplate.findUnique({ where: { id } });
    if (!existing) {
      reply.code(404);
      return { data: null, error: 'Template not found' };
    }

    const updated = await server.prisma.emailTemplate.update({
      where: { id },
      data: body,
    });

    return { data: updated, error: null };
  });

  // Delete template
  server.delete('/api/v1/email/templates/:id', {
    schema: {
      tags: ['Email'],
      summary: 'Delete email template',
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };

    const existing = await server.prisma.emailTemplate.findUnique({ where: { id } });
    if (!existing) {
      reply.code(404);
      return { data: null, error: 'Template not found' };
    }

    await server.prisma.emailTemplate.delete({ where: { id } });
    return { data: { deleted: true }, error: null };
  });

  // Preview template rendering
  server.post('/api/v1/email/templates/preview', {
    schema: {
      tags: ['Email'],
      summary: 'Preview rendered email template with sample data',
    },
  }, async (req, _reply) => {
    const schema = z.object({
      subject: z.string(),
      htmlBody: z.string(),
      textBody: z.string().optional(),
      eventType: z.string(),
    });

    const body = schema.parse((req as any).body);

    // Get org branding
    const org = await server.prisma.organization.findFirst({
      select: { name: true, themeConfig: true },
    });

    const themeConfig = org?.themeConfig as Record<string, string> | null;
    const branding = {
      orgName: org?.name || 'Open TMS',
      primaryColor: themeConfig?.['--color-primary'] || '#1976d2',
    };

    // Sample data for preview
    const samplePayloads: Record<string, Record<string, string>> = {
      'shipment.status_changed': { shipmentReference: 'SHP-2024-0042', previousStatus: 'in_transit', newStatus: 'delivered' },
      'shipment.created': { shipmentReference: 'SHP-2024-0042', status: 'draft' },
      'shipment.delivered': { shipmentReference: 'SHP-2024-0042', deliveredAt: '2024-03-30T14:30:00Z' },
      'shipment.exception': { shipmentReference: 'SHP-2024-0042', exceptionType: 'delay', description: 'Truck delayed due to weather conditions' },
      'order.status_changed': { orderReference: 'ORD-2024-0099', previousStatus: 'pending', newStatus: 'confirmed' },
      'order.delivered': { orderReference: 'ORD-2024-0099' },
      'order.exception': { orderReference: 'ORD-2024-0099', exceptionType: 'damage', description: 'Package arrived with visible damage' },
    };

    const sampleEvent = {
      id: 'preview-event',
      type: body.eventType,
      timestamp: new Date().toISOString(),
      orgId: 'preview-org',
      actorId: null,
      entityType: body.eventType.split('.')[0],
      entityId: 'preview-entity',
      payload: samplePayloads[body.eventType] || {},
      metadata: { correlationId: 'preview', source: 'admin', schemaVersion: 1 },
    };

    const rendered = renderer.render(sampleEvent, branding, {
      subject: body.subject,
      htmlBody: body.htmlBody,
      textBody: body.textBody,
    });

    return { data: rendered, error: null };
  });
}
