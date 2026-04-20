import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { container, TOKENS } from '../di/index.js';
import { ICommandBus } from '../commands/CommandBus.js';
import { CREATE_RMA } from '../commands/rma/CreateRmaCommand.js';
import { PrismaClient } from '@prisma/client';
import { authenticateApiKey, checkRateLimit } from '../middleware/apiKeyAuth.js';
import type { IBinaryStorageProvider } from '../storage/IBinaryStorageProvider.js';
import crypto from 'crypto';

const RETURN_REASONS = ['damaged', 'wrong_item', 'not_as_described', 'no_longer_needed', 'defective', 'ordered_extra', 'other'] as const;
const DISPOSITIONS = ['restock', 'refurb', 'scrap', 'recycle', 'donate', 'rtv', 'customer_keeps'] as const;

/**
 * Customer-facing RMA API.
 *
 * Allows customers with an ApiKey linked to their account to:
 * - Create RMAs programmatically (POST /api/v1/customer-api/rmas)
 * - View their own RMAs (GET /api/v1/customer-api/rmas, GET :id)
 *
 * Authentication: API key via `x-api-key` header or `Authorization: Bearer <key>`.
 * Scope: data is scoped to the customer the API key is linked to.
 * Rate limit: 100 requests/minute per IP.
 */
export async function customerRmaApiRoutes(server: FastifyInstance) {
  const commandBus = container.resolve<ICommandBus>(TOKENS.ICommandBus);
  const prisma = container.resolve<PrismaClient>(TOKENS.PrismaClient);
  const binaryStorage = container.resolve<IBinaryStorageProvider>(TOKENS.IBinaryStorageProvider);

  // Shared auth helper - same pattern as customerApi.ts
  async function authenticate(req: FastifyRequest, reply: FastifyReply): Promise<{ customerId: string; orgId: string } | null> {
    const ip = req.ip || 'unknown';
    if (!checkRateLimit(ip)) {
      reply.code(429);
      reply.send({ data: null, error: 'Too many requests. Please try again later.', retryAfter: '60 seconds' });
      return null;
    }

    const authResult = await authenticateApiKey(server, req, reply);
    if (authResult.error) {
      reply.send({ data: null, error: authResult.error });
      return null;
    }
    if (!authResult.customerId) {
      reply.code(403);
      reply.send({ data: null, error: 'This API key is not linked to a customer account. Contact your administrator.' });
      return null;
    }

    // Look up org from the customer record (single-org model for now)
    const org = await prisma.organization.findFirst({ select: { id: true } });
    return { customerId: authResult.customerId, orgId: org?.id ?? 'default-org' };
  }

  // POST /api/v1/customer-api/rmas — Create a return merchandise authorization
  server.post('/api/v1/customer-api/rmas', {
    schema: {
      tags: ['Customer API - Returns'],
      summary: 'Create a return authorization (RMA) for your order',
      description: 'Programmatically request a return. The customerId is derived from your API key. Rate limited to 100 req/min per IP.',
      security: [{ ApiKeyAuth: [] }],
      body: {
        type: 'object',
        required: ['orderId', 'returnReason', 'lines'],
        properties: {
          orderId: { type: 'string', format: 'uuid', description: 'The order being returned' },
          returnReason: { type: 'string', enum: [...RETURN_REASONS] },
          customerNotes: { type: 'string', description: 'Customer description of the issue' },
          lines: {
            type: 'array', minItems: 1,
            items: {
              type: 'object', required: ['orderLineItemId', 'sku', 'requestedQuantity'],
              properties: {
                orderLineItemId: { type: 'string' },
                sku: { type: 'string' },
                requestedQuantity: { type: 'integer', minimum: 1 },
                requestedDisposition: {
                  type: 'string',
                  enum: [...DISPOSITIONS],
                  description: 'Optional suggested disposition; final disposition decided on inspection',
                },
              },
            },
          },
        },
      },
      response: {
        201: {
          description: 'RMA created successfully',
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                rmaNumber: { type: 'string' },
                status: { type: 'string' },
                suggestedRefundCents: { type: 'integer' },
                lineCount: { type: 'integer' },
              },
            },
            error: { type: 'null' },
          },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const auth = await authenticate(req, reply);
    if (!auth) return;

    const body = z.object({
      orderId: z.string().uuid(),
      returnReason: z.enum(RETURN_REASONS),
      customerNotes: z.string().optional(),
      lines: z.array(z.object({
        orderLineItemId: z.string(),
        sku: z.string(),
        requestedQuantity: z.number().int().min(1),
        requestedDisposition: z.enum(DISPOSITIONS).optional(),
      })).min(1),
    }).parse((req as any).body);

    const result = await commandBus.dispatch({
      type: CREATE_RMA,
      orgId: auth.orgId,
      actorId: `customer-api:${auth.customerId}`,
      payload: {
        customerId: auth.customerId,
        orderId: body.orderId,
        returnReason: body.returnReason,
        customerNotes: body.customerNotes,
        initiatedVia: 'api',
        lines: body.lines,
        autoAuthorize: false, // customer-initiated RMAs always start in 'requested' state for CSR review
      },
      metadata: { correlationId: crypto.randomUUID(), source: 'customer-api' },
    });

    if (!result.success) { reply.code(400); return { data: null, error: result.error }; }
    reply.code(201);
    return { data: result.data, error: null };
  });

  // GET /api/v1/customer-api/rmas — List the customer's own RMAs
  server.get('/api/v1/customer-api/rmas', {
    schema: {
      tags: ['Customer API - Returns'],
      summary: 'List your RMAs',
      description: 'Returns all RMAs for the customer linked to this API key.',
      security: [{ ApiKeyAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Filter by status' },
          orderId: { type: 'string', format: 'uuid', description: 'Filter to a specific order' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const auth = await authenticate(req, reply);
    if (!auth) return;

    const q = req.query as any;
    const where: any = { orgId: auth.orgId, customerId: auth.customerId };
    if (q.status) where.status = q.status;
    if (q.orderId) where.orderId = q.orderId;

    const rmas = await prisma.rma.findMany({
      where,
      include: { lines: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return { data: rmas, error: null };
  });

  // GET /api/v1/customer-api/rmas/:id — Get a specific RMA
  server.get('/api/v1/customer-api/rmas/:id', {
    schema: {
      tags: ['Customer API - Returns'],
      summary: 'Get RMA detail',
      description: 'Scoped to your customer account - returns 404 if the RMA belongs to another customer.',
      security: [{ ApiKeyAuth: [] }],
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const auth = await authenticate(req, reply);
    if (!auth) return;

    const { id } = req.params as { id: string };
    const rma = await prisma.rma.findFirst({
      where: { id, orgId: auth.orgId, customerId: auth.customerId },
      include: { lines: true },
    });
    if (!rma) { reply.code(404); return { data: null, error: 'RMA not found' }; }

    return { data: rma, error: null };
  });

  // GET /api/v1/customer-api/rmas/:id/return-label — download the return label for this RMA
  server.get('/api/v1/customer-api/rmas/:id/return-label', {
    schema: {
      tags: ['Customer API - Returns'],
      summary: 'Download the return shipping label for your RMA',
      description: 'Streams the stored label file. Scoped to your customer account.',
      security: [{ ApiKeyAuth: [] }],
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const auth = await authenticate(req, reply);
    if (!auth) return;

    const { id } = req.params as { id: string };
    const rma = await prisma.rma.findFirst({
      where: { id, orgId: auth.orgId, customerId: auth.customerId },
      select: { rmaNumber: true, returnLabelStorageKey: true, returnLabelFormat: true },
    });
    if (!rma) { reply.code(404); return { data: null, error: 'RMA not found' }; }
    if (!rma.returnLabelStorageKey) { reply.code(404); return { data: null, error: 'No return label available yet' }; }

    const content = await binaryStorage.retrieve(rma.returnLabelStorageKey);
    const format = rma.returnLabelFormat ?? 'pdf';
    const contentType = format === 'pdf' ? 'application/pdf' : format === 'png' ? 'image/png' : 'application/octet-stream';
    reply.header('Content-Type', contentType);
    reply.header('Content-Disposition', `attachment; filename="return-label-${rma.rmaNumber}.${format}"`);
    return reply.send(content);
  });
}
