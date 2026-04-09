import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { ITenderService } from '../services/TenderService.js';
import { ITenderRepository } from '../repositories/TenderRepository.js';
import { container, TOKENS } from '../di/index.js';

export async function tenderRoutes(server: FastifyInstance) {
  const tenderService = container.resolve<ITenderService>(TOKENS.ITenderService);
  const tenderRepo = container.resolve<ITenderRepository>(TOKENS.ITenderRepository);

  // List tenders
  server.get('/api/v1/tenders', {
    schema: {
      tags: ['Tenders'],
      summary: 'List all tenders',
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          strategy: { type: 'string' },
          shipmentId: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, _reply: FastifyReply) => {
    const { status, strategy, shipmentId } = req.query as any;
    const tenders = await tenderRepo.findAll({ status, strategy, shipmentId });
    return { data: tenders, error: null };
  });

  // Get tender by ID
  server.get('/api/v1/tenders/:id', {
    schema: {
      tags: ['Tenders'],
      summary: 'Get tender details with offers and bids',
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const tender = await tenderRepo.findById(id);
    if (!tender) {
      reply.code(404);
      return { data: null, error: 'Tender not found' };
    }
    return { data: tender, error: null };
  });

  // Create tender
  server.post('/api/v1/tenders', {
    schema: {
      tags: ['Tenders'],
      summary: 'Create a new tender for a shipment',
      body: {
        type: 'object',
        required: ['shipmentId', 'strategy', 'carrierIds'],
        properties: {
          shipmentId: { type: 'string' },
          strategy: { type: 'string', enum: ['broadcast', 'waterfall'] },
          carrierIds: { type: 'array', items: { type: 'string' }, minItems: 1 },
          tenderDurationMinutes: { type: 'number', minimum: 1 },
          targetRate: { type: 'number' },
          currency: { type: 'string' },
          equipmentType: { type: 'string' },
          notes: { type: 'string' },
          specialInstructions: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      shipmentId: z.string().min(1),
      strategy: z.enum(['broadcast', 'waterfall']),
      carrierIds: z.array(z.string()).min(1),
      tenderDurationMinutes: z.number().min(1).optional(),
      targetRate: z.number().positive().optional(),
      currency: z.string().optional(),
      equipmentType: z.string().optional(),
      notes: z.string().optional(),
      specialInstructions: z.string().optional(),
    }).parse((req as any).body);

    try {
      const tender = await tenderService.createTender({
        ...body,
        createdBy: (req as any).user?.sub,
      });
      reply.code(201);
      return { data: tender, error: null };
    } catch (err: any) {
      reply.code(400);
      return { data: null, error: err.message };
    }
  });

  // Open tender (start sending to carriers)
  server.post('/api/v1/tenders/:id/open', {
    schema: {
      tags: ['Tenders'],
      summary: 'Open a tender — sends offers to carriers',
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    try {
      const tender = await tenderService.openTender(id);
      return { data: tender, error: null };
    } catch (err: any) {
      reply.code(400);
      return { data: null, error: err.message };
    }
  });

  // Award tender to a bid
  server.post('/api/v1/tenders/:id/award', {
    schema: {
      tags: ['Tenders'],
      summary: 'Award tender to a specific bid',
      body: {
        type: 'object',
        required: ['bidId'],
        properties: {
          bidId: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const { bidId } = z.object({ bidId: z.string().min(1) }).parse((req as any).body);
    try {
      const tender = await tenderService.awardTender(id, bidId);
      return { data: tender, error: null };
    } catch (err: any) {
      reply.code(400);
      return { data: null, error: err.message };
    }
  });

  // Cancel tender
  server.post('/api/v1/tenders/:id/cancel', {
    schema: {
      tags: ['Tenders'],
      summary: 'Cancel a tender',
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    try {
      const tender = await tenderService.cancelTender(id);
      return { data: tender, error: null };
    } catch (err: any) {
      reply.code(400);
      return { data: null, error: err.message };
    }
  });

  // List bids for a tender
  server.get('/api/v1/tenders/:id/bids', {
    schema: {
      tags: ['Tenders'],
      summary: 'List all bids for a tender',
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const bids = await tenderRepo.findBidsByTenderId(id);
    return { data: bids, error: null };
  });
}
