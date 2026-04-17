import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { container, TOKENS } from '../di/index.js';
import { ICommandBus } from '../commands/CommandBus.js';
import { CREATE_LOAD_PLAN } from '../commands/warehouse/CreateLoadPlanCommand.js';
import { COMPLETE_LOAD_PLAN } from '../commands/warehouse/CompleteLoadPlanCommand.js';
import { IDocumentGenerationService } from '../services/DocumentGenerationService.js';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

export async function loadPlanRoutes(server: FastifyInstance) {
  const commandBus = container.resolve<ICommandBus>(TOKENS.ICommandBus);
  const prisma = container.resolve<PrismaClient>(TOKENS.PrismaClient);

  // GET /api/v1/load-plans?locationId=xxx&status=xxx
  server.get('/api/v1/load-plans', {
    schema: {
      tags: ['WMS - Load Planning'],
      summary: 'List load plans',
      querystring: {
        type: 'object', required: ['locationId'],
        properties: {
          locationId: { type: 'string', format: 'uuid' },
          status: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest) => {
    const q = req.query as any;
    const where: any = { locationId: q.locationId };
    if (q.status) where.status = q.status;

    const plans = await prisma.loadPlan.findMany({
      where,
      include: { _count: { select: { lines: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return { data: plans, error: null };
  });

  // GET /api/v1/load-plans/:id
  server.get('/api/v1/load-plans/:id', {
    schema: { tags: ['WMS - Load Planning'], summary: 'Get load plan detail with lines' },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const plan = await prisma.loadPlan.findUnique({
      where: { id },
      include: {
        lines: {
          orderBy: { loadSequence: 'asc' },
        },
      },
    });
    if (!plan) { reply.code(404); return { data: null, error: 'Load plan not found' }; }
    return { data: plan, error: null };
  });

  // POST /api/v1/load-plans — create from staged assignments
  server.post('/api/v1/load-plans', {
    schema: {
      tags: ['WMS - Load Planning'],
      summary: 'Create a load plan from staged assignments',
      body: {
        type: 'object', required: ['locationId', 'stagingAssignmentIds'],
        properties: {
          locationId: { type: 'string', format: 'uuid' },
          shipmentId: { type: 'string', nullable: true },
          dockBinId: { type: 'string', format: 'uuid', nullable: true },
          carrierId: { type: 'string', nullable: true },
          trailerNumber: { type: 'string', nullable: true },
          stagingAssignmentIds: { type: 'array', items: { type: 'string', format: 'uuid' }, minItems: 1 },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      locationId: z.string().uuid(),
      shipmentId: z.string().nullable().optional(),
      dockBinId: z.string().uuid().nullable().optional(),
      carrierId: z.string().nullable().optional(),
      trailerNumber: z.string().nullable().optional(),
      stagingAssignmentIds: z.array(z.string().uuid()).min(1),
    }).parse((req as any).body);

    const orgId = (req as any).orgId || 'default-org';
    const actorId = (req as any).userId || 'system';

    const result = await commandBus.dispatch({
      type: CREATE_LOAD_PLAN, orgId, actorId, payload: body,
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) { reply.code(400); return { data: null, error: result.error }; }
    reply.code(201);
    return { data: result.data, error: null };
  });

  // POST /api/v1/load-plans/:id/complete — complete load plan, seal, generate BOL
  server.post('/api/v1/load-plans/:id/complete', {
    schema: {
      tags: ['WMS - Load Planning'],
      summary: 'Complete load plan: seal trailer, generate BOL',
      body: {
        type: 'object',
        properties: {
          sealNumber: { type: 'string', nullable: true },
          generateBol: { type: 'boolean', description: 'Auto-generate BOL (default: true)' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      sealNumber: z.string().nullable().optional(),
      generateBol: z.boolean().optional(),
    }).parse((req as any).body ?? {});

    const orgId = (req as any).orgId || 'default-org';
    const actorId = (req as any).userId || 'system';

    const result = await commandBus.dispatch({
      type: COMPLETE_LOAD_PLAN, orgId, actorId,
      payload: { loadPlanId: id, ...body },
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) { reply.code(400); return { data: null, error: result.error }; }

    // If BOL was requested and shipment exists, generate it synchronously
    const plan = await prisma.loadPlan.findUnique({ where: { id } });
    if ((body.generateBol ?? true) && plan?.shipmentId) {
      try {
        const docService = container.resolve<IDocumentGenerationService>(TOKENS.IDocumentGenerationService);
        const doc = await docService.generateBOL(plan.shipmentId, undefined, actorId);
        await prisma.loadPlan.update({ where: { id }, data: { bolDocumentId: doc.id } });
        return { data: { ...result.data, bolDocumentId: doc.id, bolFileName: doc.fileName }, error: null };
      } catch (err) {
        // BOL generation failure shouldn't fail the load completion
        server.log.warn(`BOL generation failed for load plan ${id}: ${(err as Error).message}`);
        return { data: { ...result.data, bolError: (err as Error).message }, error: null };
      }
    }

    return { data: result.data, error: null };
  });
}
