import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { container, TOKENS } from '../di/index.js';
import { WAREHOUSE_SCOPE_QUERY, WAREHOUSE_SCOPE_ONE_OF, warehouseScopeFrom } from '../repositories/warehouseScope.js';
import { IReceivingRepository } from '../repositories/ReceivingRepository.js';
import { ICommandBus } from '../commands/CommandBus.js';
import { CREATE_RECEIVING_TASK } from '../commands/warehouse/CreateReceivingTaskCommand.js';
import { RECORD_RECEIVING_LINE } from '../commands/warehouse/RecordReceivingLineCommand.js';
import { COMPLETE_RECEIVING } from '../commands/warehouse/CompleteReceivingCommand.js';
import { CREATE_RECEIVING_APPOINTMENT } from '../commands/warehouse/CreateReceivingAppointmentCommand.js';
import { CHECK_IN_APPOINTMENT } from '../commands/warehouse/CheckInAppointmentCommand.js';
import { CANCEL_APPOINTMENT } from '../commands/warehouse/CancelAppointmentCommand.js';
import { INSPECT_RECEIVING_LINE } from '../commands/warehouse/InspectReceivingLineCommand.js';
import crypto from 'crypto';
import { registerWmsGuard } from '../auth/wmsGuard.js';

export async function receivingRoutes(server: FastifyInstance) {
  // WMS permission guard (#134): wms:read for reads, wms:write for mutations
  await registerWmsGuard(server);

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
        oneOf: WAREHOUSE_SCOPE_ONE_OF,
        properties: {
          ...WAREHOUSE_SCOPE_QUERY,
          status: { type: 'string', enum: ['pending', 'in_progress', 'inspection', 'completed', 'cancelled'] },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const q = req.query as { facilityId?: string; locationId?: string; status?: string };
    const tasks = await repo.findTasks(req.orgId!, warehouseScopeFrom(q), q.status);
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
    // A cross-tenant id misses rather than 403s, so existence stays opaque.
    const task = await repo.findTaskById(req.orgId!, id);
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
        required: ['facilityId', 'receivingType'],
        properties: {
          facilityId: { type: 'string', format: 'uuid' },
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
      facilityId: z.string().uuid(),
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

    const result = await commandBus.dispatch({
      type: CREATE_RECEIVING_TASK,
      orgId: req.orgId!,
      actorId: req.user?.sub ?? null,
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

    const result = await commandBus.dispatch({
      type: RECORD_RECEIVING_LINE,
      orgId: req.orgId!,
      actorId: req.user?.sub ?? null,
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

    const result = await commandBus.dispatch({
      type: INSPECT_RECEIVING_LINE,
      orgId: req.orgId!,
      actorId: req.user?.sub ?? null,
      payload: { lineId: id, inspectionStatus: body.inspectionStatus },
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) {
      const notFound = result.error?.includes('not found');
      return reply.code(notFound ? 404 : 400).send({ data: null, error: result.error });
    }

    return { data: result.data, error: null };
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
    const result = await commandBus.dispatch({
      type: COMPLETE_RECEIVING,
      orgId: req.orgId!,
      actorId: req.user?.sub ?? null,
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
        oneOf: WAREHOUSE_SCOPE_ONE_OF,
        properties: {
          ...WAREHOUSE_SCOPE_QUERY,
          date: { type: 'string', format: 'date' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const q = req.query as { facilityId?: string; locationId?: string; date?: string };
    const appointments = await repo.findAppointments(
      req.orgId!,
      warehouseScopeFrom(q),
      q.date ? new Date(q.date) : undefined
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
        required: ['facilityId', 'scheduledAt', 'scheduledEndAt'],
        properties: {
          facilityId: { type: 'string', format: 'uuid' },
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
      facilityId: z.string().uuid(),
      inboundShipmentId: z.string().nullable().optional(),
      dockBinId: z.string().uuid().nullable().optional(),
      scheduledAt: z.string(),
      scheduledEndAt: z.string(),
      carrierName: z.string().nullable().optional(),
      trailerNumber: z.string().nullable().optional(),
      sealNumber: z.string().nullable().optional(),
      asnReference: z.string().nullable().optional(),
    }).parse((req as any).body);


    const result = await commandBus.dispatch({
      type: CREATE_RECEIVING_APPOINTMENT,
      orgId: req.orgId!,
      actorId: req.user?.sub ?? null,
      payload: body,
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) {
      const notFound = result.error?.includes('not found');
      return reply.code(notFound ? 404 : 400).send({ data: null, error: result.error });
    }

    return reply.code(201).send({ data: result.data, error: null });
  });

  // POST /api/v1/receiving/appointments/:id/check-in — carrier arrived
  server.post('/api/v1/receiving/appointments/:id/check-in', {
    schema: {
      tags: ['WMS - Receiving'],
      summary: 'Mark an appointment as checked-in (carrier has arrived at the dock)',
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } },
      body: {
        type: 'object',
        properties: {
          dockBinId: { type: 'string', format: 'uuid', nullable: true, description: 'Assign a dock bin on check-in if not already set' },
          trailerNumber: { type: 'string', nullable: true },
          sealNumber: { type: 'string', nullable: true },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      dockBinId: z.string().uuid().nullable().optional(),
      trailerNumber: z.string().nullable().optional(),
      sealNumber: z.string().nullable().optional(),
    }).parse((req as any).body ?? {});

    const result = await commandBus.dispatch({
      type: CHECK_IN_APPOINTMENT,
      orgId: req.orgId!,
      actorId: req.user?.sub ?? null,
      payload: { appointmentId: id, ...body },
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) {
      if (result.error?.includes('not found')) {
        return reply.code(404).send({ data: null, error: result.error });
      }
      // Checking in a completed or cancelled appointment is a state conflict, not bad input.
      const conflict = result.error?.includes('Cannot check in');
      return reply.code(conflict ? 409 : 400).send({ data: null, error: result.error });
    }

    return { data: result.data, error: null };
  });

  // POST /api/v1/receiving/appointments/:id/cancel
  server.post('/api/v1/receiving/appointments/:id/cancel', {
    schema: {
      tags: ['WMS - Receiving'],
      summary: 'Cancel an appointment',
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    const result = await commandBus.dispatch({
      type: CANCEL_APPOINTMENT,
      orgId: req.orgId!,
      actorId: req.user?.sub ?? null,
      payload: { appointmentId: id },
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) {
      if (result.error?.includes('not found')) {
        return reply.code(404).send({ data: null, error: result.error });
      }
      const conflict = result.error?.includes('Cannot cancel');
      return reply.code(conflict ? 409 : 400).send({ data: null, error: result.error });
    }

    return { data: result.data, error: null };
  });
}
