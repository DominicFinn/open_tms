import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { container, TOKENS } from '../di/index.js';
import { ICarrierInvoiceRepository } from '../repositories/CarrierInvoiceRepository.js';
import { ICommandBus } from '../commands/CommandBus.js';
import { RECEIVE_CARRIER_INVOICE, ReceiveCarrierInvoicePayload } from '../commands/carrierInvoices/ReceiveCarrierInvoiceCommand.js';
import { APPROVE_CARRIER_INVOICE, ApproveCarrierInvoicePayload } from '../commands/carrierInvoices/ApproveCarrierInvoiceCommand.js';
import { RECORD_CARRIER_PAYMENT, RecordCarrierPaymentPayload } from '../commands/carrierInvoices/RecordCarrierPaymentCommand.js';
import { CarrierPaymentBatchService } from '../services/CarrierPaymentBatchService.js';
import { guardWrites } from '../auth/guardWrites.js';

export async function carrierInvoiceRoutes(server: FastifyInstance) {
  const carrierInvoiceRepo = container.resolve<ICarrierInvoiceRepository>(TOKENS.ICarrierInvoiceRepository);
  const commandBus = container.resolve<ICommandBus>(TOKENS.ICommandBus);

  server.addHook('preHandler', guardWrites('carrier_invoices'));

  // List carrier invoices
  server.get('/api/v1/carrier-invoices', {
    schema: {
      tags: ['Financial - Carrier Invoices'],
      summary: 'List carrier invoices with optional filters',
      querystring: {
        type: 'object',
        properties: {
          carrierId: { type: 'string' },
          status: { type: 'string', enum: ['received', 'matched', 'discrepancy', 'approved', 'scheduled', 'paid', 'disputed'] },
          matchStatus: { type: 'string', enum: ['pending', 'matched', 'partial_match', 'mismatch'] },
        },
      },
    },
  }, async (req: FastifyRequest) => {
    const query = req.query as Record<string, string>;
    const invoices = await carrierInvoiceRepo.findAll({
      carrierId: query.carrierId,
      status: query.status,
      matchStatus: query.matchStatus,
    });
    return { data: invoices, error: null };
  });

  // Get carrier invoice by ID
  server.get('/api/v1/carrier-invoices/:id', {
    schema: {
      tags: ['Financial - Carrier Invoices'],
      summary: 'Get carrier invoice with line items and match results',
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const invoice = await carrierInvoiceRepo.findById(id);
    if (!invoice) {
      reply.code(404);
      return { data: null, error: 'Carrier invoice not found' };
    }
    return { data: invoice, error: null };
  });

  // Receive a carrier invoice (with auto three-way match)
  server.post('/api/v1/carrier-invoices', {
    schema: {
      tags: ['Financial - Carrier Invoices'],
      summary: 'Receive a carrier invoice with automatic three-way match against expected costs',
      body: {
        type: 'object',
        required: ['carrierId', 'invoiceNumber', 'totalCents', 'lineItems'],
        properties: {
          carrierId: { type: 'string' },
          invoiceNumber: { type: 'string' },
          totalCents: { type: 'integer' },
          currency: { type: 'string' },
          lineItems: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['chargeType', 'description', 'amountCents'],
              properties: {
                shipmentId: { type: 'string' },
                chargeType: { type: 'string' },
                description: { type: 'string' },
                amountCents: { type: 'integer' },
                freightClass: { type: 'string' },
                billedWeight: { type: 'number' },
              },
            },
          },
          notes: { type: 'string' },
          edi210Content: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      carrierId: z.string().min(1),
      invoiceNumber: z.string().min(1),
      totalCents: z.number().int().positive(),
      currency: z.string().optional(),
      lineItems: z.array(z.object({
        shipmentId: z.string().optional(),
        chargeType: z.string(),
        description: z.string(),
        amountCents: z.number().int(),
        freightClass: z.string().optional(),
        billedWeight: z.number().optional(),
      })).min(1),
      notes: z.string().optional(),
      edi210Content: z.string().optional(),
    }).parse((req as any).body);

    try {
      const result = await commandBus.dispatch<ReceiveCarrierInvoicePayload, { id: string; matchStatus: string; autoApproved: boolean }>({
        type: RECEIVE_CARRIER_INVOICE,
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

  // Approve carrier invoice
  server.post('/api/v1/carrier-invoices/:id/approve', {
    schema: {
      tags: ['Financial - Carrier Invoices'],
      summary: 'Approve a carrier invoice for payment',
      body: {
        type: 'object',
        properties: {
          approvedCents: { type: 'integer', description: 'Override approved amount if different from invoiced' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      approvedCents: z.number().int().positive().optional(),
    }).parse((req as any).body ?? {});

    try {
      const result = await commandBus.dispatch<ApproveCarrierInvoicePayload, { id: string }>({
        type: APPROVE_CARRIER_INVOICE,
        orgId: (req as any).orgId ?? '',
        actorId: (req as any).user?.sub ?? null,
        payload: { carrierInvoiceId: id, ...body },
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

  // Record payment to carrier
  server.post('/api/v1/carrier-invoices/:id/pay', {
    schema: {
      tags: ['Financial - Carrier Invoices'],
      summary: 'Record payment for a carrier invoice',
      body: {
        type: 'object',
        required: ['amountCents'],
        properties: {
          amountCents: { type: 'integer', minimum: 1 },
          paymentReference: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      amountCents: z.number().int().positive(),
      paymentReference: z.string().optional(),
    }).parse((req as any).body);

    try {
      const result = await commandBus.dispatch<RecordCarrierPaymentPayload, { id: string }>({
        type: RECORD_CARRIER_PAYMENT,
        orgId: (req as any).orgId ?? '',
        actorId: (req as any).user?.sub ?? null,
        payload: { carrierInvoiceId: id, ...body },
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

  // Request quick pay on a carrier invoice (broker feature)
  server.post('/api/v1/carrier-invoices/:id/quick-pay', {
    schema: {
      tags: ['Financial - Carrier Invoices'],
      summary: 'Request quick pay for a carrier invoice (accelerated payment with discount)',
      body: {
        type: 'object',
        required: ['discountPercent', 'daysToPayment'],
        properties: {
          discountPercent: { type: 'number', minimum: 0, maximum: 100 },
          daysToPayment: { type: 'integer', minimum: 1 },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      discountPercent: z.number().min(0).max(100),
      daysToPayment: z.number().int().min(1),
    }).parse((req as any).body);

    const invoice = await server.prisma.carrierInvoice.findUnique({ where: { id } });
    if (!invoice) { reply.code(404); return { data: null, error: 'Invoice not found' }; }

    const discountCents = Math.round(invoice.totalCents * body.discountPercent / 100);
    const quickPayDueDate = new Date();
    quickPayDueDate.setDate(quickPayDueDate.getDate() + body.daysToPayment);

    const updated = await server.prisma.carrierInvoice.update({
      where: { id },
      data: {
        quickPayRequested: true,
        quickPayDiscountPct: body.discountPercent,
        quickPayDiscountCents: discountCents,
        quickPayDueDate: quickPayDueDate,
      },
    });

    return { data: updated, error: null };
  });

  // ─── Payment Batching ──────────────────────────────────────────────────────

  const batchService = new CarrierPaymentBatchService(
    container.resolve(TOKENS.PrismaClient)
  );

  // Get pending payment batches (approved invoices grouped by carrier)
  server.get('/api/v1/carrier-invoices/payment-batches', {
    schema: {
      tags: ['Financial - Carrier Payment Batching'],
      summary: 'Get approved carrier invoices grouped by carrier for batch payment',
      querystring: {
        type: 'object',
        properties: {
          carrierId: { type: 'string' },
          dueBefore: { type: 'string', format: 'date', description: 'Only include invoices due on or before this date (YYYY-MM-DD)' },
        },
      },
    },
  }, async (req: FastifyRequest) => {
    const query = req.query as Record<string, string>;
    const batches = await batchService.getPendingBatches({
      carrierId: query.carrierId,
      dueBefore: query.dueBefore ? new Date(query.dueBefore) : undefined,
    });
    return { data: batches, error: null };
  });

  // Get scheduled payment summary
  server.get('/api/v1/carrier-invoices/payment-batches/scheduled', {
    schema: {
      tags: ['Financial - Carrier Payment Batching'],
      summary: 'Get summary of scheduled carrier payments by date',
    },
  }, async () => {
    const summary = await batchService.getScheduledSummary();
    return { data: summary, error: null };
  });

  // Schedule a batch of invoices for payment
  server.post('/api/v1/carrier-invoices/payment-batches/schedule', {
    schema: {
      tags: ['Financial - Carrier Payment Batching'],
      summary: 'Schedule approved carrier invoices for payment on a specific date',
      body: {
        type: 'object',
        required: ['scheduledPayDate'],
        properties: {
          carrierInvoiceIds: { type: 'array', items: { type: 'string' }, description: 'Specific invoice IDs to schedule (optional - if omitted, uses carrierId/dueBefore filters)' },
          carrierId: { type: 'string', description: 'Schedule all approved invoices for this carrier' },
          dueBefore: { type: 'string', format: 'date', description: 'Schedule all approved invoices due on or before this date' },
          scheduledPayDate: { type: 'string', format: 'date', description: 'Date to execute payment (YYYY-MM-DD)' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      carrierInvoiceIds: z.array(z.string()).optional(),
      carrierId: z.string().optional(),
      dueBefore: z.string().optional(),
      scheduledPayDate: z.string().min(1),
    }).parse((req as any).body);

    try {
      const result = await batchService.scheduleBatch({
        carrierInvoiceIds: body.carrierInvoiceIds,
        carrierId: body.carrierId,
        dueBefore: body.dueBefore ? new Date(body.dueBefore) : undefined,
        scheduledPayDate: new Date(body.scheduledPayDate),
      });
      return { data: result, error: null };
    } catch (err: any) {
      reply.code(400);
      return { data: null, error: err.message };
    }
  });

  // Execute scheduled payments now (manual trigger)
  server.post('/api/v1/carrier-invoices/payment-batches/execute', {
    schema: {
      tags: ['Financial - Carrier Payment Batching'],
      summary: 'Execute all scheduled carrier payments due on or before today (or specified date)',
      body: {
        type: 'object',
        properties: {
          payDate: { type: 'string', format: 'date', description: 'Execute payments scheduled on or before this date (default: today)' },
          paymentReference: { type: 'string', description: 'Payment reference to apply to all payments in this batch' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      payDate: z.string().optional(),
      paymentReference: z.string().optional(),
    }).parse((req as any).body ?? {});

    try {
      const result = await batchService.executeScheduledPayments({
        payDate: body.payDate ? new Date(body.payDate) : undefined,
        paymentReference: body.paymentReference,
      });
      return { data: result, error: null };
    } catch (err: any) {
      reply.code(400);
      return { data: null, error: err.message };
    }
  });
}
