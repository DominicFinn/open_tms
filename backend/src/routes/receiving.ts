import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { container, TOKENS } from '../di/index.js';
import { IReceivingRepository } from '../repositories/ReceivingRepository.js';
import { ICommandBus } from '../commands/CommandBus.js';
import { CREATE_RECEIVING_TASK } from '../commands/warehouse/CreateReceivingTaskCommand.js';
import { RECORD_RECEIVING_LINE } from '../commands/warehouse/RecordReceivingLineCommand.js';
import { COMPLETE_RECEIVING } from '../commands/warehouse/CompleteReceivingCommand.js';
import crypto from 'crypto';

export async function receivingRoutes(server: FastifyInstance) {
  const repo = container.resolve<IReceivingRepository>(TOKENS.IReceivingRepository);
  const commandBus = container.resolve<ICommandBus>(TOKENS.ICommandBus);

  // ═══════════════════════════════════════════════════════════
  // RECEIVING TASKS
  // ═══════════════════════════════════════════════════════════

  // GET /api/v1/receiving/tasks?locationId=xxx&status=xxx
  server.get('/api/v1/receiving/tasks', {
    schema: {
      tags: ['WMS - Receiving'],
      summary: 'List receiving tasks for a location',
      querystring: {
        type: 'object',
        required: ['locationId'],
        properties: {
          locationId: { type: 'string', format: 'uuid' },
          status: { type: 'string', enum: ['pending', 'in_progress', 'inspection', 'completed', 'cancelled'] },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { locationId, status } = req.query as { locationId: string; status?: string };
    const tasks = await repo.findTasksByLocation(locationId, status);
    const mapped = tasks.map(t => ({
      id: t.id,
      status: t.status,
      receivingType: t.receivingType,
      crossDock: t.crossDock,
      inboundShipmentId: t.inboundShipmentId,
      dockBinId: t.dockBinId,
      assignedToUserId: t.assignedToUserId,
      appointmentId: t.appointmentId,
      lineCount: t._count.lines,
      receivedLines: t.lines.filter(l => l.receivedQuantity > 0).length,
      totalReceived: t.lines.reduce((s, l) => s + l.receivedQuantity, 0),
      totalExpected: t.lines.reduce((s, l) => s + (l.expectedQuantity ?? 0), 0),
      createdAt: t.createdAt,
    }));
    return { data: mapped, error: null };
  });

  // GET /api/v1/receiving/tasks/:id
  server.get('/api/v1/receiving/tasks/:id', {
    schema: {
      tags: ['WMS - Receiving'],
      summary: 'Get receiving task detail with lines',
      params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const task = await repo.findTaskById(id);
    if (!task) {
      reply.code(404);
      return { data: null, error: 'Receiving task not found' };
    }
    return { data: task, error: null };
  });

  // POST /api/v1/receiving/tasks
  server.post('/api/v1/receiving/tasks', {
    schema: {
      tags: ['WMS - Receiving'],
      summary: 'Create a receiving task',
      body: {
        type: 'object',
        required: ['locationId', 'receivingType'],
        properties: {
          locationId: { type: 'string', format: 'uuid' },
          appointmentId: { type: 'string', format: 'uuid', nullable: true },
          inboundShipmentId: { type: 'string', nullable: true },
          dockBinId: { type: 'string', format: 'uuid', nullable: true },
          receivingType: { type: 'string', enum: ['asn', 'blind'] },
          crossDock: { type: 'boolean' },
          assignedToUserId: { type: 'string', nullable: true },
          expectedLines: {
            type: 'array',
            items: {
              type: 'object',
              required: ['sku', 'expectedQuantity'],
              properties: {
                sku: { type: 'string' },
                uomCode: { type: 'string' },
                expectedQuantity: { type: 'integer' },
                orderLineItemId: { type: 'string', nullable: true },
                lotNumber: { type: 'string', nullable: true },
                expiryDate: { type: 'string', nullable: true },
              },
            },
          },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      locationId: z.string().uuid(),
      appointmentId: z.string().uuid().nullable().optional(),
      inboundShipmentId: z.string().nullable().optional(),
      dockBinId: z.string().uuid().nullable().optional(),
      receivingType: z.enum(['asn', 'blind']),
      crossDock: z.boolean().optional(),
      assignedToUserId: z.string().nullable().optional(),
      expectedLines: z.array(z.object({
        sku: z.string().min(1),
        uomCode: z.string().optional(),
        expectedQuantity: z.number().int().min(1),
        orderLineItemId: z.string().nullable().optional(),
        lotNumber: z.string().nullable().optional(),
        expiryDate: z.string().nullable().optional(),
      })).optional(),
    }).parse((req as any).body);

    const orgId = (req as any).orgId || 'default-org';
    const actorId = (req as any).userId || 'system';

    const result = await commandBus.dispatch({
      type: CREATE_RECEIVING_TASK,
      orgId,
      actorId,
      payload: body,
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error };
    }

    reply.code(201);
    return { data: result.data, error: null };
  });

  // ═══════════════════════════════════════════════════════════
  // RECEIVING LINES
  // ═══════════════════════════════════════════════════════════

  // POST /api/v1/receiving/tasks/:id/lines — record a receiving line
  server.post('/api/v1/receiving/tasks/:id/lines', {
    schema: {
      tags: ['WMS - Receiving'],
      summary: 'Record a received item (update existing line or create new for blind)',
      body: {
        type: 'object',
        required: ['receivedQuantity'],
        properties: {
          lineId: { type: 'string', format: 'uuid', description: 'Existing line ID (ASN mode)' },
          sku: { type: 'string', description: 'Required for blind receiving' },
          uomCode: { type: 'string' },
          receivedQuantity: { type: 'integer', minimum: 0 },
          damagedQuantity: { type: 'integer', minimum: 0 },
          trackableUnitId: { type: 'string', format: 'uuid', nullable: true },
          lotNumber: { type: 'string', nullable: true },
          expiryDate: { type: 'string', nullable: true },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      lineId: z.string().uuid().optional(),
      sku: z.string().optional(),
      uomCode: z.string().optional(),
      receivedQuantity: z.number().int().min(0),
      damagedQuantity: z.number().int().min(0).optional(),
      trackableUnitId: z.string().uuid().nullable().optional(),
      lotNumber: z.string().nullable().optional(),
      expiryDate: z.string().nullable().optional(),
    }).parse((req as any).body);

    const orgId = (req as any).orgId || 'default-org';
    const actorId = (req as any).userId || 'system';

    const result = await commandBus.dispatch({
      type: RECORD_RECEIVING_LINE,
      orgId,
      actorId,
      payload: { taskId: id, ...body },
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error };
    }

    return { data: result.data, error: null };
  });

  // PUT /api/v1/receiving/lines/:id/inspect — update inspection status
  server.put('/api/v1/receiving/lines/:id/inspect', {
    schema: {
      tags: ['WMS - Receiving'],
      summary: 'Update inspection status for a receiving line',
      body: {
        type: 'object',
        required: ['inspectionStatus'],
        properties: {
          inspectionStatus: { type: 'string', enum: ['pass', 'fail', 'quarantine'] },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      inspectionStatus: z.enum(['pass', 'fail', 'quarantine']),
    }).parse((req as any).body);

    const line = await repo.updateLine(id, { inspectionStatus: body.inspectionStatus });
    return { data: line, error: null };
  });

  // ═══════════════════════════════════════════════════════════
  // TASK LIFECYCLE
  // ═══════════════════════════════════════════════════════════

  // POST /api/v1/receiving/tasks/:id/complete — complete receiving
  server.post('/api/v1/receiving/tasks/:id/complete', {
    schema: {
      tags: ['WMS - Receiving'],
      summary: 'Complete receiving task and generate putaway tasks',
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const orgId = (req as any).orgId || 'default-org';
    const actorId = (req as any).userId || 'system';

    const result = await commandBus.dispatch({
      type: COMPLETE_RECEIVING,
      orgId,
      actorId,
      payload: { taskId: id },
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error };
    }

    return { data: result.data, error: null };
  });

  // ═══════════════════════════════════════════════════════════
  // APPOINTMENTS
  // ═══════════════════════════════════════════════════════════

  // GET /api/v1/receiving/appointments?locationId=xxx&date=YYYY-MM-DD
  server.get('/api/v1/receiving/appointments', {
    schema: {
      tags: ['WMS - Receiving'],
      summary: 'List receiving appointments',
      querystring: {
        type: 'object',
        required: ['locationId'],
        properties: {
          locationId: { type: 'string', format: 'uuid' },
          date: { type: 'string', format: 'date' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { locationId, date } = req.query as { locationId: string; date?: string };
    const appointments = await repo.findAppointmentsByLocation(
      locationId,
      date ? new Date(date) : undefined
    );
    return { data: appointments, error: null };
  });

  // POST /api/v1/receiving/appointments
  server.post('/api/v1/receiving/appointments', {
    schema: {
      tags: ['WMS - Receiving'],
      summary: 'Schedule a receiving appointment',
      body: {
        type: 'object',
        required: ['locationId', 'scheduledAt', 'scheduledEndAt'],
        properties: {
          locationId: { type: 'string', format: 'uuid' },
          inboundShipmentId: { type: 'string', nullable: true },
          dockBinId: { type: 'string', format: 'uuid', nullable: true },
          scheduledAt: { type: 'string', format: 'date-time' },
          scheduledEndAt: { type: 'string', format: 'date-time' },
          carrierName: { type: 'string', nullable: true },
          trailerNumber: { type: 'string', nullable: true },
          sealNumber: { type: 'string', nullable: true },
          asnReference: { type: 'string', nullable: true },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      locationId: z.string().uuid(),
      inboundShipmentId: z.string().nullable().optional(),
      dockBinId: z.string().uuid().nullable().optional(),
      scheduledAt: z.string(),
      scheduledEndAt: z.string(),
      carrierName: z.string().nullable().optional(),
      trailerNumber: z.string().nullable().optional(),
      sealNumber: z.string().nullable().optional(),
      asnReference: z.string().nullable().optional(),
    }).parse((req as any).body);

    const orgId = (req as any).orgId || 'default-org';

    const appointment = await repo.createAppointment({
      ...body,
      scheduledAt: new Date(body.scheduledAt),
      scheduledEndAt: new Date(body.scheduledEndAt),
      orgId,
    });

    reply.code(201);
    return { data: appointment, error: null };
  });
}
