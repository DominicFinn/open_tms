import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { container } from '../di/container.js';
import { TOKENS } from '../di/tokens.js';
import { ICommandBus } from '../commands/CommandBus.js';
import { CREATE_SHIPMENT } from '../commands/shipments/CreateShipmentCommand.js';
import { UPDATE_SHIPMENT } from '../commands/shipments/UpdateShipmentCommand.js';
import { ARCHIVE_SHIPMENT } from '../commands/shipments/ArchiveShipmentCommand.js';
import { TRANSITION_SHIPMENT_STATUS } from '../commands/shipments/TransitionShipmentStatusCommand.js';
import { SOFT_DELETE_SHIPMENT } from '../commands/shipments/SoftDeleteShipmentCommand.js';
import { UNARCHIVE_SHIPMENT } from '../commands/shipments/UnarchiveShipmentCommand.js';
import {
  SHIPMENT_LIFECYCLE,
  allowedTransitions,
  validateShipmentReadiness,
} from '@open-tms/shared';
import { registerOrgScope } from '../auth/orgScopeMiddleware.js';
import { requirePermission } from '../middleware/jwtAuth.js';

// Accepts YYYY-MM-DD (HTML date input), YYYY-MM-DDTHH:mm[:ss[.sss]][Z] (datetime-local), or full ISO.
// Normalizes to a full ISO string.
const flexibleDate = z.string().trim().min(1).transform((v, ctx) => {
  const candidate = /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T00:00:00Z` : v;
  const parsed = new Date(candidate);
  if (isNaN(parsed.getTime())) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid date or datetime' });
    return z.NEVER;
  }
  return parsed.toISOString();
});

export async function shipmentRoutes(server: FastifyInstance) {
  const commandBus = container.resolve<ICommandBus>(TOKENS.ICommandBus);

  await registerOrgScope(server);

  // Get all shipments (uses denormalized read model for performance).
  // We attach relation objects (customer/origin/destination/carrier/lane) so
  // the UI can use nested access (s.customer.name) the same way it would for
  // a live query, and enrich with shipmentTypeId from the live Shipment table.
  server.get('/api/v1/shipments', async (req: FastifyRequest, _reply: FastifyReply) => {
    const {
      status,
      customerId,
      carrierId,
      createdFrom,
      createdTo,
      updatedFrom,
      updatedTo,
      sortBy,
      sortOrder,
    } = (req.query as any) || {};
    // Multi-tenancy: every query is scoped to the requesting JWT's org.
    const orgId = req.orgId!;
    const where: any = { orgId };
    if (status) where.status = status;
    if (customerId) where.customerId = customerId;
    if (carrierId) where.carrierId = carrierId;

    const parseDate = (v: unknown): Date | null => {
      if (typeof v !== 'string' || v.length === 0) return null;
      const candidate = /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T00:00:00Z` : v;
      const d = new Date(candidate);
      return isNaN(d.getTime()) ? null : d;
    };

    const createdFromDate = parseDate(createdFrom);
    const createdToDate = parseDate(createdTo);
    if (createdFromDate || createdToDate) {
      where.createdAt = {
        ...(createdFromDate ? { gte: createdFromDate } : {}),
        ...(createdToDate ? { lte: createdToDate } : {}),
      };
    }

    const updatedFromDate = parseDate(updatedFrom);
    const updatedToDate = parseDate(updatedTo);
    if (updatedFromDate || updatedToDate) {
      where.updatedAt = {
        ...(updatedFromDate ? { gte: updatedFromDate } : {}),
        ...(updatedToDate ? { lte: updatedToDate } : {}),
      };
    }

    const allowedSortFields = new Set(['createdAt', 'updatedAt', 'pickupDate', 'deliveryDate']);
    const sortField = typeof sortBy === 'string' && allowedSortFields.has(sortBy) ? sortBy : 'createdAt';
    const sortDir = sortOrder === 'asc' ? 'asc' : 'desc';

    const rows = await server.prisma.shipmentReadModel.findMany({
      where,
      orderBy: { [sortField]: sortDir },
    });
    if (rows.length === 0) return { data: rows, error: null };

    const ids = rows.map(s => s.id);
    // Defense in depth: the readModel above already filtered by orgId, so
    // `ids` only contains rows in this tenant. The orgId on this lookup is
    // redundant given that — but keeping it makes the multi-tenancy story
    // obvious to reviewers (every prisma.shipment query has orgId).
    const typeLinks = await server.prisma.shipment.findMany({
      where: { id: { in: ids }, orgId },
      select: { id: true, shipmentTypeId: true },
    });
    const typeById = new Map(typeLinks.map(t => [t.id, t.shipmentTypeId]));

    // Reshape the read-model rows so the frontend can use nested relation
    // access (s.customer.name, s.origin.city, etc.) without a separate code
    // path for read-model vs live shape.
    const enriched = rows.map(s => ({
      ...s,
      shipmentTypeId: typeById.get(s.id) ?? null,
      customer: { id: s.customerId, name: s.customerName },
      origin: s.originName != null || s.originCity != null
        ? { name: s.originName, city: s.originCity, state: s.originState, lat: s.currentLat, lng: s.currentLng }
        : null,
      destination: s.destinationName != null || s.destinationCity != null
        ? { name: s.destinationName, city: s.destinationCity, state: s.destinationState }
        : null,
      carrier: s.carrierId ? { id: s.carrierId, name: s.carrierName } : null,
      lane: s.laneId ? { id: s.laneId, name: s.laneName } : null,
    }));
    return { data: enriched, error: null };
  });

  // Archived shipments (admin-only). Backs the Archives page. Archiving a
  // shipment deletes its ShipmentReadModel row (see ShipmentProjection), so
  // this reads the live table directly rather than the read model.
  server.get('/api/v1/shipments/archived', {
    preHandler: requirePermission('shipments:delete'),
    schema: {
      tags: ['Shipments'],
      summary: 'List archived shipments (admin)',
      description: 'Returns all archived shipments for the current org. Requires shipments:delete.',
    },
  }, async (req: FastifyRequest, _reply: FastifyReply) => {
    const orgId = req.orgId!;
    const shipments = await server.prisma.shipment.findMany({
      where: { orgId, archived: true, deletedAt: null },
      include: {
        customer: { select: { id: true, name: true } },
        origin: { select: { id: true, name: true, city: true, state: true } },
        destination: { select: { id: true, name: true, city: true, state: true } },
        carrier: { select: { id: true, name: true } },
      },
      orderBy: { archivedAt: 'desc' },
    });
    return { data: shipments, error: null };
  });

  // Create shipment
  server.post('/api/v1/shipments', async (req: FastifyRequest, reply: FastifyReply) => {
    const addressSchema = z.object({
      name: z.string().min(1),
      address1: z.string().min(1),
      address2: z.string().optional(),
      city: z.string().min(1),
      state: z.string().optional(),
      postalCode: z.string().optional(),
      country: z.string().min(1),
      lat: z.number().optional(),
      lng: z.number().optional(),
    });

    // Create always produces a draft. Customer, origin, and destination are the
    // minimum structural requirements; everything else (dates, windows, PRO, items,
    // reference) is optional and soft-warned client-side based on ShipmentType config.
    const schema = z.object({
      reference: z.string().optional(),
      customerId: z.string().uuid(),
      laneId: z.string().uuid().optional(),
      carrierId: z.string().uuid().optional(),
      originId: z.string().uuid().optional(),
      destinationId: z.string().uuid().optional(),
      originData: addressSchema.optional(),
      destinationData: addressSchema.optional(),
      pickupDate: flexibleDate.optional(),
      deliveryDate: flexibleDate.optional(),
      pickupWindowStart: flexibleDate.optional(),
      pickupWindowEnd: flexibleDate.optional(),
      deliveryWindowStart: flexibleDate.optional(),
      deliveryWindowEnd: flexibleDate.optional(),
      shipmentTypeId: z.string().uuid().optional(),
      proNumber: z.string().optional(),
      items: z.array(z.object({
        sku: z.string(),
        description: z.string().optional(),
        quantity: z.number().int().positive(),
        weightKg: z.number().nonnegative().optional(),
        volumeM3: z.number().nonnegative().optional()
      })).default([]),
      devices: z.array(z.object({
        name: z.string().min(1),
        externalId: z.string().min(1),
      })).optional()
    });
    // No route requirement at create — a draft may be saved with a partial or
    // absent route (lane / origin / destination). Completeness is enforced when
    // the shipment leaves draft, via the readiness gate.

    const body = schema.parse((req as any).body);
    const orgId = req.orgId!;

    const result = await commandBus.dispatch({
      type: CREATE_SHIPMENT,
      orgId,
      actorId: req.user?.sub ?? null,
      payload: { ...body, orgId },
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error };
    }

    // Fetch full shipment for response — orgId scope is redundant given
    // the row was just created in this tenant but enforces the invariant.
    const created = await server.prisma.shipment.findFirst({
      where: { id: (result.data as any).id, orgId },
      include: {
        customer: true,
        origin: true,
        destination: true,
        carrier: true,
        lane: body.laneId ? { include: { origin: true, destination: true } } : false,
        orderShipments: {
          include: {
            order: {
              include: {
                trackableUnits: { include: { lineItems: true }, orderBy: { sequenceNumber: 'asc' } },
                lineItems: true
              }
            }
          }
        }
      }
    });

    // Event publishing and queue integration handled by CreateShipmentCommand

    reply.code(201);
    return { data: created, error: null };
  });

  // Get shipment by ID
  server.get('/api/v1/shipments/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const orgId = req.orgId!;
    const shipment = await server.prisma.shipment.findFirst({
      where: { id, orgId, deletedAt: null },
      include: {
        customer: true,
        origin: true,
        destination: true,
        lane: {
          include: {
            origin: true,
            destination: true,
            stops: { include: { location: true }, orderBy: { order: 'asc' } },
            laneCarriers: { include: { carrier: true }, orderBy: { assigned: 'desc' } }
          }
        },
        carrier: true,
        loads: { include: { vehicle: true, driver: true } },
        events: { orderBy: { eventTime: 'desc' } },
        deviceAssignments: {
          where: { active: true },
          include: { device: { select: { id: true, name: true, externalId: true } } },
        },
        stops: {
          include: {
            location: true,
            orders: {
              select: {
                id: true, orderNumber: true, deliveryStatus: true, status: true,
                customer: { select: { name: true } }
              }
            }
          },
          orderBy: { sequenceNumber: 'asc' }
        },
        orderShipments: {
          include: {
            order: {
              select: {
                id: true, orderNumber: true, status: true, deliveryStatus: true,
                customer: { select: { name: true } }
              }
            }
          }
        }
      }
    });
    if (!shipment) {
      reply.code(404);
      return { data: null, error: 'Shipment not found' };
    }
    return { data: shipment, error: null };
  });

  // Get shipment events (read-only, platform-generated timeline).
  // Supports filtering by eventType and an eventTime range (fromDate/toDate).
  server.get('/api/v1/shipments/:id/events', {
    schema: {
      tags: ['Shipments'],
      summary: 'Shipment event timeline',
      description: 'Returns the read-only timeline of platform-generated events for a shipment, newest first. Filterable by event type and date range.',
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      querystring: {
        type: 'object',
        properties: {
          eventType: { type: 'string' },
          fromDate: { type: 'string' },
          toDate: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const { eventType, fromDate, toDate } = (req.query as any) || {};
    const orgId = req.orgId!;
    const shipment = await server.prisma.shipment.findFirst({ where: { id, orgId, deletedAt: null } });
    if (!shipment) {
      reply.code(404);
      return { data: null, error: 'Shipment not found' };
    }

    const parseDate = (v: unknown): Date | null => {
      if (typeof v !== 'string' || v.length === 0) return null;
      const candidate = /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T00:00:00Z` : v;
      const d = new Date(candidate);
      return isNaN(d.getTime()) ? null : d;
    };

    const where: any = { shipmentId: id };
    if (typeof eventType === 'string' && eventType.length > 0) where.eventType = eventType;
    const from = parseDate(fromDate);
    const to = parseDate(toDate);
    if (from || to) {
      where.eventTime = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
    }

    const events = await server.prisma.shipmentEvent.findMany({
      where,
      orderBy: { eventTime: 'desc' },
      take: 500,
    });
    return { data: events, error: null };
  });

  // Update shipment
  server.put('/api/v1/shipments/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      reference: z.string().min(1).optional(),
      status: z.string().optional(),
      pickupDate: flexibleDate.optional(),
      deliveryDate: flexibleDate.optional(),
      pickupWindowStart: flexibleDate.optional(),
      pickupWindowEnd: flexibleDate.optional(),
      deliveryWindowStart: flexibleDate.optional(),
      deliveryWindowEnd: flexibleDate.optional(),
      shipmentTypeId: z.string().uuid().nullable().optional(),
      customerId: z.string().uuid().optional(),
      laneId: z.string().uuid().optional(),
      carrierId: z.string().uuid().nullable().optional(),
      proNumber: z.string().nullable().optional(),
      originId: z.string().uuid().optional(),
      destinationId: z.string().uuid().optional(),
      items: z.array(z.object({
        sku: z.string(),
        description: z.string().optional(),
        quantity: z.number().int().positive(),
        weightKg: z.number().nonnegative().optional(),
        volumeM3: z.number().nonnegative().optional()
      })).optional(),
      devices: z.array(z.object({
        name: z.string().min(1),
        externalId: z.string().min(1),
      })).optional()
    }).parse((req as any).body);
    // No route requirement on edit — lane and origin/destination may coexist
    // (a lane resolves to origin/destination), and a draft may hold a partial
    // route. Completeness is enforced only at the ready transition.

    const orgId = req.orgId!;
    // Cross-tenant guard before we hit the command bus. If the row belongs
    // to a different tenant we 404 without ever invoking the command.
    const existing = await server.prisma.shipment.findFirst({
      where: { id, orgId, deletedAt: null },
      select: { id: true },
    });
    if (!existing) {
      reply.code(404);
      return { data: null, error: 'Shipment not found' };
    }

    const result = await commandBus.dispatch({
      type: UPDATE_SHIPMENT,
      orgId,
      actorId: req.user?.sub ?? null,
      payload: { id, data: body },
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(result.error?.includes('not found') ? 404 : 400);
      return { data: null, error: result.error };
    }

    const updated = await server.prisma.shipment.findFirst({
      where: { id, orgId, deletedAt: null },
      include: {
        customer: true, origin: true, destination: true,
        lane: body.laneId ? { include: { origin: true, destination: true } } : false
      }
    });
    // Event publishing handled by UpdateShipmentCommand

    return { data: updated, error: null };
  });

  // Delete (archive) shipment
  // Archive (recoverable). Any operational user with shipments:write may archive.
  server.delete('/api/v1/shipments/:id', {
    preHandler: requirePermission('shipments:write'),
    schema: {
      tags: ['Shipments'],
      summary: 'Archive shipment',
      description: 'Archives a shipment (recoverable). Removes it from active lists; the row is retained for audit.',
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const orgId = req.orgId!;

    const existing = await server.prisma.shipment.findFirst({
      where: { id, orgId, deletedAt: null },
      select: { id: true },
    });
    if (!existing) {
      reply.code(404);
      return { data: null, error: 'Shipment not found' };
    }

    const result = await commandBus.dispatch({
      type: ARCHIVE_SHIPMENT,
      orgId,
      actorId: req.user?.sub ?? null,
      payload: { id },
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(404);
      return { data: null, error: result.error };
    }

    return { data: { id, archived: true }, error: null };
  });

  // Soft delete (admin-only, shipments:delete). Hidden from every view; the row
  // is retained for audit with a deletedAt/deletedBy tombstone.
  server.post('/api/v1/shipments/:id/soft-delete', {
    preHandler: requirePermission('shipments:delete'),
    schema: {
      tags: ['Shipments'],
      summary: 'Soft delete shipment (admin)',
      description: 'Marks a shipment deleted (deletedAt/deletedBy). Removes it from all views; retained for audit. Requires shipments:delete.',
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const orgId = req.orgId!;

    const existing = await server.prisma.shipment.findFirst({
      where: { id, orgId, deletedAt: null },
      select: { id: true },
    });
    if (!existing) {
      reply.code(404);
      return { data: null, error: 'Shipment not found' };
    }

    const result = await commandBus.dispatch({
      type: SOFT_DELETE_SHIPMENT,
      orgId,
      actorId: req.user?.sub ?? null,
      payload: { id },
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error };
    }

    return { data: { id, deleted: true }, error: null };
  });

  // Unarchive (restore). Admin action (shipments:delete), mirroring archive's
  // privileged counterpart. Re-inserts the shipment into active lists.
  server.post('/api/v1/shipments/:id/unarchive', {
    preHandler: requirePermission('shipments:delete'),
    schema: {
      tags: ['Shipments'],
      summary: 'Unarchive shipment (admin)',
      description: 'Restores an archived shipment to active lists. Requires shipments:delete.',
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const orgId = req.orgId!;

    const existing = await server.prisma.shipment.findFirst({
      where: { id, orgId, deletedAt: null },
      select: { id: true },
    });
    if (!existing) {
      reply.code(404);
      return { data: null, error: 'Shipment not found' };
    }

    const result = await commandBus.dispatch({
      type: UNARCHIVE_SHIPMENT,
      orgId,
      actorId: req.user?.sub ?? null,
      payload: { id },
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error };
    }

    return { data: { id, archived: false }, error: null };
  });

  // Readiness + allowed transitions for the lifecycle control on the detail page.
  server.get('/api/v1/shipments/:id/readiness', {
    schema: {
      tags: ['Shipments'],
      summary: 'Shipment lifecycle readiness',
      description: 'Returns missing mandatory fields, validity, current status and the allowed next statuses.',
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const orgId = req.orgId!;
    const shipment = await server.prisma.shipment.findFirst({
      where: { id, orgId, deletedAt: null },
      include: { shipmentType: { select: { requiredFields: true } } },
    });
    if (!shipment) {
      reply.code(404);
      return { data: null, error: 'Shipment not found' };
    }
    const { missing, isValid } = validateShipmentReadiness(shipment as any, shipment.shipmentType);
    return {
      data: {
        status: shipment.status,
        missing,
        isValid,
        allowedTransitions: allowedTransitions(shipment.status),
      },
      error: null,
    };
  });

  // Manual, gated lifecycle transition. Audit of who/when is handled by the
  // SHIPMENT_STATUS_CHANGED event -> AuditHandler.
  server.post('/api/v1/shipments/:id/transition', {
    schema: {
      tags: ['Shipments'],
      summary: 'Transition shipment lifecycle status',
      description: 'Moves a shipment one step forward or back on draft -> ready -> in_progress -> complete. Enforces the readiness gate.',
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      body: {
        type: 'object',
        required: ['toStatus'],
        properties: { toStatus: { type: 'string', enum: [...SHIPMENT_LIFECYCLE] } },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const { toStatus } = z.object({
      toStatus: z.enum(SHIPMENT_LIFECYCLE as unknown as [string, ...string[]]),
    }).parse((req as any).body);

    const orgId = req.orgId!;
    const existing = await server.prisma.shipment.findFirst({
      where: { id, orgId, deletedAt: null },
      select: { id: true },
    });
    if (!existing) {
      reply.code(404);
      return { data: null, error: 'Shipment not found' };
    }

    const result = await commandBus.dispatch({
      type: TRANSITION_SHIPMENT_STATUS,
      orgId,
      actorId: req.user?.sub ?? null,
      payload: { id, toStatus },
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(result.error?.includes('not found') ? 404 : 400);
      return { data: null, error: result.error };
    }

    return { data: result.data, error: null };
  });

  // Bulk lifecycle transition from the list page. Each shipment is transitioned
  // independently; per-row results report which ones failed the gate.
  server.post('/api/v1/shipments/bulk-transition', {
    schema: {
      tags: ['Shipments'],
      summary: 'Bulk transition shipment lifecycle status',
      description: 'Transitions multiple shipments to the target status, returning per-shipment success/failure.',
      body: {
        type: 'object',
        required: ['ids', 'toStatus'],
        properties: {
          ids: { type: 'array', items: { type: 'string' } },
          toStatus: { type: 'string', enum: [...SHIPMENT_LIFECYCLE] },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { ids, toStatus } = z.object({
      ids: z.array(z.string().uuid()).min(1).max(500),
      toStatus: z.enum(SHIPMENT_LIFECYCLE as unknown as [string, ...string[]]),
    }).parse((req as any).body);

    const orgId = req.orgId!;
    const actorId = req.user?.sub ?? null;

    // Scope to this tenant up front; ids not in the tenant are reported as not found.
    const owned = await server.prisma.shipment.findMany({
      where: { id: { in: ids }, orgId, deletedAt: null },
      select: { id: true },
    });
    const ownedIds = new Set(owned.map(s => s.id));

    const results: Array<{ id: string; success: boolean; error: string | null }> = [];
    for (const id of ids) {
      if (!ownedIds.has(id)) {
        results.push({ id, success: false, error: 'Shipment not found' });
        continue;
      }
      const result = await commandBus.dispatch({
        type: TRANSITION_SHIPMENT_STATUS,
        orgId,
        actorId,
        payload: { id, toStatus },
        metadata: { correlationId: randomUUID(), source: 'api' },
      });
      results.push({ id, success: result.success, error: result.success ? null : (result.error ?? 'Unknown error') });
    }

    return { data: { results }, error: null };
  });

  // Bulk archive from the list page. Each shipment is archived independently;
  // per-row results report which ones failed (e.g. already archived/deleted).
  server.post('/api/v1/shipments/bulk-archive', {
    preHandler: requirePermission('shipments:write'),
    schema: {
      tags: ['Shipments'],
      summary: 'Bulk archive shipments',
      description: 'Archives multiple shipments (recoverable), returning per-shipment success/failure.',
      body: {
        type: 'object',
        required: ['ids'],
        properties: {
          ids: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { ids } = z.object({
      ids: z.array(z.string().uuid()).min(1).max(500),
    }).parse((req as any).body);

    const orgId = req.orgId!;
    const actorId = req.user?.sub ?? null;

    const owned = await server.prisma.shipment.findMany({
      where: { id: { in: ids }, orgId, deletedAt: null },
      select: { id: true },
    });
    const ownedIds = new Set(owned.map(s => s.id));

    const results: Array<{ id: string; success: boolean; error: string | null }> = [];
    for (const id of ids) {
      if (!ownedIds.has(id)) {
        results.push({ id, success: false, error: 'Shipment not found' });
        continue;
      }
      const result = await commandBus.dispatch({
        type: ARCHIVE_SHIPMENT,
        orgId,
        actorId,
        payload: { id },
        metadata: { correlationId: randomUUID(), source: 'api' },
      });
      results.push({ id, success: result.success, error: result.success ? null : (result.error ?? 'Unknown error') });
    }

    return { data: { results }, error: null };
  });

  // Bulk soft delete from the list page (admin-only, shipments:delete). Each
  // shipment is deleted independently; per-row results report failures.
  server.post('/api/v1/shipments/bulk-delete', {
    preHandler: requirePermission('shipments:delete'),
    schema: {
      tags: ['Shipments'],
      summary: 'Bulk soft delete shipments (admin)',
      description: 'Marks multiple shipments deleted (deletedAt/deletedBy), returning per-shipment success/failure. Requires shipments:delete.',
      body: {
        type: 'object',
        required: ['ids'],
        properties: {
          ids: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { ids } = z.object({
      ids: z.array(z.string().uuid()).min(1).max(500),
    }).parse((req as any).body);

    const orgId = req.orgId!;
    const actorId = req.user?.sub ?? null;

    const owned = await server.prisma.shipment.findMany({
      where: { id: { in: ids }, orgId, deletedAt: null },
      select: { id: true },
    });
    const ownedIds = new Set(owned.map(s => s.id));

    const results: Array<{ id: string; success: boolean; error: string | null }> = [];
    for (const id of ids) {
      if (!ownedIds.has(id)) {
        results.push({ id, success: false, error: 'Shipment not found' });
        continue;
      }
      const result = await commandBus.dispatch({
        type: SOFT_DELETE_SHIPMENT,
        orgId,
        actorId,
        payload: { id },
        metadata: { correlationId: randomUUID(), source: 'api' },
      });
      results.push({ id, success: result.success, error: result.success ? null : (result.error ?? 'Unknown error') });
    }

    return { data: { results }, error: null };
  });
}
