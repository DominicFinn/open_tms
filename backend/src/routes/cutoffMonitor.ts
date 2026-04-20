import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { container, TOKENS } from '../di/index.js';
import { ShipmentCutoffMonitorService } from '../services/cutoff/ShipmentCutoffMonitorService.js';
import type { PgBossEventBus } from '../events/PgBossEventBus.js';

export async function cutoffMonitorRoutes(server: FastifyInstance) {
  const prisma = container.resolve<PrismaClient>(TOKENS.PrismaClient);
  const eventBus = container.resolve<PgBossEventBus>(TOKENS.IEventBus);
  const service = new ShipmentCutoffMonitorService(prisma, eventBus);

  // ── CarrierCutoff CRUD ──────────────────────────────────────────────

  server.get('/api/v1/carriers/:carrierId/cutoffs', {
    schema: {
      tags: ['WMS - Cutoff Monitoring'],
      summary: 'List cutoff times for a carrier',
    },
  }, async (req: FastifyRequest) => {
    const { carrierId } = req.params as { carrierId: string };
    const cutoffs = await prisma.carrierCutoff.findMany({
      where: { carrierId },
      orderBy: [{ dayOfWeek: 'asc' }, { cutoffLocalTime: 'asc' }],
    });
    return { data: cutoffs, error: null };
  });

  server.post('/api/v1/carriers/:carrierId/cutoffs', {
    schema: {
      tags: ['WMS - Cutoff Monitoring'],
      summary: 'Create a carrier cutoff row',
      body: {
        type: 'object',
        required: ['dayOfWeek', 'cutoffLocalTime'],
        properties: {
          dayOfWeek: { type: 'integer', minimum: 0, maximum: 6 },
          cutoffLocalTime: { type: 'string', pattern: '^[0-2][0-9]:[0-5][0-9]$' },
          timezone: { type: 'string' },
          serviceLevel: { type: 'string' },
          locationId: { type: 'string', format: 'uuid' },
          notes: { type: 'string' },
          active: { type: 'boolean' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { carrierId } = req.params as { carrierId: string };
    const orgId = (req as any).orgId || (await prisma.organization.findFirst({ select: { id: true } }))?.id || 'default-org';
    const body = z.object({
      dayOfWeek: z.number().int().min(0).max(6),
      cutoffLocalTime: z.string().regex(/^[0-2][0-9]:[0-5][0-9]$/),
      timezone: z.string().optional(),
      serviceLevel: z.string().optional(),
      locationId: z.string().uuid().optional(),
      notes: z.string().optional(),
      active: z.boolean().optional(),
    }).parse((req as any).body);

    const carrier = await prisma.carrier.findUnique({ where: { id: carrierId }, select: { id: true } });
    if (!carrier) { reply.code(404); return { data: null, error: 'Carrier not found' }; }

    const created = await prisma.carrierCutoff.create({
      data: {
        carrierId,
        dayOfWeek: body.dayOfWeek,
        cutoffLocalTime: body.cutoffLocalTime,
        timezone: body.timezone ?? 'UTC',
        serviceLevel: body.serviceLevel ?? null,
        locationId: body.locationId ?? null,
        notes: body.notes ?? null,
        active: body.active ?? true,
        orgId,
      },
    });
    reply.code(201);
    return { data: created, error: null };
  });

  server.put('/api/v1/carrier-cutoffs/:id', {
    schema: { tags: ['WMS - Cutoff Monitoring'], summary: 'Update a carrier cutoff row' },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      dayOfWeek: z.number().int().min(0).max(6).optional(),
      cutoffLocalTime: z.string().regex(/^[0-2][0-9]:[0-5][0-9]$/).optional(),
      timezone: z.string().optional(),
      serviceLevel: z.string().nullable().optional(),
      locationId: z.string().uuid().nullable().optional(),
      notes: z.string().nullable().optional(),
      active: z.boolean().optional(),
    }).parse((req as any).body);

    const existing = await prisma.carrierCutoff.findUnique({ where: { id } });
    if (!existing) { reply.code(404); return { data: null, error: 'Cutoff not found' }; }
    const updated = await prisma.carrierCutoff.update({ where: { id }, data: body });
    return { data: updated, error: null };
  });

  server.delete('/api/v1/carrier-cutoffs/:id', {
    schema: { tags: ['WMS - Cutoff Monitoring'], summary: 'Delete a carrier cutoff row' },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const existing = await prisma.carrierCutoff.findUnique({ where: { id } });
    if (!existing) { reply.code(404); return { data: null, error: 'Cutoff not found' }; }
    await prisma.carrierCutoff.delete({ where: { id } });
    return { data: { success: true }, error: null };
  });

  // ── At-risk dashboard ───────────────────────────────────────────────

  server.get('/api/v1/cutoff-monitor/at-risk', {
    schema: {
      tags: ['WMS - Cutoff Monitoring'],
      summary: 'List shipments currently at cutoff risk (severity warning or critical)',
      querystring: {
        type: 'object',
        properties: { severity: { type: 'string', enum: ['warning', 'critical'] } },
      },
    },
  }, async (req: FastifyRequest) => {
    const q = req.query as { severity?: 'warning' | 'critical' };
    const where: any = { lastCutoffRiskSeverity: { not: null } };
    if (q.severity) where.lastCutoffRiskSeverity = q.severity;
    else where.lastCutoffRiskSeverity = { in: ['warning', 'critical'] };

    const shipments = await prisma.shipment.findMany({
      where,
      include: {
        carrier: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true } },
      },
      orderBy: [{ lastCutoffRiskAt: 'desc' }],
      take: 100,
    });
    return { data: shipments, error: null };
  });

  server.get('/api/v1/cutoff-monitor/evaluate/:shipmentId', {
    schema: {
      tags: ['WMS - Cutoff Monitoring'],
      summary: 'Manually evaluate a single shipment (does not fire notifications)',
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { shipmentId } = req.params as { shipmentId: string };
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: { orderShipments: { select: { orderId: true } } },
    });
    if (!shipment) { reply.code(404); return { data: null, error: 'Shipment not found' }; }

    const org = await prisma.organization.findFirst({ select: { id: true } });
    const result = await service.evaluateShipment(shipment as any, new Date(), org?.id ?? 'default-org');
    return { data: result, error: null };
  });

  server.post('/api/v1/cutoff-monitor/run', {
    schema: { tags: ['WMS - Cutoff Monitoring'], summary: 'Manually trigger a full cutoff scan' },
  }, async () => {
    const results = await service.runOnce();
    const atRisk = results.filter(r => r.severity);
    return {
      data: {
        evaluated: results.length,
        atRisk: atRisk.length,
        critical: atRisk.filter(r => r.severity === 'critical').length,
        warning: atRisk.filter(r => r.severity === 'warning').length,
        notified: results.filter(r => r.notified).length,
        results,
      },
      error: null,
    };
  });
}
