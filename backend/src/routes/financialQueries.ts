import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { container, TOKENS } from '../di/index.js';
import { IFinancialQueryRepository, ICreditNoteRepository } from '../repositories/FinancialQueryRepository.js';
import { ICommandBus } from '../commands/CommandBus.js';
import { RAISE_QUERY, RaiseQueryPayload } from '../commands/queries/RaiseQueryCommand.js';
import { RESOLVE_QUERY, ResolveQueryPayload } from '../commands/queries/ResolveQueryCommand.js';

export async function financialQueryRoutes(server: FastifyInstance) {
  const queryRepo = container.resolve<IFinancialQueryRepository>(TOKENS.IFinancialQueryRepository);
  const creditNoteRepo = container.resolve<ICreditNoteRepository>(TOKENS.ICreditNoteRepository);
  const commandBus = container.resolve<ICommandBus>(TOKENS.ICommandBus);

  // List financial queries
  server.get('/api/v1/financial-queries', {
    schema: {
      tags: ['Financial - Queries & Disputes'],
      summary: 'List financial queries with optional filters',
      querystring: {
        type: 'object',
        properties: {
          queryType: { type: 'string', enum: ['customer_dispute', 'carrier_dispute'] },
          status: { type: 'string', enum: ['raised', 'investigating', 'resolved_adjusted', 'resolved_upheld', 'closed'] },
          invoiceId: { type: 'string' },
          carrierInvoiceId: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest) => {
    const query = req.query as Record<string, string>;
    const queries = await queryRepo.findAll({
      queryType: query.queryType,
      status: query.status,
      invoiceId: query.invoiceId,
      carrierInvoiceId: query.carrierInvoiceId,
    });
    return { data: queries, error: null };
  });

  // Get query by ID
  server.get('/api/v1/financial-queries/:id', {
    schema: {
      tags: ['Financial - Queries & Disputes'],
      summary: 'Get financial query details',
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const query = await queryRepo.findById(id);
    if (!query) {
      reply.code(404);
      return { data: null, error: 'Financial query not found' };
    }
    return { data: query, error: null };
  });

  // Raise a new query
  server.post('/api/v1/financial-queries', {
    schema: {
      tags: ['Financial - Queries & Disputes'],
      summary: 'Raise a new financial query or dispute',
      body: {
        type: 'object',
        required: ['queryType', 'reason', 'description'],
        properties: {
          queryType: { type: 'string', enum: ['customer_dispute', 'carrier_dispute'] },
          invoiceId: { type: 'string' },
          carrierInvoiceId: { type: 'string' },
          shipmentId: { type: 'string' },
          reason: { type: 'string', enum: ['overcharge', 'service_failure', 'missing_pod', 'wrong_rate', 'damage_claim', 'missing_items', 'temperature_excursion'] },
          description: { type: 'string' },
          disputedAmountCents: { type: 'integer' },
          assigneeId: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      queryType: z.enum(['customer_dispute', 'carrier_dispute']),
      invoiceId: z.string().optional(),
      carrierInvoiceId: z.string().optional(),
      shipmentId: z.string().optional(),
      reason: z.string(),
      description: z.string().min(1),
      disputedAmountCents: z.number().int().optional(),
      assigneeId: z.string().optional(),
    }).parse((req as any).body);

    try {
      const result = await commandBus.dispatch<RaiseQueryPayload, { id: string; queryNumber: string }>({
        type: RAISE_QUERY,
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

  // Resolve a query
  server.post('/api/v1/financial-queries/:id/resolve', {
    schema: {
      tags: ['Financial - Queries & Disputes'],
      summary: 'Resolve a financial query with optional credit note generation',
      body: {
        type: 'object',
        required: ['resolution', 'resolutionNotes'],
        properties: {
          resolution: { type: 'string', enum: ['adjusted', 'upheld'] },
          resolutionNotes: { type: 'string' },
          adjustmentCents: { type: 'integer' },
          createCreditNote: { type: 'boolean' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      resolution: z.enum(['adjusted', 'upheld']),
      resolutionNotes: z.string().min(1),
      adjustmentCents: z.number().int().optional(),
      createCreditNote: z.boolean().optional(),
    }).parse((req as any).body);

    try {
      const result = await commandBus.dispatch<ResolveQueryPayload, { id: string; creditNoteId?: string }>({
        type: RESOLVE_QUERY,
        orgId: (req as any).orgId ?? '',
        actorId: (req as any).user?.sub ?? null,
        payload: { queryId: id, ...body },
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

  // List credit notes
  server.get('/api/v1/credit-notes', {
    schema: {
      tags: ['Financial - Credit Notes'],
      summary: 'List all credit and debit notes',
    },
  }, async (req: FastifyRequest) => {
    const orgId = (req as any).orgId ?? '';
    const notes = await creditNoteRepo.findAll(orgId);
    return { data: notes, error: null };
  });

  // Get credit note by ID
  server.get('/api/v1/credit-notes/:id', {
    schema: {
      tags: ['Financial - Credit Notes'],
      summary: 'Get credit note details',
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const note = await creditNoteRepo.findById(id);
    if (!note) {
      reply.code(404);
      return { data: null, error: 'Credit note not found' };
    }
    return { data: note, error: null };
  });
}
