import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { container, TOKENS } from '../di/index.js';
import { IQuoteRepository } from '../repositories/QuoteRepository.js';
import { ICommandBus } from '../commands/CommandBus.js';
import { CREATE_QUOTE, CreateQuotePayload } from '../commands/quotes/CreateQuoteCommand.js';
import { ACCEPT_QUOTE, AcceptQuotePayload } from '../commands/quotes/AcceptQuoteCommand.js';
import { DECLINE_QUOTE, DeclineQuotePayload } from '../commands/quotes/DeclineQuoteCommand.js';
import { REVISE_QUOTE, ReviseQuotePayload } from '../commands/quotes/ReviseQuoteCommand.js';
import { ILtlRatingService } from '../services/LtlRatingService.js';

export async function quoteRoutes(server: FastifyInstance) {
  const quoteRepo = container.resolve<IQuoteRepository>(TOKENS.IQuoteRepository);
  const commandBus = container.resolve<ICommandBus>(TOKENS.ICommandBus);
  const ltlRatingService = container.resolve<ILtlRatingService>(TOKENS.ILtlRatingService);

  // List quotes
  server.get('/api/v1/quotes', {
    schema: {
      tags: ['Financial - Quotes'],
      summary: 'List quotes with optional filters',
      querystring: {
        type: 'object',
        properties: {
          customerId: { type: 'string' },
          status: { type: 'string', enum: ['draft', 'sent', 'accepted', 'declined', 'expired', 'superseded'] },
        },
      },
    },
  }, async (req: FastifyRequest) => {
    const query = req.query as Record<string, string>;
    const quotes = await quoteRepo.findAll({
      customerId: query.customerId,
      status: query.status,
    });
    return { data: quotes, error: null };
  });

  // Get quote by ID
  server.get('/api/v1/quotes/:id', {
    schema: {
      tags: ['Financial - Quotes'],
      summary: 'Get quote with line items',
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const quote = await quoteRepo.findById(id);
    if (!quote) {
      reply.code(404);
      return { data: null, error: 'Quote not found' };
    }
    return { data: quote, error: null };
  });

  // Create quote
  server.post('/api/v1/quotes', {
    schema: {
      tags: ['Financial - Quotes'],
      summary: 'Create a new quote for a customer',
      body: {
        type: 'object',
        required: ['customerId', 'lineItems'],
        properties: {
          customerId: { type: 'string' },
          originId: { type: 'string' },
          destinationId: { type: 'string' },
          serviceLevel: { type: 'string', enum: ['FTL', 'LTL'] },
          equipmentType: { type: 'string' },
          lineItems: {
            type: 'array', minItems: 1,
            items: {
              type: 'object',
              required: ['chargeType', 'description', 'amountCents'],
              properties: {
                chargeType: { type: 'string' },
                description: { type: 'string' },
                amountCents: { type: 'integer' },
                accessorialCode: { type: 'string' },
                freightClass: { type: 'string' },
                weight: { type: 'number' },
                ratePerCwt: { type: 'integer' },
                quantity: { type: 'integer', minimum: 1 },
              },
            },
          },
          markupPercent: { type: 'number', minimum: 0 },
          validDays: { type: 'integer', minimum: 1 },
          notes: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      customerId: z.string().min(1),
      originId: z.string().optional(),
      destinationId: z.string().optional(),
      serviceLevel: z.enum(['FTL', 'LTL']).optional(),
      equipmentType: z.string().optional(),
      lineItems: z.array(z.object({
        chargeType: z.string(),
        description: z.string(),
        amountCents: z.number().int(),
        accessorialCode: z.string().optional(),
        freightClass: z.string().optional(),
        weight: z.number().optional(),
        ratePerCwt: z.number().int().optional(),
        quantity: z.number().int().min(1).optional(),
      })).min(1),
      markupPercent: z.number().min(0).optional(),
      validDays: z.number().int().min(1).optional(),
      notes: z.string().optional(),
    }).parse((req as any).body);

    try {
      const result = await commandBus.dispatch<CreateQuotePayload, { id: string; quoteNumber: string }>({
        type: CREATE_QUOTE,
        orgId: (req as any).orgId ?? '',
        actorId: (req as any).user?.sub ?? null,
        payload: body,
        metadata: { correlationId: crypto.randomUUID(), source: 'api' },
      });
      if (!result.success) {
        reply.code(400);
        return { data: null, error: result.error };
      }
      reply.code(201);
      return { data: result.data, error: null };
    } catch (err: any) {
      reply.code(400);
      return { data: null, error: err.message };
    }
  });

  // Accept quote (creates order with charges)
  server.post('/api/v1/quotes/:id/accept', {
    schema: {
      tags: ['Financial - Quotes'],
      summary: 'Accept a quote — creates an order with pre-populated revenue charges',
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    try {
      const result = await commandBus.dispatch<AcceptQuotePayload, { id: string; orderId: string }>({
        type: ACCEPT_QUOTE,
        orgId: (req as any).orgId ?? '',
        actorId: (req as any).user?.sub ?? null,
        payload: { quoteId: id },
        metadata: { correlationId: crypto.randomUUID(), source: 'api' },
      });
      if (!result.success) {
        reply.code(400);
        return { data: null, error: result.error };
      }
      return { data: result.data, error: null };
    } catch (err: any) {
      reply.code(400);
      return { data: null, error: err.message };
    }
  });

  // Decline quote
  server.post('/api/v1/quotes/:id/decline', {
    schema: {
      tags: ['Financial - Quotes'],
      summary: 'Decline a quote',
      body: {
        type: 'object',
        properties: {
          reason: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      reason: z.string().optional(),
    }).parse((req as any).body ?? {});

    try {
      const result = await commandBus.dispatch<DeclineQuotePayload, { id: string }>({
        type: DECLINE_QUOTE,
        orgId: (req as any).orgId ?? '',
        actorId: (req as any).user?.sub ?? null,
        payload: { quoteId: id, ...body },
        metadata: { correlationId: crypto.randomUUID(), source: 'api' },
      });
      if (!result.success) {
        reply.code(400);
        return { data: null, error: result.error };
      }
      return { data: result.data, error: null };
    } catch (err: any) {
      reply.code(400);
      return { data: null, error: err.message };
    }
  });

  // Revise quote (supersedes original, creates new version)
  server.post('/api/v1/quotes/:id/revise', {
    schema: {
      tags: ['Financial - Quotes'],
      summary: 'Create a revised version of a quote (supersedes the original)',
      body: {
        type: 'object',
        required: ['lineItems'],
        properties: {
          lineItems: {
            type: 'array', minItems: 1,
            items: {
              type: 'object',
              required: ['chargeType', 'description', 'amountCents'],
              properties: {
                chargeType: { type: 'string' },
                description: { type: 'string' },
                amountCents: { type: 'integer' },
                accessorialCode: { type: 'string' },
                freightClass: { type: 'string' },
                weight: { type: 'number' },
                ratePerCwt: { type: 'integer' },
                quantity: { type: 'integer', minimum: 1 },
              },
            },
          },
          markupPercent: { type: 'number', minimum: 0 },
          validDays: { type: 'integer', minimum: 1 },
          notes: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      lineItems: z.array(z.object({
        chargeType: z.string(),
        description: z.string(),
        amountCents: z.number().int(),
        accessorialCode: z.string().optional(),
        freightClass: z.string().optional(),
        weight: z.number().optional(),
        ratePerCwt: z.number().int().optional(),
        quantity: z.number().int().min(1).optional(),
      })).min(1),
      markupPercent: z.number().min(0).optional(),
      validDays: z.number().int().min(1).optional(),
      notes: z.string().optional(),
    }).parse((req as any).body);

    try {
      const result = await commandBus.dispatch<ReviseQuotePayload, { id: string; quoteNumber: string; version: number }>({
        type: REVISE_QUOTE,
        orgId: (req as any).orgId ?? '',
        actorId: (req as any).user?.sub ?? null,
        payload: { originalQuoteId: id, ...body },
        metadata: { correlationId: crypto.randomUUID(), source: 'api' },
      });
      if (!result.success) {
        reply.code(400);
        return { data: null, error: result.error };
      }
      reply.code(201);
      return { data: result.data, error: null };
    } catch (err: any) {
      reply.code(400);
      return { data: null, error: err.message };
    }
  });

  // Calculate LTL rate
  server.post('/api/v1/rates/ltl', {
    schema: {
      tags: ['Financial - Rating'],
      summary: 'Calculate LTL rate breakdown with class-based rating, weight breaks, and deficit weight',
      body: {
        type: 'object',
        required: ['items'],
        properties: {
          items: {
            type: 'array', minItems: 1,
            items: {
              type: 'object',
              required: ['weight', 'freightClass', 'quantity'],
              properties: {
                weight: { type: 'number', description: 'Weight in lbs' },
                freightClass: { type: 'string' },
                quantity: { type: 'integer', minimum: 1 },
                description: { type: 'string' },
              },
            },
          },
          ltlRateMatrix: { type: 'object', description: 'Rate matrix: { class: { weightBreak: centsPerCwt } }' },
          minimumChargeCents: { type: 'integer' },
          fakClass: { type: 'string', description: 'Freight All Kinds override class' },
          requestedAccessorials: { type: 'array', items: { type: 'string' } },
          accessorialRates: { type: 'object' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = (req as any).body;
    try {
      const breakdown = ltlRatingService.calculateLtlRate(body);
      return { data: breakdown, error: null };
    } catch (err: any) {
      reply.code(400);
      return { data: null, error: err.message };
    }
  });

  // Calculate density-based freight class
  server.post('/api/v1/rates/freight-class', {
    schema: {
      tags: ['Financial - Rating'],
      summary: 'Calculate freight class from dimensions and weight',
      body: {
        type: 'object',
        required: ['weightLbs', 'lengthIn', 'widthIn', 'heightIn'],
        properties: {
          weightLbs: { type: 'number' },
          lengthIn: { type: 'number' },
          widthIn: { type: 'number' },
          heightIn: { type: 'number' },
        },
      },
    },
  }, async (req: FastifyRequest) => {
    const body = (req as any).body;
    const freightClass = ltlRatingService.calculateDensityClass(
      body.weightLbs, body.lengthIn, body.widthIn, body.heightIn
    );
    const cubicFeet = (body.lengthIn * body.widthIn * body.heightIn) / 1728;
    const density = cubicFeet > 0 ? body.weightLbs / cubicFeet : 0;
    return {
      data: {
        freightClass,
        density: Math.round(density * 100) / 100,
        cubicFeet: Math.round(cubicFeet * 100) / 100,
      },
      error: null,
    };
  });
}
