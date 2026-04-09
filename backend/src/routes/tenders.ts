import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { ITenderRepository } from '../repositories/TenderRepository.js';
import { container, TOKENS } from '../di/index.js';
import { IEventBus, EVENT_TYPES, createEvent } from '../events/index.js';

export async function tenderRoutes(server: FastifyInstance) {
  const tenderRepo = container.resolve<ITenderRepository>(TOKENS.ITenderRepository);

  // List all tenders (with optional status filter)
  server.get('/api/v1/tenders', {
    schema: {
      tags: ['Tenders'],
      description: 'List all carrier tenders',
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['draft', 'published', 'awarded', 'cancelled', 'expired'] },
        },
      },
    },
  }, async (req: FastifyRequest, _reply: FastifyReply) => {
    const { status } = req.query as { status?: string };
    const tenders = await tenderRepo.findAll(status ? { status } : undefined);
    return { data: tenders, error: null };
  });

  // Get tender by ID
  server.get('/api/v1/tenders/:id', {
    schema: { tags: ['Tenders'], description: 'Get tender details' },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const tender = await tenderRepo.findById(id);
    if (!tender) {
      reply.code(404);
      return { data: null, error: 'Tender not found' };
    }
    return { data: tender, error: null };
  });

  // Create a tender for a shipment
  server.post('/api/v1/tenders', {
    schema: { tags: ['Tenders'], description: 'Create a carrier tender for a shipment' },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      shipmentId: z.string().uuid(),
      expiresAt: z.string().datetime().optional(),
      notes: z.string().optional(),
    }).parse((req as any).body);

    // Verify shipment exists and has no lane
    const shipment = await server.prisma.shipment.findFirst({
      where: { id: body.shipmentId, archived: false },
      include: { lane: true },
    });
    if (!shipment) {
      reply.code(404);
      return { data: null, error: 'Shipment not found' };
    }

    // Check no existing tender
    const existing = await tenderRepo.findByShipmentId(body.shipmentId);
    if (existing) {
      reply.code(409);
      return { data: null, error: 'Tender already exists for this shipment' };
    }

    const tender = await tenderRepo.create({
      shipmentId: body.shipmentId,
      status: 'draft',
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      notes: body.notes,
    });

    // Publish event
    try {
      const eventBus = container.resolve<IEventBus>(TOKENS.IEventBus);
      const org = await server.prisma.organization.findFirst({ select: { id: true } });
      await eventBus.publish(createEvent({
        type: EVENT_TYPES.TENDER_CREATED,
        orgId: org?.id || 'default',
        actorId: req.user?.sub,
        entityType: 'tender',
        entityId: tender.id,
        payload: {
          shipmentId: body.shipmentId,
          shipmentReference: shipment.reference,
        },
        source: 'api',
      }));
    } catch (err) {
      server.log.warn('Failed to publish domain event: ' + (err as Error).message);
    }

    reply.code(201);
    const full = await tenderRepo.findById(tender.id);
    return { data: full, error: null };
  });

  // Publish a tender (make it available to carriers)
  server.post('/api/v1/tenders/:id/publish', {
    schema: { tags: ['Tenders'], description: 'Publish a tender to make it available for carrier bidding' },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const tender = await tenderRepo.findById(id);
    if (!tender) {
      reply.code(404);
      return { data: null, error: 'Tender not found' };
    }
    if (tender.status !== 'draft') {
      reply.code(400);
      return { data: null, error: `Cannot publish a tender with status '${tender.status}'` };
    }

    const updated = await tenderRepo.update(id, {
      status: 'published',
      publishedAt: new Date(),
    });

    // Publish event
    try {
      const eventBus = container.resolve<IEventBus>(TOKENS.IEventBus);
      const org = await server.prisma.organization.findFirst({ select: { id: true } });
      await eventBus.publish(createEvent({
        type: EVENT_TYPES.TENDER_PUBLISHED,
        orgId: org?.id || 'default',
        actorId: req.user?.sub,
        entityType: 'tender',
        entityId: id,
        payload: { shipmentId: tender.shipmentId },
        source: 'api',
      }));
    } catch (err) {
      server.log.warn('Failed to publish domain event: ' + (err as Error).message);
    }

    return { data: updated, error: null };
  });

  // Award a tender to a carrier
  server.post('/api/v1/tenders/:id/award', {
    schema: { tags: ['Tenders'], description: 'Award the tender to a carrier' },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      carrierId: z.string().uuid(),
      price: z.number().positive().optional(),
      currency: z.string().default('USD'),
    }).parse((req as any).body);

    const tender = await tenderRepo.findById(id);
    if (!tender) {
      reply.code(404);
      return { data: null, error: 'Tender not found' };
    }
    if (tender.status !== 'published') {
      reply.code(400);
      return { data: null, error: `Cannot award a tender with status '${tender.status}'` };
    }

    // Award tender and assign carrier to shipment
    await server.prisma.$transaction(async (tx) => {
      await tx.tender.update({
        where: { id },
        data: {
          status: 'awarded',
          awardedCarrierId: body.carrierId,
          awardedAt: new Date(),
          awardedPrice: body.price,
          awardedCurrency: body.currency,
        },
      });
      await tx.shipment.update({
        where: { id: tender.shipmentId },
        data: { carrierId: body.carrierId },
      });
    });

    // Publish event
    try {
      const eventBus = container.resolve<IEventBus>(TOKENS.IEventBus);
      const org = await server.prisma.organization.findFirst({ select: { id: true } });
      await eventBus.publish(createEvent({
        type: EVENT_TYPES.TENDER_AWARDED,
        orgId: org?.id || 'default',
        actorId: req.user?.sub,
        entityType: 'tender',
        entityId: id,
        payload: {
          shipmentId: tender.shipmentId,
          carrierId: body.carrierId,
          price: body.price,
        },
        source: 'api',
      }));
    } catch (err) {
      server.log.warn('Failed to publish domain event: ' + (err as Error).message);
    }

    const full = await tenderRepo.findById(id);
    return { data: full, error: null };
  });

  // Cancel a tender
  server.post('/api/v1/tenders/:id/cancel', {
    schema: { tags: ['Tenders'], description: 'Cancel a tender' },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const tender = await tenderRepo.findById(id);
    if (!tender) {
      reply.code(404);
      return { data: null, error: 'Tender not found' };
    }
    if (tender.status === 'awarded' || tender.status === 'cancelled') {
      reply.code(400);
      return { data: null, error: `Cannot cancel a tender with status '${tender.status}'` };
    }

    const updated = await tenderRepo.update(id, { status: 'cancelled' });
    return { data: updated, error: null };
  });

  // Add a carrier response to a tender
  server.post('/api/v1/tenders/:id/responses', {
    schema: { tags: ['Tenders'], description: 'Submit a carrier response/bid for a tender' },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      carrierId: z.string().uuid(),
      status: z.enum(['accepted', 'declined']).default('accepted'),
      price: z.number().positive().optional(),
      currency: z.string().default('USD'),
      notes: z.string().optional(),
      transitDays: z.number().int().positive().optional(),
    }).parse((req as any).body);

    const tender = await tenderRepo.findById(id);
    if (!tender) {
      reply.code(404);
      return { data: null, error: 'Tender not found' };
    }
    if (tender.status !== 'published') {
      reply.code(400);
      return { data: null, error: 'Tender is not open for responses' };
    }

    const response = await tenderRepo.createResponse({
      tenderId: id,
      carrierId: body.carrierId,
      price: body.price,
      currency: body.currency,
      notes: body.notes,
      transitDays: body.transitDays,
    });

    // Update status if provided
    if (body.status) {
      await tenderRepo.updateResponse(response.id, {
        status: body.status,
        respondedAt: new Date(),
      });
    }

    reply.code(201);
    return { data: response, error: null };
  });

  // Get tender responses
  server.get('/api/v1/tenders/:id/responses', {
    schema: { tags: ['Tenders'], description: 'List all carrier responses for a tender' },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const tender = await tenderRepo.findById(id);
    if (!tender) {
      reply.code(404);
      return { data: null, error: 'Tender not found' };
    }

    const responses = await tenderRepo.findResponses(id);
    return { data: responses, error: null };
  });
}
