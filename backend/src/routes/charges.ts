import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { container, TOKENS } from '../di/index.js';
import { IChargeService } from '../services/ChargeService.js';
import { IChargeRepository } from '../repositories/ChargeRepository.js';
import { IRatingService } from '../services/RatingService.js';
import { ICommandBus } from '../commands/CommandBus.js';
import { CREATE_CHARGE, CreateChargePayload } from '../commands/charges/CreateChargeCommand.js';
import { APPROVE_CHARGE, ApproveChargePayload } from '../commands/charges/ApproveChargeCommand.js';
import { REWEIGH_ADJUSTMENT, ReweighAdjustmentPayload } from '../commands/charges/ReweighAdjustmentCommand.js';

export async function chargeRoutes(server: FastifyInstance) {
  const chargeService = container.resolve<IChargeService>(TOKENS.IChargeService);
  const chargeRepo = container.resolve<IChargeRepository>(TOKENS.IChargeRepository);
  const ratingService = container.resolve<IRatingService>(TOKENS.IRatingService);
  const commandBus = container.resolve<ICommandBus>(TOKENS.ICommandBus);

  // List charges (with filters)
  server.get('/api/v1/charges', {
    schema: {
      tags: ['Financial - Charges'],
      summary: 'List charges with optional filters',
      querystring: {
        type: 'object',
        properties: {
          shipmentId: { type: 'string' },
          orderId: { type: 'string' },
          chargeCategory: { type: 'string', enum: ['revenue', 'cost'] },
          chargeType: { type: 'string' },
          status: { type: 'string', enum: ['pending', 'approved', 'invoiced', 'disputed', 'written_off'] },
        },
      },
    },
  }, async (req: FastifyRequest) => {
    const query = req.query as Record<string, string>;
    const charges = await chargeService.getCharges({
      shipmentId: query.shipmentId,
      orderId: query.orderId,
      chargeCategory: query.chargeCategory,
      chargeType: query.chargeType,
      status: query.status,
    });
    return { data: charges, error: null };
  });

  // Get a single charge
  server.get('/api/v1/charges/:id', {
    schema: {
      tags: ['Financial - Charges'],
      summary: 'Get charge by ID',
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const charge = await chargeRepo.findById(id);
    if (!charge) {
      reply.code(404);
      return { data: null, error: 'Charge not found' };
    }
    return { data: charge, error: null };
  });

  // Create a charge (via CQRS command)
  server.post('/api/v1/charges', {
    schema: {
      tags: ['Financial - Charges'],
      summary: 'Create a new charge on a shipment or order',
      body: {
        type: 'object',
        required: ['chargeType', 'chargeCategory', 'description', 'amountCents'],
        properties: {
          shipmentId: { type: 'string' },
          orderId: { type: 'string' },
          chargeType: {
            type: 'string',
            enum: ['linehaul', 'fuel_surcharge', 'accessorial', 'discount', 'adjustment', 'claim_deduction'],
          },
          chargeCategory: { type: 'string', enum: ['revenue', 'cost'] },
          description: { type: 'string' },
          amountCents: { type: 'integer' },
          currency: { type: 'string' },
          source: { type: 'string' },
          sourceId: { type: 'string' },
          accessorialCode: { type: 'string' },
          freightClass: { type: 'string' },
          nmfcCode: { type: 'string' },
          ratedWeight: { type: 'number' },
          ratePerCwt: { type: 'integer' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      shipmentId: z.string().optional(),
      orderId: z.string().optional(),
      chargeType: z.enum(['linehaul', 'fuel_surcharge', 'accessorial', 'discount', 'adjustment', 'claim_deduction']),
      chargeCategory: z.enum(['revenue', 'cost']),
      description: z.string().min(1),
      amountCents: z.number().int(),
      currency: z.string().optional(),
      source: z.string().optional(),
      sourceId: z.string().optional(),
      accessorialCode: z.string().optional(),
      freightClass: z.string().optional(),
      nmfcCode: z.string().optional(),
      ratedWeight: z.number().optional(),
      ratePerCwt: z.number().int().optional(),
    }).refine(data => data.shipmentId || data.orderId, {
      message: 'Either shipmentId or orderId is required',
    }).parse((req as any).body);

    try {
      const result = await commandBus.dispatch<CreateChargePayload, { id: string }>({
        type: CREATE_CHARGE,
        orgId: (req as any).orgId ?? '',
        actorId: (req as any).user?.sub ?? null,
        payload: body,
        metadata: {
          correlationId: crypto.randomUUID(),
          source: 'api',
        },
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

  // Approve a charge
  server.post('/api/v1/charges/:id/approve', {
    schema: {
      tags: ['Financial - Charges'],
      summary: 'Approve a pending charge',
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    try {
      const result = await commandBus.dispatch<ApproveChargePayload, { id: string }>({
        type: APPROVE_CHARGE,
        orgId: (req as any).orgId ?? '',
        actorId: (req as any).user?.sub ?? null,
        payload: { chargeId: id },
        metadata: {
          correlationId: crypto.randomUUID(),
          source: 'api',
        },
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

  // Delete a charge (only pending charges)
  server.delete('/api/v1/charges/:id', {
    schema: {
      tags: ['Financial - Charges'],
      summary: 'Delete a pending charge',
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const charge = await chargeRepo.findById(id);
    if (!charge) {
      reply.code(404);
      return { data: null, error: 'Charge not found' };
    }
    if (charge.status !== 'pending') {
      reply.code(400);
      return { data: null, error: `Cannot delete charge in status "${charge.status}"` };
    }

    await chargeRepo.delete(id);

    // Recalculate summary
    if (charge.shipmentId) {
      await chargeService.recalculateShipmentSummary(charge.shipmentId);
    }

    return { data: { deleted: true }, error: null };
  });

  // Get shipment financial summary
  server.get('/api/v1/shipments/:id/financials', {
    schema: {
      tags: ['Financial - Charges'],
      summary: 'Get financial summary for a shipment (charges, expected vs actual costs/revenue)',
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    try {
      const financials = await chargeService.getShipmentFinancials(id);
      return { data: financials, error: null };
    } catch (err: any) {
      reply.code(400);
      return { data: null, error: err.message };
    }
  });

  // Calculate rate for a lane/carrier
  server.post('/api/v1/rates/calculate', {
    schema: {
      tags: ['Financial - Rating'],
      summary: 'Calculate a rate breakdown for a lane/carrier combination',
      body: {
        type: 'object',
        properties: {
          laneId: { type: 'string' },
          carrierId: { type: 'string' },
          serviceLevel: { type: 'string', enum: ['FTL', 'LTL'] },
          totalWeightKg: { type: 'number' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      laneId: z.string().optional(),
      carrierId: z.string().optional(),
      serviceLevel: z.enum(['FTL', 'LTL']).default('FTL'),
      totalWeightKg: z.number().optional(),
    }).parse((req as any).body);

    try {
      const breakdown = await ratingService.calculateRate(body);
      return { data: breakdown, error: null };
    } catch (err: any) {
      reply.code(400);
      return { data: null, error: err.message };
    }
  });

  // Re-weigh / re-class adjustment
  server.post('/api/v1/shipments/:id/reweigh-adjustment', {
    schema: {
      tags: ['Financial - Charges'],
      summary: 'Record a re-weigh or re-class adjustment from the carrier',
      body: {
        type: 'object',
        required: ['declaredWeightLbs', 'actualWeightLbs', 'originalChargeCents', 'adjustedChargeCents'],
        properties: {
          declaredWeightLbs: { type: 'number' },
          actualWeightLbs: { type: 'number' },
          declaredClass: { type: 'string' },
          actualClass: { type: 'string' },
          originalChargeCents: { type: 'integer' },
          adjustedChargeCents: { type: 'integer' },
          carrierId: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      declaredWeightLbs: z.number().positive(),
      actualWeightLbs: z.number().positive(),
      declaredClass: z.string().optional(),
      actualClass: z.string().optional(),
      originalChargeCents: z.number().int(),
      adjustedChargeCents: z.number().int(),
      carrierId: z.string().optional(),
    }).parse((req as any).body);

    try {
      const result = await commandBus.dispatch<ReweighAdjustmentPayload, { costChargeId: string; revenueChargeId: string }>({
        type: REWEIGH_ADJUSTMENT,
        orgId: (req as any).orgId ?? '',
        actorId: (req as any).user?.sub ?? null,
        payload: { shipmentId: id, ...body },
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
}
