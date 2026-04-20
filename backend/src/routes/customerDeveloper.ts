/**
 * Customer Portal - Developer Area API
 *
 * Self-service integration management for customers. All endpoints scoped by
 * the authenticated customer's customerId (via authenticateCustomerJWT).
 *
 * Covers:
 *  - API keys (list, create with one-time plaintext, revoke)
 *  - Webhooks (list, create, update, delete, rotate secret, test delivery)
 *  - Trading partners and EDI transactions (read-only view of admin-managed config)
 */

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { createHash, randomBytes } from 'crypto';
import { authenticateCustomerJWT } from '../middleware/jwtAuth.js';
import { CustomerWebhookDeliveryService } from '../services/webhooks/CustomerWebhookDeliveryService.js';

function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

function generateApiKey(): { key: string; keyHash: string; keyPrefix: string } {
  const key = `sk_live_${randomBytes(32).toString('hex')}`;
  return { key, keyHash: hashApiKey(key), keyPrefix: key.substring(0, 12) };
}

function generateWebhookSecret(): string {
  return `whsec_${randomBytes(32).toString('hex')}`;
}

const ALLOWED_EVENT_PATTERNS = [
  '*',
  'rma.*',
  'rma.requested', 'rma.authorized', 'rma.rejected', 'rma.goods_received',
  'rma.line_inspected', 'rma.completed', 'rma.return_label_generated', 'rma.pickup_scheduled',
  'order.*',
  'order.created', 'order.confirmed', 'order.delivered', 'order.cancelled',
  'shipment.*',
  'shipment.dispatched', 'shipment.delivered', 'shipment.exception',
  'invoice.*',
  'invoice.created', 'invoice.sent', 'invoice.paid',
];

export async function customerDeveloperRoutes(server: FastifyInstance) {
  const deliveryService = new CustomerWebhookDeliveryService(server.prisma);

  // ── Dashboard summary ────────────────────────────────────────────────

  server.get('/api/v1/customer-portal/developer/summary', {
    preHandler: [authenticateCustomerJWT],
    schema: { tags: ['Customer Portal - Developer'], summary: 'Developer area overview stats' },
  }, async (req: FastifyRequest) => {
    const customerId = req.customerUser!.customerId;
    const [apiKeyCount, activeKeyCount, webhookCount, enabledWebhookCount, partnerCount, recentLogCount] = await Promise.all([
      server.prisma.apiKey.count({ where: { customerId } }),
      server.prisma.apiKey.count({ where: { customerId, active: true } }),
      server.prisma.customerWebhook.count({ where: { customerId } }),
      server.prisma.customerWebhook.count({ where: { customerId, enabled: true } }),
      server.prisma.tradingPartner.count({ where: { customerId } }),
      server.prisma.ediTransactionLog.count({
        where: {
          partner: { customerId },
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) },
        },
      }),
    ]);
    return {
      data: {
        apiKeys: { total: apiKeyCount, active: activeKeyCount },
        webhooks: { total: webhookCount, enabled: enabledWebhookCount },
        tradingPartners: partnerCount,
        ediTransactionsLast7Days: recentLogCount,
      },
      error: null,
    };
  });

  // ── API Keys ─────────────────────────────────────────────────────────

  server.get('/api/v1/customer-portal/developer/api-keys', {
    preHandler: [authenticateCustomerJWT],
    schema: { tags: ['Customer Portal - Developer'], summary: 'List your API keys' },
  }, async (req: FastifyRequest) => {
    const customerId = req.customerUser!.customerId;
    const keys = await server.prisma.apiKey.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, keyPrefix: true, active: true, lastUsedAt: true, createdAt: true, updatedAt: true },
    });
    return { data: keys, error: null };
  });

  server.post('/api/v1/customer-portal/developer/api-keys', {
    preHandler: [authenticateCustomerJWT],
    schema: {
      tags: ['Customer Portal - Developer'],
      summary: 'Create a new API key. The plaintext key is returned once and is not retrievable later.',
      body: {
        type: 'object', required: ['name'],
        properties: { name: { type: 'string', minLength: 1, maxLength: 100 } },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const customerId = req.customerUser!.customerId;
    const body = z.object({ name: z.string().min(1).max(100) }).parse((req as any).body);
    const { key, keyHash, keyPrefix } = generateApiKey();
    const created = await server.prisma.apiKey.create({
      data: { name: body.name, keyHash, keyPrefix, active: true, customerId },
      select: { id: true, name: true, keyPrefix: true, active: true, createdAt: true },
    });
    reply.code(201);
    return { data: { ...created, key }, error: null };
  });

  server.put('/api/v1/customer-portal/developer/api-keys/:id', {
    preHandler: [authenticateCustomerJWT],
    schema: {
      tags: ['Customer Portal - Developer'],
      summary: 'Update API key name or active status',
      body: {
        type: 'object',
        properties: { name: { type: 'string' }, active: { type: 'boolean' } },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const customerId = req.customerUser!.customerId;
    const { id } = req.params as { id: string };
    const body = z.object({ name: z.string().min(1).max(100).optional(), active: z.boolean().optional() }).parse((req as any).body);
    const existing = await server.prisma.apiKey.findFirst({ where: { id, customerId }, select: { id: true } });
    if (!existing) { reply.code(404); return { data: null, error: 'API key not found' }; }
    const updated = await server.prisma.apiKey.update({
      where: { id },
      data: body,
      select: { id: true, name: true, keyPrefix: true, active: true, lastUsedAt: true, updatedAt: true },
    });
    return { data: updated, error: null };
  });

  server.delete('/api/v1/customer-portal/developer/api-keys/:id', {
    preHandler: [authenticateCustomerJWT],
    schema: { tags: ['Customer Portal - Developer'], summary: 'Revoke an API key' },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const customerId = req.customerUser!.customerId;
    const { id } = req.params as { id: string };
    const existing = await server.prisma.apiKey.findFirst({ where: { id, customerId }, select: { id: true } });
    if (!existing) { reply.code(404); return { data: null, error: 'API key not found' }; }
    await server.prisma.apiKey.delete({ where: { id } });
    return { data: { success: true }, error: null };
  });

  // ── Webhooks ─────────────────────────────────────────────────────────

  server.get('/api/v1/customer-portal/developer/webhooks', {
    preHandler: [authenticateCustomerJWT],
    schema: { tags: ['Customer Portal - Developer'], summary: 'List your webhooks' },
  }, async (req: FastifyRequest) => {
    const customerId = req.customerUser!.customerId;
    const hooks = await server.prisma.customerWebhook.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });
    return { data: hooks, error: null };
  });

  server.get('/api/v1/customer-portal/developer/webhooks/events', {
    preHandler: [authenticateCustomerJWT],
    schema: { tags: ['Customer Portal - Developer'], summary: 'Allowed event patterns' },
  }, async () => {
    return { data: ALLOWED_EVENT_PATTERNS, error: null };
  });

  server.post('/api/v1/customer-portal/developer/webhooks', {
    preHandler: [authenticateCustomerJWT],
    schema: {
      tags: ['Customer Portal - Developer'],
      summary: 'Register a new webhook endpoint',
      body: {
        type: 'object', required: ['name', 'url', 'events'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          url: { type: 'string', format: 'uri' },
          events: { type: 'array', items: { type: 'string' }, minItems: 1 },
          description: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const user = req.customerUser!;
    const body = z.object({
      name: z.string().min(1).max(100),
      url: z.string().url(),
      events: z.array(z.string()).min(1),
      description: z.string().optional(),
    }).parse((req as any).body);

    const invalid = body.events.filter(e => !ALLOWED_EVENT_PATTERNS.includes(e));
    if (invalid.length > 0) {
      reply.code(400);
      return { data: null, error: `Unsupported event patterns: ${invalid.join(', ')}` };
    }

    const org = await server.prisma.organization.findFirst({ select: { id: true } });
    const created = await server.prisma.customerWebhook.create({
      data: {
        customerId: user.customerId,
        orgId: org?.id ?? 'default-org',
        name: body.name,
        url: body.url,
        secret: generateWebhookSecret(),
        events: body.events,
        description: body.description ?? null,
      },
    });
    reply.code(201);
    return { data: created, error: null };
  });

  server.put('/api/v1/customer-portal/developer/webhooks/:id', {
    preHandler: [authenticateCustomerJWT],
    schema: {
      tags: ['Customer Portal - Developer'],
      summary: 'Update a webhook',
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          url: { type: 'string', format: 'uri' },
          events: { type: 'array', items: { type: 'string' } },
          description: { type: 'string' },
          enabled: { type: 'boolean' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const customerId = req.customerUser!.customerId;
    const { id } = req.params as { id: string };
    const body = z.object({
      name: z.string().min(1).max(100).optional(),
      url: z.string().url().optional(),
      events: z.array(z.string()).min(1).optional(),
      description: z.string().optional(),
      enabled: z.boolean().optional(),
    }).parse((req as any).body);

    const existing = await server.prisma.customerWebhook.findFirst({ where: { id, customerId }, select: { id: true } });
    if (!existing) { reply.code(404); return { data: null, error: 'Webhook not found' }; }

    if (body.events) {
      const invalid = body.events.filter(e => !ALLOWED_EVENT_PATTERNS.includes(e));
      if (invalid.length > 0) {
        reply.code(400);
        return { data: null, error: `Unsupported event patterns: ${invalid.join(', ')}` };
      }
    }

    const updated = await server.prisma.customerWebhook.update({ where: { id }, data: body });
    return { data: updated, error: null };
  });

  server.delete('/api/v1/customer-portal/developer/webhooks/:id', {
    preHandler: [authenticateCustomerJWT],
    schema: { tags: ['Customer Portal - Developer'], summary: 'Delete a webhook' },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const customerId = req.customerUser!.customerId;
    const { id } = req.params as { id: string };
    const existing = await server.prisma.customerWebhook.findFirst({ where: { id, customerId }, select: { id: true } });
    if (!existing) { reply.code(404); return { data: null, error: 'Webhook not found' }; }
    await server.prisma.customerWebhook.delete({ where: { id } });
    return { data: { success: true }, error: null };
  });

  server.post('/api/v1/customer-portal/developer/webhooks/:id/rotate-secret', {
    preHandler: [authenticateCustomerJWT],
    schema: { tags: ['Customer Portal - Developer'], summary: 'Rotate the webhook signing secret' },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const customerId = req.customerUser!.customerId;
    const { id } = req.params as { id: string };
    const existing = await server.prisma.customerWebhook.findFirst({ where: { id, customerId }, select: { id: true } });
    if (!existing) { reply.code(404); return { data: null, error: 'Webhook not found' }; }
    const updated = await server.prisma.customerWebhook.update({ where: { id }, data: { secret: generateWebhookSecret() } });
    return { data: { secret: updated.secret }, error: null };
  });

  server.post('/api/v1/customer-portal/developer/webhooks/:id/test', {
    preHandler: [authenticateCustomerJWT],
    schema: {
      tags: ['Customer Portal - Developer'],
      summary: 'Send a test event to the webhook endpoint',
      body: {
        type: 'object',
        properties: { eventType: { type: 'string', default: 'webhook.test' } },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const customerId = req.customerUser!.customerId;
    const { id } = req.params as { id: string };
    const body = (req.body as any) ?? {};
    const hook = await server.prisma.customerWebhook.findFirst({ where: { id, customerId } });
    if (!hook) { reply.code(404); return { data: null, error: 'Webhook not found' }; }

    const delivery = await deliveryService.deliver({
      webhook: hook,
      eventType: body.eventType || 'webhook.test',
      payload: {
        message: 'This is a test delivery from Open TMS.',
        sentAt: new Date().toISOString(),
      },
    });
    return { data: delivery, error: null };
  });

  server.get('/api/v1/customer-portal/developer/webhooks/:id/deliveries', {
    preHandler: [authenticateCustomerJWT],
    schema: {
      tags: ['Customer Portal - Developer'],
      summary: 'List recent deliveries for a webhook',
      querystring: { type: 'object', properties: { limit: { type: 'integer', default: 50 } } },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const customerId = req.customerUser!.customerId;
    const { id } = req.params as { id: string };
    const q = req.query as { limit?: number };
    const hook = await server.prisma.customerWebhook.findFirst({ where: { id, customerId }, select: { id: true } });
    if (!hook) { reply.code(404); return { data: null, error: 'Webhook not found' }; }
    const deliveries = await server.prisma.customerWebhookDelivery.findMany({
      where: { webhookId: id },
      orderBy: { createdAt: 'desc' },
      take: q.limit || 50,
    });
    return { data: deliveries, error: null };
  });

  // ── EDI / Trading Partners ───────────────────────────────────────────

  server.get('/api/v1/customer-portal/developer/trading-partners', {
    preHandler: [authenticateCustomerJWT],
    schema: { tags: ['Customer Portal - Developer'], summary: 'View your trading partner configurations (read-only)' },
  }, async (req: FastifyRequest) => {
    const customerId = req.customerUser!.customerId;
    const partners = await server.prisma.tradingPartner.findMany({
      where: { customerId },
      include: {
        transactions: { orderBy: { transactionType: 'asc' } },
      },
      orderBy: { name: 'asc' },
    });

    // Redact credentials but keep structural info
    const redacted = partners.map(p => ({
      ...p,
      sftpPassword: p.sftpPassword ? '***' : null,
      sftpPrivateKey: p.sftpPrivateKey ? '***' : null,
      httpAuthValue: p.httpAuthValue ? '***' : null,
    }));

    return { data: redacted, error: null };
  });

  server.get('/api/v1/customer-portal/developer/edi-logs', {
    preHandler: [authenticateCustomerJWT],
    schema: {
      tags: ['Customer Portal - Developer'],
      summary: 'Recent EDI transactions across your trading partners',
      querystring: {
        type: 'object',
        properties: {
          direction: { type: 'string', enum: ['inbound', 'outbound'] },
          transactionType: { type: 'string' },
          limit: { type: 'integer', default: 100 },
          offset: { type: 'integer', default: 0 },
        },
      },
    },
  }, async (req: FastifyRequest) => {
    const customerId = req.customerUser!.customerId;
    const q = req.query as { direction?: string; transactionType?: string; limit?: number; offset?: number };
    const where: any = { partner: { customerId } };
    if (q.direction) where.direction = q.direction;
    if (q.transactionType) where.transactionType = q.transactionType;

    const [logs, total] = await Promise.all([
      server.prisma.ediTransactionLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: q.limit || 100,
        skip: q.offset || 0,
        include: { partner: { select: { name: true } } },
      }),
      server.prisma.ediTransactionLog.count({ where }),
    ]);
    return { data: { logs, total }, error: null };
  });
}
