import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { container, TOKENS } from '../di/index.js';
import { ICommandBus } from '../commands/CommandBus.js';
import { CREATE_RMA } from '../commands/rma/CreateRmaCommand.js';
import { AUTHORIZE_RMA } from '../commands/rma/AuthorizeRmaCommand.js';
import { REJECT_RMA } from '../commands/rma/RejectRmaCommand.js';
import { RECEIVE_RMA_LINE } from '../commands/rma/ReceiveRmaLineCommand.js';
import { INSPECT_RMA_LINE } from '../commands/rma/InspectRmaLineCommand.js';
import { COMPLETE_RMA } from '../commands/rma/CompleteRmaCommand.js';
import { GENERATE_RETURN_LABEL } from '../commands/rma/GenerateReturnLabelCommand.js';
import { SCHEDULE_RMA_PICKUP } from '../commands/rma/SchedulePickupCommand.js';
import { CANCEL_RMA_PICKUP } from '../commands/rma/CancelPickupCommand.js';
import type { IBinaryStorageProvider } from '../storage/IBinaryStorageProvider.js';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const RETURN_REASONS = ['damaged', 'wrong_item', 'not_as_described', 'no_longer_needed', 'defective', 'ordered_extra', 'other'] as const;
const DISPOSITIONS = ['restock', 'refurb', 'scrap', 'recycle', 'donate', 'rtv', 'customer_keeps'] as const;
const INSPECTION_STATUSES = ['pass', 'fail', 'partial_damage'] as const;

const ADDRESS_SCHEMA = {
  type: 'object',
  required: ['name', 'address1', 'city', 'postalCode', 'country'],
  properties: {
    name: { type: 'string' },
    company: { type: 'string' },
    address1: { type: 'string' },
    address2: { type: 'string' },
    city: { type: 'string' },
    state: { type: 'string' },
    postalCode: { type: 'string' },
    country: { type: 'string' },
    phone: { type: 'string' },
    email: { type: 'string' },
  },
} as const;

const PARCEL_SCHEMA = {
  type: 'object',
  required: ['weightKg'],
  properties: {
    weightKg: { type: 'number', exclusiveMinimum: 0 },
    lengthCm: { type: 'number' },
    widthCm: { type: 'number' },
    heightCm: { type: 'number' },
    description: { type: 'string' },
    declaredValueCents: { type: 'integer' },
  },
} as const;

export async function rmaRoutes(server: FastifyInstance) {
  const commandBus = container.resolve<ICommandBus>(TOKENS.ICommandBus);
  const prisma = container.resolve<PrismaClient>(TOKENS.PrismaClient);
  const binaryStorage = container.resolve<IBinaryStorageProvider>(TOKENS.IBinaryStorageProvider);

  // GET /api/v1/rmas?status=xxx&customerId=xxx
  server.get('/api/v1/rmas', {
    schema: {
      tags: ['WMS - Returns / RMA'],
      summary: 'List RMAs with optional filters',
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          customerId: { type: 'string', format: 'uuid' },
          pendingDisposition: { type: 'boolean' },
          pendingRefund: { type: 'boolean' },
        },
      },
    },
  }, async (req: FastifyRequest) => {
    const q = req.query as any;
    const orgId = (req as any).orgId || 'default-org';
    const where: any = { orgId };
    if (q.status) where.status = q.status;
    if (q.customerId) where.customerId = q.customerId;
    if (q.pendingDisposition === true || q.pendingDisposition === 'true') {
      where.status = { in: ['received', 'inspecting'] };
    }
    if (q.pendingRefund === true || q.pendingRefund === 'true') {
      where.status = 'dispositioning';
    }

    const rmas = await prisma.rma.findMany({
      where,
      include: { _count: { select: { lines: true } } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    return { data: rmas, error: null };
  });

  // GET /api/v1/warehouse/rmas — warehouse mobile app view
  // Returns RMAs with at least one line still needing work:
  //   - status in [authorized, in_transit, received, inspecting]
  //   - line-level: receivedQuantity < requestedQuantity OR disposition === 'pending'
  server.get('/api/v1/warehouse/rmas', {
    schema: {
      tags: ['WMS - Returns / RMA'],
      summary: 'RMAs awaiting warehouse action (receiving or inspection)',
      querystring: {
        type: 'object',
        properties: {
          stage: { type: 'string', enum: ['receive', 'inspect', 'any'], default: 'any' },
          rmaNumber: { type: 'string', description: 'Exact lookup for scanned RMA labels' },
        },
      },
    },
  }, async (req: FastifyRequest) => {
    const q = req.query as { stage?: 'receive' | 'inspect' | 'any'; rmaNumber?: string };
    const orgId = (req as any).orgId || 'default-org';
    const stage = q.stage ?? 'any';

    const statusByStage: Record<string, string[]> = {
      receive: ['authorized', 'in_transit', 'received'],
      inspect: ['received', 'inspecting'],
      any: ['authorized', 'in_transit', 'received', 'inspecting'],
    };

    const where: any = { orgId, status: { in: statusByStage[stage] } };
    if (q.rmaNumber) where.rmaNumber = q.rmaNumber;

    const rmas = await prisma.rma.findMany({
      where,
      include: {
        lines: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: [{ authorizedAt: 'asc' }, { createdAt: 'asc' }],
      take: 100,
    });

    // Compute per-RMA work remaining so the mobile app can show counts
    const enriched = rmas.map(r => {
      const linesToReceive = r.lines.filter(l => l.receivedQuantity < l.requestedQuantity).length;
      const linesToInspect = r.lines.filter(l => l.receivedQuantity > 0 && l.disposition === 'pending').length;
      return { ...r, linesToReceive, linesToInspect };
    }).filter(r => stage === 'any' ? (r.linesToReceive > 0 || r.linesToInspect > 0)
                  : stage === 'receive' ? r.linesToReceive > 0
                  : r.linesToInspect > 0);

    return { data: enriched, error: null };
  });

  // GET /api/v1/rmas/:id
  server.get('/api/v1/rmas/:id', {
    schema: { tags: ['WMS - Returns / RMA'], summary: 'Get RMA detail with lines' },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const rma = await prisma.rma.findUnique({
      where: { id },
      include: {
        lines: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!rma) { reply.code(404); return { data: null, error: 'RMA not found' }; }
    return { data: rma, error: null };
  });

  // POST /api/v1/rmas — create new RMA (admin or customer portal)
  server.post('/api/v1/rmas', {
    schema: {
      tags: ['WMS - Returns / RMA'],
      summary: 'Create a new RMA request',
      body: {
        type: 'object', required: ['customerId', 'orderId', 'returnReason', 'lines'],
        properties: {
          customerId: { type: 'string', format: 'uuid' },
          orderId: { type: 'string', format: 'uuid' },
          returnReason: { type: 'string', enum: [...RETURN_REASONS] },
          customerNotes: { type: 'string' },
          initiatedVia: { type: 'string', enum: ['admin', 'customer_portal', 'marketplace_webhook'] },
          autoAuthorize: { type: 'boolean', description: 'Skip request state, go straight to authorized (CSR-initiated)' },
          lines: {
            type: 'array', minItems: 1,
            items: {
              type: 'object', required: ['orderLineItemId', 'sku', 'requestedQuantity'],
              properties: {
                orderLineItemId: { type: 'string' },
                sku: { type: 'string' },
                requestedQuantity: { type: 'integer', minimum: 1 },
                requestedDisposition: { type: 'string', enum: [...DISPOSITIONS] },
                unitPriceCents: { type: 'integer' },
              },
            },
          },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      customerId: z.string().uuid(),
      orderId: z.string().uuid(),
      returnReason: z.enum(RETURN_REASONS),
      customerNotes: z.string().optional(),
      initiatedVia: z.enum(['admin', 'customer_portal', 'marketplace_webhook']).optional(),
      autoAuthorize: z.boolean().optional(),
      lines: z.array(z.object({
        orderLineItemId: z.string(),
        sku: z.string(),
        requestedQuantity: z.number().int().min(1),
        requestedDisposition: z.enum(DISPOSITIONS).optional(),
        unitPriceCents: z.number().int().nonnegative().optional(),
      })).min(1),
    }).parse((req as any).body);

    const orgId = (req as any).orgId || 'default-org';
    const actorId = (req as any).userId || 'system';

    const result = await commandBus.dispatch({
      type: CREATE_RMA, orgId, actorId, payload: body,
      metadata: { correlationId: crypto.randomUUID(), source: body.initiatedVia || 'api' },
    });

    if (!result.success) { reply.code(400); return { data: null, error: result.error }; }
    reply.code(201);
    return { data: result.data, error: null };
  });

  // POST /api/v1/rmas/:id/authorize
  server.post('/api/v1/rmas/:id/authorize', {
    schema: { tags: ['WMS - Returns / RMA'], summary: 'Authorize a requested RMA' },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const orgId = (req as any).orgId || 'default-org';
    const actorId = (req as any).userId || 'system';

    const result = await commandBus.dispatch({
      type: AUTHORIZE_RMA, orgId, actorId, payload: { rmaId: id },
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) { reply.code(400); return { data: null, error: result.error }; }
    return { data: result.data, error: null };
  });

  // POST /api/v1/rmas/:id/reject
  server.post('/api/v1/rmas/:id/reject', {
    schema: {
      tags: ['WMS - Returns / RMA'],
      summary: 'Reject an RMA request',
      body: {
        type: 'object', required: ['rejectionNotes'],
        properties: { rejectionNotes: { type: 'string' } },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = z.object({ rejectionNotes: z.string().min(1) }).parse((req as any).body);
    const orgId = (req as any).orgId || 'default-org';
    const actorId = (req as any).userId || 'system';

    const result = await commandBus.dispatch({
      type: REJECT_RMA, orgId, actorId, payload: { rmaId: id, ...body },
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) { reply.code(400); return { data: null, error: result.error }; }
    return { data: result.data, error: null };
  });

  // POST /api/v1/rma-lines/:id/receive
  server.post('/api/v1/rma-lines/:id/receive', {
    schema: {
      tags: ['WMS - Returns / RMA'],
      summary: 'Record physical receipt of a returned item',
      body: {
        type: 'object', required: ['receivedQuantity'],
        properties: {
          receivedQuantity: { type: 'integer', minimum: 0 },
          quarantineBinId: { type: 'string', format: 'uuid' },
          trackableUnitId: { type: 'string', format: 'uuid' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      receivedQuantity: z.number().int().min(0),
      quarantineBinId: z.string().uuid().optional(),
      trackableUnitId: z.string().uuid().optional(),
    }).parse((req as any).body);

    const orgId = (req as any).orgId || 'default-org';
    const actorId = (req as any).userId || 'system';

    const result = await commandBus.dispatch({
      type: RECEIVE_RMA_LINE, orgId, actorId, payload: { rmaLineId: id, ...body },
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) { reply.code(400); return { data: null, error: result.error }; }
    return { data: result.data, error: null };
  });

  // POST /api/v1/rma-lines/:id/inspect
  server.post('/api/v1/rma-lines/:id/inspect', {
    schema: {
      tags: ['WMS - Returns / RMA'],
      summary: 'Inspect a returned item and set its disposition',
      body: {
        type: 'object', required: ['inspectionStatus', 'disposition'],
        properties: {
          inspectionStatus: { type: 'string', enum: [...INSPECTION_STATUSES] },
          disposition: { type: 'string', enum: [...DISPOSITIONS] },
          inspectionNotes: { type: 'string' },
          conditionPhotos: { type: 'array', items: { type: 'string' } },
          routeToBinId: { type: 'string', format: 'uuid' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      inspectionStatus: z.enum(INSPECTION_STATUSES),
      disposition: z.enum(DISPOSITIONS),
      inspectionNotes: z.string().optional(),
      conditionPhotos: z.array(z.string()).optional(),
      routeToBinId: z.string().uuid().optional(),
    }).parse((req as any).body);

    const orgId = (req as any).orgId || 'default-org';
    const actorId = (req as any).userId || 'system';

    const result = await commandBus.dispatch({
      type: INSPECT_RMA_LINE, orgId, actorId, payload: { rmaLineId: id, ...body },
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) { reply.code(400); return { data: null, error: result.error }; }
    return { data: result.data, error: null };
  });

  // POST /api/v1/rmas/:id/complete
  server.post('/api/v1/rmas/:id/complete', {
    schema: {
      tags: ['WMS - Returns / RMA'],
      summary: 'Complete an RMA, generate inventory movements for restock lines, trigger credit note',
      body: {
        type: 'object',
        properties: {
          actualRefundCents: { type: 'integer', description: 'Finance override of suggested refund amount' },
          refundAdjustmentNotes: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      actualRefundCents: z.number().int().nonnegative().optional(),
      refundAdjustmentNotes: z.string().optional(),
    }).parse((req as any).body ?? {});

    const orgId = (req as any).orgId || 'default-org';
    const actorId = (req as any).userId || 'system';

    const result = await commandBus.dispatch({
      type: COMPLETE_RMA, orgId, actorId, payload: { rmaId: id, ...body },
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) { reply.code(400); return { data: null, error: result.error }; }
    return { data: result.data, error: null };
  });

  // GET /api/v1/rmas/refund-review/queue — finance review queue
  server.get('/api/v1/rmas/refund-review/queue', {
    schema: {
      tags: ['WMS - Returns / RMA'],
      summary: 'Finance review queue: RMAs awaiting refund approval',
    },
  }, async (req: FastifyRequest) => {
    const orgId = (req as any).orgId || 'default-org';

    // Queue = RMAs in 'dispositioning' status (all lines inspected, awaiting finance review & completion)
    const rmas = await prisma.rma.findMany({
      where: { orgId, status: 'dispositioning' },
      include: { lines: true },
      orderBy: { createdAt: 'asc' },
    });

    return { data: rmas, error: null };
  });

  // POST /api/v1/rmas/:id/return-label — generate a return shipping label
  server.post('/api/v1/rmas/:id/return-label', {
    schema: {
      tags: ['WMS - Returns / RMA'],
      summary: 'Generate a return shipping label for an RMA',
      body: {
        type: 'object',
        required: ['from', 'to', 'parcels'],
        properties: {
          carrierId: { type: 'string', format: 'uuid' },
          providerOverride: { type: 'string', enum: ['manual', 'fedex', 'ups', 'dhl'] },
          serviceLevel: { type: 'string' },
          reference: { type: 'string' },
          from: ADDRESS_SCHEMA,
          to: ADDRESS_SCHEMA,
          parcels: { type: 'array', minItems: 1, items: PARCEL_SCHEMA },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const orgId = (req as any).orgId || 'default-org';
    const actorId = (req as any).userId || 'system';
    const body = req.body as any;

    const result = await commandBus.dispatch({
      type: GENERATE_RETURN_LABEL, orgId, actorId,
      payload: { rmaId: id, ...body },
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) { reply.code(400); return { data: null, error: result.error }; }
    return { data: result.data, error: null };
  });

  // GET /api/v1/rmas/:id/return-label/download — stream the stored label file
  server.get('/api/v1/rmas/:id/return-label/download', {
    schema: {
      tags: ['WMS - Returns / RMA'],
      summary: 'Download the stored return shipping label',
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const rma = await prisma.rma.findUnique({
      where: { id },
      select: { returnLabelStorageKey: true, returnLabelFormat: true, rmaNumber: true },
    });
    if (!rma || !rma.returnLabelStorageKey) {
      reply.code(404);
      return { data: null, error: 'No return label stored for this RMA' };
    }
    const content = await binaryStorage.retrieve(rma.returnLabelStorageKey);
    const format = rma.returnLabelFormat ?? 'pdf';
    const contentType = format === 'pdf' ? 'application/pdf' : format === 'png' ? 'image/png' : 'application/octet-stream';
    reply.header('Content-Type', contentType);
    reply.header('Content-Disposition', `attachment; filename="return-label-${rma.rmaNumber}.${format}"`);
    return reply.send(content);
  });

  // POST /api/v1/rmas/:id/pickup — schedule a carrier pickup
  server.post('/api/v1/rmas/:id/pickup', {
    schema: {
      tags: ['WMS - Returns / RMA'],
      summary: 'Schedule a carrier pickup for the return',
      body: {
        type: 'object',
        required: ['pickupDate', 'address'],
        properties: {
          pickupDate: { type: 'string', format: 'date-time' },
          pickupWindow: { type: 'string' },
          address: ADDRESS_SCHEMA,
          notes: { type: 'string' },
          providerOverride: { type: 'string', enum: ['manual', 'fedex', 'ups', 'dhl'] },
          pickupAddressId: { type: 'string', format: 'uuid' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const orgId = (req as any).orgId || 'default-org';
    const actorId = (req as any).userId || 'system';
    const body = req.body as any;

    const result = await commandBus.dispatch({
      type: SCHEDULE_RMA_PICKUP, orgId, actorId,
      payload: { rmaId: id, ...body },
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) { reply.code(400); return { data: null, error: result.error }; }
    return { data: result.data, error: null };
  });

  // POST /api/v1/rmas/:id/pickup/cancel — cancel a scheduled pickup
  server.post('/api/v1/rmas/:id/pickup/cancel', {
    schema: {
      tags: ['WMS - Returns / RMA'],
      summary: 'Cancel the scheduled carrier pickup',
      body: {
        type: 'object',
        properties: { reason: { type: 'string' } },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const orgId = (req as any).orgId || 'default-org';
    const actorId = (req as any).userId || 'system';
    const body = (req.body as any) ?? {};

    const result = await commandBus.dispatch({
      type: CANCEL_RMA_PICKUP, orgId, actorId,
      payload: { rmaId: id, reason: body.reason },
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) { reply.code(400); return { data: null, error: result.error }; }
    return { data: result.data, error: null };
  });
}
