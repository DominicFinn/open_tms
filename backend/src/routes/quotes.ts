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
import { IRatingService } from '../services/RatingService.js';
import { CreditCheckService } from '../services/CreditCheckService.js';

export async function quoteRoutes(server: FastifyInstance) {
  const quoteRepo = container.resolve<IQuoteRepository>(TOKENS.IQuoteRepository);
  const commandBus = container.resolve<ICommandBus>(TOKENS.ICommandBus);
  const ltlRatingService = container.resolve<ILtlRatingService>(TOKENS.ILtlRatingService);
  const ratingService = container.resolve<IRatingService>(TOKENS.IRatingService);

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

  // Accept quote (creates order with charges, optionally creates shipment for brokers)
  server.post('/api/v1/quotes/:id/accept', {
    schema: {
      tags: ['Financial - Quotes'],
      summary: 'Accept a quote - creates an order with pre-populated revenue charges. For broker orgs, also creates a shipment.',
      body: {
        type: 'object',
        properties: {
          createShipment: { type: 'boolean', description: 'Also create a shipment (for broker quote-to-book flow)' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = (req as any).body || {};
    try {
      const result = await commandBus.dispatch<AcceptQuotePayload, { id: string; orderId: string; shipmentId?: string | null }>({
        type: ACCEPT_QUOTE,
        orgId: (req as any).orgId ?? '',
        actorId: (req as any).user?.sub ?? null,
        payload: { quoteId: id, createShipment: body.createShipment },
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

  // Quick quote: auto-populate line items from lane-carrier rates + markup
  server.post('/api/v1/quotes/quick', {
    schema: {
      tags: ['Financial - Quotes'],
      summary: 'Generate a quick quote from lane-carrier rates with customer markup',
      body: {
        type: 'object',
        required: ['customerId', 'laneId'],
        properties: {
          customerId: { type: 'string' },
          laneId: { type: 'string' },
          carrierId: { type: 'string' },
          serviceLevel: { type: 'string', enum: ['FTL', 'LTL'], default: 'FTL' },
          markupPercent: { type: 'number', minimum: 0, default: 15 },
          validDays: { type: 'integer', minimum: 1, default: 30 },
          notes: { type: 'string' },
          totalWeightKg: { type: 'number' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = (req as any).body;

    // Get carrier cost rate from RatingService
    const rateBreakdown = await ratingService.calculateRate({
      laneId: body.laneId,
      carrierId: body.carrierId,
      serviceLevel: body.serviceLevel || 'FTL',
      totalWeightKg: body.totalWeightKg,
    });

    if (rateBreakdown.totalCents === 0) {
      reply.code(400);
      return { data: null, error: 'No rate found for this lane/carrier combination. Add a rate to the lane carrier first.' };
    }

    // Build line items from rate breakdown (these are carrier costs)
    const markupPercent = body.markupPercent ?? 15;
    const costLineItems = rateBreakdown.details.map((item: any) => ({
      chargeType: item.chargeType,
      description: item.description,
      amountCents: item.amountCents,
      accessorialCode: item.accessorialCode,
      freightClass: item.freightClass,
      ratePerCwt: item.ratePerCwt,
      quantity: 1,
    }));

    // Calculate sell rate = cost + markup
    const totalCostCents = rateBreakdown.totalCents;
    const totalRevenueCents = Math.round(totalCostCents * (1 + markupPercent / 100));
    const marginCents = totalRevenueCents - totalCostCents;
    const marginPercent = totalRevenueCents > 0 ? (marginCents / totalRevenueCents) * 100 : 0;

    // Revenue line items are the sell-side version
    const revenueLineItems = costLineItems.map((item: any) => ({
      ...item,
      amountCents: Math.round(item.amountCents * (1 + markupPercent / 100)),
      description: item.description.replace(' (', ' - Customer ('),
    }));

    // Get lane and customer info for context
    const [lane, customer] = await Promise.all([
      server.prisma.lane.findUnique({
        where: { id: body.laneId },
        select: { id: true, name: true, originId: true, destinationId: true },
      }),
      server.prisma.customer.findUnique({
        where: { id: body.customerId },
        select: { id: true, name: true },
      }),
    ]);

    // Create the quote via command
    try {
      const result = await commandBus.dispatch<CreateQuotePayload, { id: string; quoteNumber: string }>({
        type: CREATE_QUOTE,
        orgId: (req as any).orgId ?? '',
        actorId: (req as any).user?.sub ?? null,
        payload: {
          customerId: body.customerId,
          originId: lane?.originId,
          destinationId: lane?.destinationId,
          serviceLevel: body.serviceLevel || 'FTL',
          lineItems: revenueLineItems,
          markupPercent,
          validDays: body.validDays ?? 30,
          notes: body.notes || `Quick quote from lane ${lane?.name || body.laneId} rates`,
        },
        metadata: { correlationId: crypto.randomUUID(), source: 'api' },
      });

      if (!result.success) {
        reply.code(400);
        return { data: null, error: result.error };
      }

      reply.code(201);
      return {
        data: {
          ...result.data,
          costBreakdown: {
            lineItems: costLineItems,
            totalCostCents,
          },
          revenueBreakdown: {
            lineItems: revenueLineItems,
            totalRevenueCents,
          },
          marginCents,
          marginPercent: Math.round(marginPercent * 100) / 100,
        },
        error: null,
      };
    } catch (err: any) {
      reply.code(400);
      return { data: null, error: err.message };
    }
  });

  // Credit check: validate customer credit status
  server.get('/api/v1/customers/:id/credit-status', {
    schema: {
      tags: ['Financial - Quotes'],
      summary: 'Check customer credit status against outstanding invoices',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      querystring: {
        type: 'object',
        properties: {
          additionalAmountCents: { type: 'integer' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const query = req.query as { additionalAmountCents?: string };
    const additionalCents = query.additionalAmountCents ? parseInt(query.additionalAmountCents) : 0;

    try {
      const creditService = new CreditCheckService(server.prisma);
      const result = await creditService.checkCredit(id, additionalCents);
      return { data: result, error: null };
    } catch (err: any) {
      reply.code(404);
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
