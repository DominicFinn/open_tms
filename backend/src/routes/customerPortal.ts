/**
 * Customer Portal API - self-service access for customers to view their
 * shipments, orders, documents, and invoices. All data scoped by customerId
 * from the JWT - no cross-customer access.
 */

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { container, TOKENS } from '../di/index.js';
import { ICustomerAuthService } from '../services/CustomerAuthService.js';
import { authenticateCustomerJWT } from '../middleware/jwtAuth.js';
import { ICommandBus } from '../commands/CommandBus.js';
import { CREATE_RMA } from '../commands/rma/CreateRmaCommand.js';
import { CREATE_ORDER } from '../commands/orders/CreateOrderCommand.js';
import { ARCHIVE_ORDER } from '../commands/orders/ArchiveOrderCommand.js';
import { ICSVImportService } from '../services/CSVImportService.js';
import {
  CREATE_TRACKABLE_UNIT,
  UPDATE_TRACKABLE_UNIT,
  DELETE_TRACKABLE_UNIT,
  GENERATE_TRACKABLE_UNIT_BARCODE,
  ADD_LINE_ITEM_TO_UNIT,
  MOVE_LINE_ITEM_BETWEEN_UNITS,
  MERGE_TRACKABLE_UNITS,
  SPLIT_TRACKABLE_UNIT,
} from '../commands/trackableUnits/index.js';
import {
  CREATE_LINE_ITEM,
  UPDATE_LINE_ITEM,
  DELETE_LINE_ITEM,
} from '../commands/lineItems/index.js';
import type { IBinaryStorageProvider } from '../storage/IBinaryStorageProvider.js';
import { attachOrgScopeFromCustomerUserHook } from '../auth/orgScopeMiddleware.js';

const RETURN_REASONS = ['damaged', 'wrong_item', 'not_as_described', 'no_longer_needed', 'defective', 'ordered_extra', 'other'] as const;
const DISPOSITIONS_SUGGEST = ['restock', 'refurb', 'scrap', 'recycle', 'donate', 'rtv', 'customer_keeps'] as const;

export async function customerPortalRoutes(server: FastifyInstance) {
  const authService = container.resolve<ICustomerAuthService>(TOKENS.ICustomerAuthService);
  const commandBus = container.resolve<ICommandBus>(TOKENS.ICommandBus);
  const binaryStorage = container.resolve<IBinaryStorageProvider>(TOKENS.IBinaryStorageProvider);
  const csvImportService = container.resolve<ICSVImportService>(TOKENS.ICSVImportService);

  // Multi-tenancy: every authed customer-portal route resolves req.orgId
  // by walking customerUser.customerId → Customer.orgId. The hook runs
  // after `authenticateCustomerJWT` (declared per-route in preHandler),
  // so req.customerUser is populated by the time it fires.
  server.addHook('preHandler', attachOrgScopeFromCustomerUserHook(server.prisma));

  // ── Public: Login ────────────────────────────────────────────────────

  server.post('/api/v1/customer-portal/login', {
    schema: {
      tags: ['Customer Portal'],
      summary: 'Customer portal login',
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      email: z.string().email(),
      password: z.string(),
    }).parse((req as any).body);

    try {
      const result = await authService.login(body.email, body.password);
      return { data: result, error: null };
    } catch (err: any) {
      reply.code(401);
      return { data: null, error: err.message };
    }
  });

  // ── Protected routes ─────────────────────────────────────────────────

  // Profile
  server.get('/api/v1/customer-portal/profile', {
    preHandler: [authenticateCustomerJWT],
    schema: { tags: ['Customer Portal'], summary: 'Get current customer user profile' },
  }, async (req: FastifyRequest) => {
    const user = req.customerUser!;
    return {
      data: {
        id: user.sub,
        email: user.email,
        customerId: user.customerId,
        customerName: user.customerName,
        role: user.role,
      },
      error: null,
    };
  });

  // Change password
  server.post('/api/v1/customer-portal/change-password', {
    preHandler: [authenticateCustomerJWT],
    schema: {
      tags: ['Customer Portal'],
      body: {
        type: 'object',
        required: ['currentPassword', 'newPassword'],
        properties: {
          currentPassword: { type: 'string' },
          newPassword: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = (req as any).body;
    try {
      await authService.changePassword(req.customerUser!.sub, body.currentPassword, body.newPassword);
      return { data: { success: true }, error: null };
    } catch (err: any) {
      reply.code(400);
      return { data: null, error: err.message };
    }
  });

  // Dashboard summary
  server.get('/api/v1/customer-portal/dashboard', {
    preHandler: [authenticateCustomerJWT],
    schema: { tags: ['Customer Portal'], summary: 'Customer dashboard summary stats' },
  }, async (req: FastifyRequest) => {
    const customerId = req.customerUser!.customerId;

    const customerShipmentIds = await server.prisma.shipment.findMany({
      where: { customerId }, select: { id: true },
    }).then(rows => rows.map(r => r.id));
    const customerOrderIds = await server.prisma.order.findMany({
      where: { customerId }, select: { id: true },
    }).then(rows => rows.map(r => r.id));

    const [activeShipments, recentDeliveries, openIssues, outstandingInvoices] = await Promise.all([
      server.prisma.shipmentReadModel.count({
        where: { customerId, status: { in: ['booked', 'in_transit', 'at_pickup', 'at_delivery'] } },
      }),
      server.prisma.shipmentReadModel.count({
        where: { customerId, status: 'delivered' },
      }),
      customerShipmentIds.length === 0 && customerOrderIds.length === 0
        ? Promise.resolve(0)
        : server.prisma.issueReadModel.count({
            where: {
              status: { in: ['open', 'in_progress'] },
              OR: [
                customerShipmentIds.length > 0
                  ? { sourceEntityType: 'shipment', sourceEntityId: { in: customerShipmentIds } }
                  : undefined,
                customerOrderIds.length > 0
                  ? { sourceEntityType: 'order', sourceEntityId: { in: customerOrderIds } }
                  : undefined,
              ].filter(Boolean) as any,
            },
          }),
      server.prisma.invoiceReadModel.aggregate({
        where: { customerId, status: { in: ['sent', 'partial_paid', 'overdue'] } },
        _sum: { balanceCents: true },
        _count: true,
      }),
    ]);

    // Recent shipments for activity feed
    const recentShipments = await server.prisma.shipmentReadModel.findMany({
      where: { customerId },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: {
        id: true, reference: true, status: true,
        originCity: true, originState: true,
        destinationCity: true, destinationState: true,
        carrierName: true, pickupDate: true, deliveryDate: true,
      },
    });

    return {
      data: {
        stats: {
          activeShipments,
          recentDeliveries,
          openIssues,
          outstandingInvoiceCount: outstandingInvoices._count,
          outstandingBalanceCents: outstandingInvoices._sum.balanceCents || 0,
        },
        recentShipments,
      },
      error: null,
    };
  });

  // Orders
  server.get('/api/v1/customer-portal/orders', {
    preHandler: [authenticateCustomerJWT],
    schema: {
      tags: ['Customer Portal'],
      querystring: {
        type: 'object',
        properties: {
          search: { type: 'string' },
          status: { type: 'string' },
          limit: { type: 'integer', default: 50 },
          offset: { type: 'integer', default: 0 },
        },
      },
    },
  }, async (req: FastifyRequest) => {
    const customerId = req.customerUser!.customerId;
    const query = req.query as { search?: string; status?: string; limit?: number; offset?: number };

    const where: any = { customerId };
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { orderNumber: { contains: query.search, mode: 'insensitive' } },
        { poNumber: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [orders, total] = await Promise.all([
      server.prisma.orderReadModel.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: query.limit || 50,
        skip: query.offset || 0,
      }),
      server.prisma.orderReadModel.count({ where }),
    ]);

    return { data: { orders, total }, error: null };
  });

  // Order detail
  server.get('/api/v1/customer-portal/orders/:id', {
    preHandler: [authenticateCustomerJWT],
    schema: { tags: ['Customer Portal'] },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const customerId = req.customerUser!.customerId;

    const order = await server.prisma.order.findFirst({
      where: { id, customerId },
      include: {
        origin: true,
        destination: true,
        lineItems: true,
        trackableUnits: { include: { packagingType: true }, orderBy: { sequenceNumber: 'asc' } },
      },
    });

    if (!order) { reply.code(404); return { data: null, error: 'Order not found' }; }
    return { data: order, error: null };
  });

  // Archive order (customer self-service)
  server.delete('/api/v1/customer-portal/orders/:id', {
    preHandler: [authenticateCustomerJWT],
    schema: {
      tags: ['Customer Portal'],
      summary: 'Archive a customer order',
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const customerId = req.customerUser!.customerId;

    const order = await server.prisma.order.findFirst({
      where: { id, customerId },
      select: { id: true, orgId: true, archived: true },
    });
    if (!order) { reply.code(404); return { data: null, error: 'Order not found' }; }
    if (order.archived) { reply.code(400); return { data: null, error: 'Order is already archived' }; }

    const result = await commandBus.dispatch({
      type: ARCHIVE_ORDER,
      orgId: order.orgId,
      actorId: req.customerUser!.sub,
      payload: { id },
      metadata: { correlationId: crypto.randomUUID(), source: 'customer-portal' },
    });

    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error };
    }
    return { data: { id }, error: null };
  });

  // ─── Handling Units (Phase 2: sophisticated shippers edit handling units after order create) ───
  //
  // Customer-portal mirrors of the admin trackable-unit endpoints. Each one
  // first verifies the order belongs to the authed customer, then dispatches
  // the same command as the admin path (so events, projection, and audit
  // are consistent across portal + admin).

  /** Walks `unitId` (or order id) back to the customer's order; returns the order or 404-style result. */
  async function ensureCustomerOwnsOrder(orderId: string, customerId: string): Promise<{ id: string; orgId: string } | null> {
    return server.prisma.order.findFirst({
      where: { id: orderId, customerId },
      select: { id: true, orgId: true },
    });
  }
  async function customerOwnsUnit(unitId: string, customerId: string): Promise<{ id: string; orgId: string } | null> {
    const unit = await server.prisma.trackableUnit.findUnique({
      where: { id: unitId },
      select: { order: { select: { id: true, orgId: true, customerId: true } } },
    });
    if (!unit?.order || unit.order.customerId !== customerId) return null;
    return { id: unit.order.id, orgId: unit.order.orgId };
  }

  server.post('/api/v1/customer-portal/orders/:id/trackable-units', {
    preHandler: [authenticateCustomerJWT],
    schema: { tags: ['Customer Portal - Handling Units'], summary: 'Add a handling unit to an order' },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = (req as any).body ?? {};
    const order = await ensureCustomerOwnsOrder(id, req.customerUser!.customerId);
    if (!order) { reply.code(404); return { data: null, error: 'Order not found' }; }

    const result = await commandBus.dispatch({
      type: CREATE_TRACKABLE_UNIT,
      orgId: order.orgId,
      actorId: req.customerUser!.sub,
      payload: {
        orderId: id,
        identifier: body.identifier,
        unitType: body.unitType ?? 'pallet',
        customTypeName: body.customTypeName,
        barcode: body.barcode,
        notes: body.notes,
        packagingTypeId: body.packagingTypeId ?? null,
        weight: body.weight,
        weightUnit: body.weightUnit,
        length: body.length,
        width: body.width,
        height: body.height,
        dimUnit: body.dimUnit,
        stackable: body.stackable,
      },
      metadata: { correlationId: crypto.randomUUID(), source: 'customer-portal' },
    });

    if (!result.success) { reply.code(400); return { data: null, error: result.error }; }
    reply.code(201);
    return { data: result.data, error: null };
  });

  server.put('/api/v1/customer-portal/trackable-units/:unitId', {
    preHandler: [authenticateCustomerJWT],
    schema: { tags: ['Customer Portal - Handling Units'], summary: 'Update a handling unit (identifier, notes, packaging, dims, weight, stackable)' },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { unitId } = req.params as { unitId: string };
    const order = await customerOwnsUnit(unitId, req.customerUser!.customerId);
    if (!order) { reply.code(404); return { data: null, error: 'Unit not found' }; }
    const body = (req as any).body ?? {};

    const result = await commandBus.dispatch({
      type: UPDATE_TRACKABLE_UNIT,
      orgId: order.orgId,
      actorId: req.customerUser!.sub,
      payload: { id: unitId, data: body },
      metadata: { correlationId: crypto.randomUUID(), source: 'customer-portal' },
    });

    if (!result.success) { reply.code(400); return { data: null, error: result.error }; }
    return { data: result.data, error: null };
  });

  server.delete('/api/v1/customer-portal/trackable-units/:unitId', {
    preHandler: [authenticateCustomerJWT],
    schema: { tags: ['Customer Portal - Handling Units'], summary: 'Delete a handling unit (cascade-deletes its line items)' },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { unitId } = req.params as { unitId: string };
    const order = await customerOwnsUnit(unitId, req.customerUser!.customerId);
    if (!order) { reply.code(404); return { data: null, error: 'Unit not found' }; }

    const result = await commandBus.dispatch({
      type: DELETE_TRACKABLE_UNIT,
      orgId: order.orgId,
      actorId: req.customerUser!.sub,
      payload: { id: unitId },
      metadata: { correlationId: crypto.randomUUID(), source: 'customer-portal' },
    });
    if (!result.success) { reply.code(400); return { data: null, error: result.error }; }
    return { data: { success: true }, error: null };
  });

  server.post('/api/v1/customer-portal/trackable-units/:unitId/line-items', {
    preHandler: [authenticateCustomerJWT],
    schema: { tags: ['Customer Portal - Handling Units'], summary: 'Add a new line item directly to a handling unit' },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { unitId } = req.params as { unitId: string };
    const order = await customerOwnsUnit(unitId, req.customerUser!.customerId);
    if (!order) { reply.code(404); return { data: null, error: 'Unit not found' }; }
    const body = (req as any).body ?? {};

    const result = await commandBus.dispatch({
      type: ADD_LINE_ITEM_TO_UNIT,
      orgId: order.orgId,
      actorId: req.customerUser!.sub,
      payload: { unitId, item: body },
      metadata: { correlationId: crypto.randomUUID(), source: 'customer-portal' },
    });
    if (!result.success) { reply.code(400); return { data: null, error: result.error }; }
    reply.code(201);
    return { data: result.data, error: null };
  });

  server.put('/api/v1/customer-portal/line-items/:itemId/move', {
    preHandler: [authenticateCustomerJWT],
    schema: { tags: ['Customer Portal - Handling Units'], summary: 'Move a line item to another handling unit (or detach with null)' },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { itemId } = req.params as { itemId: string };
    const body = (req as any).body ?? {};

    // Ownership: the line item must belong to a customer's order, AND the
    // optional target unit must belong to the SAME order (the command also
    // checks this, but failing here keeps the existence opaque rather than
    // surfacing "Cannot move line item across orders" with order ids).
    const lineItem = await server.prisma.orderLineItem.findUnique({
      where: { id: itemId },
      select: { orderId: true, order: { select: { id: true, orgId: true, customerId: true } } },
    });
    if (!lineItem?.order || lineItem.order.customerId !== req.customerUser!.customerId) {
      reply.code(404);
      return { data: null, error: 'Line item not found' };
    }
    const targetUnitId = body.targetUnitId ?? null;
    if (targetUnitId) {
      const targetUnit = await server.prisma.trackableUnit.findUnique({
        where: { id: targetUnitId }, select: { orderId: true },
      });
      if (!targetUnit || targetUnit.orderId !== lineItem.orderId) {
        reply.code(404); return { data: null, error: 'Target unit not found' };
      }
    }

    const result = await commandBus.dispatch({
      type: MOVE_LINE_ITEM_BETWEEN_UNITS,
      orgId: lineItem.order.orgId,
      actorId: req.customerUser!.sub,
      payload: { lineItemId: itemId, targetUnitId },
      metadata: { correlationId: crypto.randomUUID(), source: 'customer-portal' },
    });
    if (!result.success) { reply.code(400); return { data: null, error: result.error }; }
    return { data: result.data, error: null };
  });

  server.post('/api/v1/customer-portal/trackable-units/:unitId/generate-barcode', {
    preHandler: [authenticateCustomerJWT],
    schema: { tags: ['Customer Portal - Handling Units'], summary: 'Generate a barcode for a handling unit' },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { unitId } = req.params as { unitId: string };
    const order = await customerOwnsUnit(unitId, req.customerUser!.customerId);
    if (!order) { reply.code(404); return { data: null, error: 'Unit not found' }; }
    const result = await commandBus.dispatch({
      type: GENERATE_TRACKABLE_UNIT_BARCODE,
      orgId: order.orgId,
      actorId: req.customerUser!.sub,
      payload: { id: unitId },
      metadata: { correlationId: crypto.randomUUID(), source: 'customer-portal' },
    });
    if (!result.success) { reply.code(400); return { data: null, error: result.error }; }
    return { data: result.data, error: null };
  });

  /** True iff `unitId` exists and belongs to `orderId`. Cheap belongs-to check. */
  async function unitBelongsToCustomerOrder(unitId: string, orderId: string): Promise<boolean> {
    const u = await server.prisma.trackableUnit.findUnique({ where: { id: unitId }, select: { orderId: true } });
    return !!u && u.orderId === orderId;
  }
  async function lineItemBelongsToCustomerOrder(itemId: string, orderId: string): Promise<boolean> {
    const li = await server.prisma.orderLineItem.findUnique({ where: { id: itemId }, select: { orderId: true } });
    return !!li && li.orderId === orderId;
  }

  server.post('/api/v1/customer-portal/orders/:id/trackable-units/merge', {
    preHandler: [authenticateCustomerJWT],
    schema: { tags: ['Customer Portal - Handling Units'], summary: 'Merge two handling units (source -> target, source deleted)' },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = (req as any).body ?? {};
    const order = await ensureCustomerOwnsOrder(id, req.customerUser!.customerId);
    if (!order) { reply.code(404); return { data: null, error: 'Order not found' }; }
    // Body-supplied source/target unit ids must belong to this customer's
    // order. Without this a customer could merge units between other tenants'
    // orders by guessing UUIDs (the command bus would happily oblige).
    if (!body.sourceUnitId || !body.targetUnitId) {
      reply.code(400); return { data: null, error: 'sourceUnitId and targetUnitId are required' };
    }
    if (!(await unitBelongsToCustomerOrder(body.sourceUnitId, id))) {
      reply.code(404); return { data: null, error: 'Source unit not found' };
    }
    if (!(await unitBelongsToCustomerOrder(body.targetUnitId, id))) {
      reply.code(404); return { data: null, error: 'Target unit not found' };
    }
    const result = await commandBus.dispatch({
      type: MERGE_TRACKABLE_UNITS,
      orgId: order.orgId,
      actorId: req.customerUser!.sub,
      payload: { sourceUnitId: body.sourceUnitId, targetUnitId: body.targetUnitId },
      metadata: { correlationId: crypto.randomUUID(), source: 'customer-portal' },
    });
    if (!result.success) { reply.code(400); return { data: null, error: result.error }; }
    return { data: result.data, error: null };
  });

  server.post('/api/v1/customer-portal/trackable-units/:unitId/split', {
    preHandler: [authenticateCustomerJWT],
    schema: { tags: ['Customer Portal - Handling Units'], summary: 'Split a handling unit by moving specified line items to a new unit' },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { unitId } = req.params as { unitId: string };
    const body = (req as any).body ?? {};
    const order = await customerOwnsUnit(unitId, req.customerUser!.customerId);
    if (!order) { reply.code(404); return { data: null, error: 'Unit not found' }; }
    // Every line being peeled off must belong to the same order. The command
    // also checks they live on the source unit, but failing here gives a
    // clearer error and avoids triggering the command bus on bad input.
    const itemIds: string[] = body.itemIdsToMove ?? [];
    for (const itemId of itemIds) {
      if (!(await lineItemBelongsToCustomerOrder(itemId, order.id))) {
        reply.code(404); return { data: null, error: `Line item ${itemId} not found` };
      }
    }

    const result = await commandBus.dispatch({
      type: SPLIT_TRACKABLE_UNIT,
      orgId: order.orgId,
      actorId: req.customerUser!.sub,
      payload: { unitId, lineItemIds: itemIds, newIdentifier: body.newIdentifier },
      metadata: { correlationId: crypto.randomUUID(), source: 'customer-portal' },
    });
    if (!result.success) { reply.code(400); return { data: null, error: result.error }; }
    reply.code(201);
    return { data: result.data, error: null };
  });

  // ─── Line items (Phase 4: full CRUD over commands) ───
  //
  // Customer-portal mirrors of the admin line-item endpoints. Ownership is
  // verified by walking from the line item back to its order, then to the
  // customer.

  async function customerOwnsLineItem(itemId: string, customerId: string): Promise<{ id: string; orgId: string } | null> {
    const li = await server.prisma.orderLineItem.findUnique({
      where: { id: itemId },
      select: { order: { select: { id: true, orgId: true, customerId: true } } },
    });
    if (!li?.order || li.order.customerId !== customerId) return null;
    return { id: li.order.id, orgId: li.order.orgId };
  }

  server.post('/api/v1/customer-portal/orders/:id/line-items', {
    preHandler: [authenticateCustomerJWT],
    schema: { tags: ['Customer Portal - Line Items'], summary: 'Add a flat line item to one of your orders' },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = (req as any).body ?? {};
    const order = await ensureCustomerOwnsOrder(id, req.customerUser!.customerId);
    if (!order) { reply.code(404); return { data: null, error: 'Order not found' }; }
    // Optional trackableUnitId must belong to the same order.
    if (body.trackableUnitId && !(await unitBelongsToCustomerOrder(body.trackableUnitId, id))) {
      reply.code(404); return { data: null, error: 'Trackable unit not found' };
    }

    const result = await commandBus.dispatch({
      type: CREATE_LINE_ITEM,
      orgId: order.orgId,
      actorId: req.customerUser!.sub,
      payload: { orderId: id, trackableUnitId: body.trackableUnitId ?? null, item: body },
      metadata: { correlationId: crypto.randomUUID(), source: 'customer-portal' },
    });
    if (!result.success) { reply.code(400); return { data: null, error: result.error }; }
    reply.code(201);
    return { data: result.data, error: null };
  });

  server.put('/api/v1/customer-portal/line-items/:itemId', {
    preHandler: [authenticateCustomerJWT],
    schema: { tags: ['Customer Portal - Line Items'], summary: 'Update fields on a line item (sparse patch)' },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { itemId } = req.params as { itemId: string };
    const order = await customerOwnsLineItem(itemId, req.customerUser!.customerId);
    if (!order) { reply.code(404); return { data: null, error: 'Line item not found' }; }
    const body = (req as any).body ?? {};

    const result = await commandBus.dispatch({
      type: UPDATE_LINE_ITEM,
      orgId: order.orgId,
      actorId: req.customerUser!.sub,
      payload: { id: itemId, data: body },
      metadata: { correlationId: crypto.randomUUID(), source: 'customer-portal' },
    });
    if (!result.success) { reply.code(400); return { data: null, error: result.error }; }
    return { data: result.data, error: null };
  });

  server.delete('/api/v1/customer-portal/line-items/:itemId', {
    preHandler: [authenticateCustomerJWT],
    schema: { tags: ['Customer Portal - Line Items'], summary: 'Delete a line item' },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { itemId } = req.params as { itemId: string };
    const order = await customerOwnsLineItem(itemId, req.customerUser!.customerId);
    if (!order) { reply.code(404); return { data: null, error: 'Line item not found' }; }

    const result = await commandBus.dispatch({
      type: DELETE_LINE_ITEM,
      orgId: order.orgId,
      actorId: req.customerUser!.sub,
      payload: { id: itemId },
      metadata: { correlationId: crypto.randomUUID(), source: 'customer-portal' },
    });
    if (!result.success) { reply.code(400); return { data: null, error: result.error }; }
    return { data: { success: true }, error: null };
  });

  // ─── Bulk CSV upload (customer self-service) ───
  //
  // Customer-portal mirror of the admin CSV importer. Forces customerId on
  // every parsed order to the authenticated customer so they can't smuggle
  // orders onto someone else's account.

  server.get('/api/v1/customer-portal/orders/import/csv/template', {
    preHandler: [authenticateCustomerJWT],
    schema: {
      tags: ['Customer Portal - Bulk Import'],
      summary: 'Download a blank CSV template for bulk order upload',
      response: { 200: { type: 'string' } },
    },
  }, async (_req: FastifyRequest, reply: FastifyReply) => {
    const template = csvImportService.buildTemplate();
    return reply
      .header('Content-Type', 'text/csv')
      .header('Content-Disposition', 'attachment; filename="order-import-template.csv"')
      .send(template);
  });

  server.post('/api/v1/customer-portal/orders/import/csv', {
    preHandler: [authenticateCustomerJWT],
    schema: {
      tags: ['Customer Portal - Bulk Import'],
      summary: 'Bulk-upload orders from a CSV',
      description: 'Per-line validation against the active mode rules. customerId on every order is forced to the authenticated customer. Per-order rejection on failure; successful orders still go through.',
      body: {
        type: 'object',
        required: ['csvContent'],
        properties: { csvContent: { type: 'string' } },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const customerId = req.customerUser!.customerId;
    const orgId = req.orgId!;
    const ct = (req.headers['content-type'] ?? '').toString().toLowerCase();
    let csvContent: string | undefined;
    if (ct.includes('text/csv') || ct.includes('text/plain')) {
      csvContent = typeof req.body === 'string' ? req.body : undefined;
    } else {
      csvContent = (req.body as { csvContent?: string })?.csvContent;
    }
    if (!csvContent) {
      reply.code(400);
      return { data: null, error: 'csvContent is required' };
    }

    const result = await csvImportService.importOrders(csvContent, {
      orgId,
      forceCustomerId: customerId,
      actorId: req.customerUser!.sub,
      source: 'customer_portal_csv',
    });

    return { data: result, error: null };
  });

  // Packaging types catalogue (read-only, org-scoped to customer's tenant).
  // Used by the customer portal create-order form to drive the packaging
  // dropdown. Read-only — customers can't manage their org's catalogue.
  server.get('/api/v1/customer-portal/packaging-types', {
    preHandler: [authenticateCustomerJWT],
    schema: {
      tags: ['Customer Portal'],
      summary: 'List active packaging types in this customer org',
      querystring: {
        type: 'object',
        properties: {
          kind: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest) => {
    const orgId = req.orgId!;
    const q = req.query as { kind?: string };
    const where: any = { orgId, active: true };
    if (q.kind) where.kind = q.kind;
    const rows = await server.prisma.packagingType.findMany({
      where,
      orderBy: [{ kind: 'asc' }, { code: 'asc' }],
    });
    return { data: rows, error: null };
  });

  // Create order (customer self-service)
  server.post('/api/v1/customer-portal/orders', {
    preHandler: [authenticateCustomerJWT],
    schema: {
      tags: ['Customer Portal'],
      summary: 'Create an order (customer self-service)',
      body: {
        type: 'object',
        required: ['poNumber'],
        properties: {
          poNumber: { type: 'string' },
          serviceLevel: { type: 'string', enum: ['FTL', 'LTL'] },
          originName: { type: 'string' },
          originAddress1: { type: 'string' },
          originAddress2: { type: 'string' },
          originCity: { type: 'string' },
          originState: { type: 'string' },
          originPostalCode: { type: 'string' },
          originCountry: { type: 'string' },
          originLat: { type: 'number' },
          originLng: { type: 'number' },
          destinationName: { type: 'string' },
          destinationAddress1: { type: 'string' },
          destinationAddress2: { type: 'string' },
          destinationCity: { type: 'string' },
          destinationState: { type: 'string' },
          destinationPostalCode: { type: 'string' },
          destinationCountry: { type: 'string' },
          destinationLat: { type: 'number' },
          destinationLng: { type: 'number' },
          requestedPickupDate: { type: 'string', format: 'date' },
          requestedDeliveryDate: { type: 'string', format: 'date' },
          specialInstructions: { type: 'string' },
          lineItems: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                // Always-collected
                description: { type: 'string' },
                quantity: { type: 'integer', minimum: 1 },
                weightKg: { type: 'number' },
                weight: { type: 'number' },
                weightUnit: { type: 'string', enum: ['kg', 'lb', 'g'] },
                sku: { type: 'string' },
                unitOfMeasure: { type: 'string' },
                // Dimensions
                length: { type: 'number' },
                width: { type: 'number' },
                height: { type: 'number' },
                dimUnit: { type: 'string', enum: ['cm', 'in', 'mm'] },
                // Pricing / declared value
                unitPriceCents: { type: 'integer' },
                totalPriceCents: { type: 'integer' },
                priceCurrency: { type: 'string' },
                // LTL classification
                freightClass: { type: 'string' },
                nmfcCode: { type: 'string' },
                // Hazmat
                hazmat: { type: 'boolean' },
                unNumber: { type: 'string' },
                hazmatClass: { type: 'string' },
                packingGroup: { type: 'string' },
                properShippingName: { type: 'string' },
                // Customs
                hsCode: { type: 'string' },
                countryOfOrigin: { type: 'string' },
                // Temperature
                temperature: { type: 'string' },
                tempMinC: { type: 'number' },
                tempMaxC: { type: 'number' },
              },
            },
          },
          packingSummary: {
            type: 'object',
            properties: {
              packagingTypeId: { type: 'string', format: 'uuid', nullable: true },
              unitCount: { type: 'integer', minimum: 1 },
              stackable: { type: 'boolean' },
              notes: { type: 'string' },
            },
          },
          requiresHazmat: { type: 'boolean' },
          temperatureControl: { type: 'string', enum: ['ambient', 'refrigerated', 'frozen'] },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const customerId = req.customerUser!.customerId;
    const body = (req as any).body;

    // Multi-tenancy: req.orgId is populated by the customer-user hook
    // registered above (customerUser.customerId → Customer.orgId).
    const orgId = req.orgId!;

    // Generate order number. The count MUST be org-scoped: a global
    // `order.count()` here leaks total cross-tenant order volume into every
    // generated portal order number (a customer sees `ORD-CP-0142` and knows
    // there are ~142 portal orders platform-wide). Org-scoped count keeps
    // the sequence per-tenant and exposes nothing about other tenants.
    //
    // The `@@unique([orgId, orderNumber])` constraint catches the residual
    // race when two customers in the same org concurrently grab the same
    // number; the loser surfaces as a command-bus error and retries.
    const orderCount = await server.prisma.order.count({ where: { orgId } });
    const orderNumber = `ORD-CP-${String(orderCount + 1).padStart(4, '0')}`;

    const resolveLocation = async (
      prefix: 'origin' | 'destination',
    ): Promise<string | undefined> => {
      const city = body[`${prefix}City`];
      const address1 = body[`${prefix}Address1`];
      if (!city && !address1) return undefined;
      const state = body[`${prefix}State`];
      const postalCode = body[`${prefix}PostalCode`];
      const country = body[`${prefix}Country`] || 'US';
      const name = body[`${prefix}Name`] || [address1, city, state].filter(Boolean).join(', ');

      // Multi-tenancy: scope location matching + creation to the customer
      // portal's resolved org so portal A can't reuse portal B's locations.
      const existing = await server.prisma.location.findFirst({
        where: {
          orgId,
          address1: { equals: address1 || '', mode: 'insensitive' },
          city: { equals: city || '', mode: 'insensitive' },
          state: state ? { equals: state, mode: 'insensitive' } : undefined,
          postalCode: postalCode ? { equals: postalCode, mode: 'insensitive' } : undefined,
        },
      });
      if (existing) return existing.id;

      const created = await server.prisma.location.create({
        data: {
          orgId,
          name,
          address1: address1 || '',
          address2: body[`${prefix}Address2`] || undefined,
          city: city || '',
          state: state || undefined,
          postalCode: postalCode || undefined,
          country,
          lat: typeof body[`${prefix}Lat`] === 'number' ? body[`${prefix}Lat`] : undefined,
          lng: typeof body[`${prefix}Lng`] === 'number' ? body[`${prefix}Lng`] : undefined,
        },
      });
      return created.id;
    };

    const originId = await resolveLocation('origin');
    const destinationId = await resolveLocation('destination');

    const status = originId && destinationId ? 'validated' : 'pending';

    // Phase 1: server-side mode-rules re-validation. The portal form enforces
    // the same matrix client-side; we re-check here so a tampered request
    // can't bypass required fields (UN data on hazmat, dims on LTL, etc.).
    const mode = (body.serviceLevel === 'FTL' ? 'ftl' : 'ltl') as 'ftl' | 'ltl';
    const flags = {
      hazmat: body.requiresHazmat === true || (body.lineItems ?? []).some((l: any) => l.hazmat === true),
      international: false,
      temperatureControlled: body.temperatureControl === 'refrigerated' || body.temperatureControl === 'frozen',
    };
    const modeRulesSvc = container.resolve<import('../services/orderLineItem/ModeRulesService.js').IModeRulesService>(TOKENS.IModeRulesService);
    for (let i = 0; i < (body.lineItems ?? []).length; i++) {
      const li = body.lineItems[i];
      const normalised = {
        ...li,
        weight: li.weight ?? li.weightKg,
        unitOfMeasure: li.unitOfMeasure ?? 'each',
      };
      const check = modeRulesSvc.validate(mode, flags, normalised);
      if (!check.ok) {
        reply.code(400);
        return { data: null, error: `Line ${i + 1} is missing required fields for mode=${mode}: ${check.missing.join(', ')}` };
      }
    }

    const result = await commandBus.dispatch({
      type: CREATE_ORDER,
      orgId,
      actorId: req.customerUser!.sub,
      payload: {
        orderData: {
          orderNumber,
          poNumber: body.poNumber,
          customerId,
          originId,
          destinationId,
          requestedDeliveryDate: body.requestedDeliveryDate ? new Date(body.requestedDeliveryDate) : undefined,
          specialInstructions: body.specialInstructions,
          importSource: 'customer_portal',
          lineItems: body.lineItems?.map((item: any, i: number) => ({
            sku: item.sku || `ITEM-${i + 1}`,
            description: item.description || '',
            quantity: item.quantity || 1,
            weight: item.weight ?? item.weightKg,
            weightUnit: item.weightUnit ?? 'kg',
            length: item.length,
            width: item.width,
            height: item.height,
            dimUnit: item.dimUnit ?? 'cm',
            unitOfMeasure: item.unitOfMeasure ?? 'each',
            unitPriceCents: item.unitPriceCents,
            totalPriceCents: item.totalPriceCents,
            priceCurrency: item.priceCurrency,
            freightClass: item.freightClass,
            nmfcCode: item.nmfcCode,
            hazmat: item.hazmat ?? false,
            unNumber: item.unNumber,
            hazmatClass: item.hazmatClass,
            packingGroup: item.packingGroup,
            properShippingName: item.properShippingName,
            hsCode: item.hsCode,
            countryOfOrigin: item.countryOfOrigin,
            temperature: item.temperature,
            tempMinC: item.tempMinC,
            tempMaxC: item.tempMaxC,
          })),
          packingSummary: body.packingSummary,
        } as any,
        status,
      },
      metadata: { correlationId: crypto.randomUUID(), source: 'customer_portal' },
    });

    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error };
    }

    const order = await server.prisma.order.findUnique({
      where: { id: (result.data as any).id },
      include: { lineItems: true, origin: true, destination: true },
    });

    reply.code(201);
    return { data: order, error: null };
  });

  // Shipments
  server.get('/api/v1/customer-portal/shipments', {
    preHandler: [authenticateCustomerJWT],
    schema: {
      tags: ['Customer Portal'],
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          limit: { type: 'integer', default: 50 },
        },
      },
    },
  }, async (req: FastifyRequest) => {
    const customerId = req.customerUser!.customerId;
    const query = req.query as { status?: string; limit?: number };

    const where: any = { customerId };
    if (query.status === 'active') {
      where.status = { in: ['booked', 'in_transit', 'at_pickup', 'at_delivery'] };
    } else if (query.status) {
      where.status = query.status;
    }

    const shipments = await server.prisma.shipmentReadModel.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: query.limit || 50,
    });

    return { data: shipments, error: null };
  });

  // Shipment detail
  server.get('/api/v1/customer-portal/shipments/:id', {
    preHandler: [authenticateCustomerJWT],
    schema: { tags: ['Customer Portal'] },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const customerId = req.customerUser!.customerId;

    const shipment = await server.prisma.shipment.findFirst({
      where: { id, customerId },
      include: {
        origin: true,
        destination: true,
        carrier: { select: { name: true } },
        stops: { include: { location: true }, orderBy: { sequenceNumber: 'asc' } },
        events: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });

    if (!shipment) { reply.code(404); return { data: null, error: 'Shipment not found' }; }
    return { data: shipment, error: null };
  });

  // Documents
  server.get('/api/v1/customer-portal/documents', {
    preHandler: [authenticateCustomerJWT],
    schema: { tags: ['Customer Portal'] },
  }, async (req: FastifyRequest) => {
    const customerId = req.customerUser!.customerId;

    const documents = await server.prisma.generatedDocument.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, documentType: true, fileName: true,
        mimeType: true, fileSize: true, createdAt: true,
        shipmentId: true,
      },
      take: 100,
    });

    return { data: documents, error: null };
  });

  // Document download
  server.get('/api/v1/customer-portal/documents/:id/download', {
    preHandler: [authenticateCustomerJWT],
    schema: { tags: ['Customer Portal'] },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const customerId = req.customerUser!.customerId;

    const doc = await server.prisma.generatedDocument.findFirst({
      where: { id, customerId },
    });

    if (!doc) { reply.code(404); return { data: null, error: 'Document not found' }; }

    if (doc.fileContent) {
      reply.header('Content-Type', doc.mimeType);
      reply.header('Content-Disposition', `attachment; filename="${doc.fileName}"`);
      return reply.send(doc.fileContent);
    }

    reply.code(404);
    return { data: null, error: 'Document content not available' };
  });

  // Invoices
  server.get('/api/v1/customer-portal/invoices', {
    preHandler: [authenticateCustomerJWT],
    schema: {
      tags: ['Customer Portal'],
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest) => {
    const customerId = req.customerUser!.customerId;
    const query = req.query as { status?: string };

    const where: any = { customerId };
    if (query.status === 'outstanding') {
      where.status = { in: ['sent', 'partial_paid', 'overdue'] };
    } else if (query.status) {
      where.status = query.status;
    }

    const invoices = await server.prisma.invoiceReadModel.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    return { data: invoices, error: null };
  });

  // Invoice detail
  server.get('/api/v1/customer-portal/invoices/:id', {
    preHandler: [authenticateCustomerJWT],
    schema: { tags: ['Customer Portal'] },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const customerId = req.customerUser!.customerId;

    const invoice = await server.prisma.invoice.findFirst({
      where: { id, customerId },
      include: { lineItems: true, payments: true },
    });

    if (!invoice) { reply.code(404); return { data: null, error: 'Invoice not found' }; }
    return { data: invoice, error: null };
  });

  // Dispute an invoice
  server.post('/api/v1/customer-portal/invoices/:id/dispute', {
    preHandler: [authenticateCustomerJWT],
    schema: {
      tags: ['Customer Portal'],
      body: {
        type: 'object',
        required: ['reason'],
        properties: {
          reason: { type: 'string', minLength: 1 },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const customerId = req.customerUser!.customerId;
    const { reason } = (req as any).body;

    const invoice = await server.prisma.invoice.findFirst({
      where: { id, customerId },
      select: { id: true, invoiceNumber: true, customerId: true },
    });

    if (!invoice) { reply.code(404); return { data: null, error: 'Invoice not found' }; }

    const orgId = (await server.prisma.organization.findFirst({ select: { id: true } }))?.id || '';

    // Create a financial query (dispute)
    const queryCount = await server.prisma.financialQuery.count();
    const query = await server.prisma.financialQuery.create({
      data: {
        orgId,
        queryNumber: `QRY-${String(queryCount + 1).padStart(4, '0')}`,
        queryType: 'customer_dispute',
        status: 'raised',
        invoiceId: invoice.id,
        reason,
        description: `Customer dispute on invoice ${invoice.invoiceNumber}: ${reason}`,
      },
    });

    reply.code(201);
    return { data: { queryId: query.id, queryNumber: (query as any).queryNumber }, error: null };
  });

  // ── Issues ───────────────────────────────────────────────────────────
  //
  // Issues are scoped to the customer by walking the source entity:
  //   - sourceEntityType = 'shipment' → Shipment.customerId
  //   - sourceEntityType = 'order'    → Order.customerId
  // Anything else (carrier issues, ad-hoc issues with no source) is hidden
  // from the customer portal — there's no chain back to a single customer.

  async function customerScopedIssueIds(customerId: string): Promise<string[]> {
    const shipments = await server.prisma.shipment.findMany({
      where: { customerId },
      select: { id: true },
    });
    const orders = await server.prisma.order.findMany({
      where: { customerId },
      select: { id: true },
    });
    const shipmentIds = shipments.map(s => s.id);
    const orderIds = orders.map(o => o.id);

    if (shipmentIds.length === 0 && orderIds.length === 0) return [];

    const issues = await server.prisma.issueReadModel.findMany({
      where: {
        OR: [
          shipmentIds.length > 0
            ? { sourceEntityType: 'shipment', sourceEntityId: { in: shipmentIds } }
            : undefined,
          orderIds.length > 0
            ? { sourceEntityType: 'order', sourceEntityId: { in: orderIds } }
            : undefined,
        ].filter(Boolean) as any,
      },
      select: { id: true },
    });
    return issues.map(i => i.id);
  }

  server.get('/api/v1/customer-portal/issues', {
    preHandler: [authenticateCustomerJWT],
    schema: {
      tags: ['Customer Portal'],
      querystring: {
        type: 'object',
        properties: { status: { type: 'string' } },
      },
    },
  }, async (req: FastifyRequest) => {
    const customerId = req.customerUser!.customerId;
    const query = req.query as { status?: string };

    const ids = await customerScopedIssueIds(customerId);
    if (ids.length === 0) return { data: [], error: null };

    const where: any = { id: { in: ids } };
    if (query.status === 'open') {
      where.status = { in: ['open', 'in_progress'] };
    } else if (query.status) {
      where.status = query.status;
    }

    const issues = await server.prisma.issueReadModel.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
    return { data: issues, error: null };
  });

  server.get('/api/v1/customer-portal/issues/:id', {
    preHandler: [authenticateCustomerJWT],
    schema: { tags: ['Customer Portal'] },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const customerId = req.customerUser!.customerId;

    const ids = await customerScopedIssueIds(customerId);
    if (!ids.includes(id)) {
      reply.code(404);
      return { data: null, error: 'Issue not found' };
    }

    const issue = await server.prisma.issueReadModel.findUnique({ where: { id } });
    if (!issue) { reply.code(404); return { data: null, error: 'Issue not found' }; }
    return { data: issue, error: null };
  });

  server.get('/api/v1/customer-portal/issues/:id/comments', {
    preHandler: [authenticateCustomerJWT],
    schema: { tags: ['Customer Portal'] },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const customerId = req.customerUser!.customerId;

    const ids = await customerScopedIssueIds(customerId);
    if (!ids.includes(id)) {
      reply.code(404);
      return { data: null, error: 'Issue not found' };
    }

    // Only show comments either authored by the customer side, or explicitly
    // flagged visible by internal staff.
    const comments = await server.prisma.comment.findMany({
      where: {
        entityType: 'issue',
        entityId: id,
        deletedAt: null,
        OR: [
          { authorType: 'customer' },
          { visibleToCustomer: true },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });
    return { data: comments, error: null };
  });

  server.post('/api/v1/customer-portal/issues/:id/comments', {
    preHandler: [authenticateCustomerJWT],
    schema: {
      tags: ['Customer Portal'],
      body: {
        type: 'object',
        required: ['body'],
        properties: { body: { type: 'string' } },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const user = req.customerUser!;
    const { body } = z.object({ body: z.string().min(1) }).parse((req as any).body);

    const ids = await customerScopedIssueIds(user.customerId);
    if (!ids.includes(id)) {
      reply.code(404);
      return { data: null, error: 'Issue not found' };
    }

    const customer = await server.prisma.customer.findUnique({
      where: { id: user.customerId },
      select: { orgId: true, name: true },
    });
    if (!customer) {
      reply.code(404);
      return { data: null, error: 'Customer not found' };
    }

    const result = await commandBus.dispatch({
      type: 'comment.create',
      orgId: customer.orgId,
      actorId: user.sub,
      payload: {
        entityType: 'issue',
        entityId: id,
        body,
        authorId: user.sub,
        authorName: `${customer.name} (${user.email})`,
        authorType: 'customer',
      },
      metadata: { correlationId: crypto.randomUUID(), source: 'customer-portal' },
    });

    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error || 'Failed to add comment' };
    }
    reply.code(201);
    return { data: result.data, error: null };
  });

  // ── Returns / RMA ────────────────────────────────────────────────────

  // List returns
  server.get('/api/v1/customer-portal/rmas', {
    preHandler: [authenticateCustomerJWT],
    schema: {
      tags: ['Customer Portal'],
      summary: 'List your return authorizations',
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          limit: { type: 'integer', default: 50 },
          offset: { type: 'integer', default: 0 },
        },
      },
    },
  }, async (req: FastifyRequest) => {
    const customerId = req.customerUser!.customerId;
    const q = req.query as { status?: string; limit?: number; offset?: number };
    const where: any = { customerId };
    if (q.status) where.status = q.status;

    const [rmas, total] = await Promise.all([
      server.prisma.rma.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: q.limit || 50,
        skip: q.offset || 0,
        include: { _count: { select: { lines: true } } },
      }),
      server.prisma.rma.count({ where }),
    ]);
    return { data: { rmas, total }, error: null };
  });

  // Return detail
  server.get('/api/v1/customer-portal/rmas/:id', {
    preHandler: [authenticateCustomerJWT],
    schema: { tags: ['Customer Portal'], summary: 'Get your RMA detail' },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const customerId = req.customerUser!.customerId;
    const rma = await server.prisma.rma.findFirst({
      where: { id, customerId },
      include: { lines: true },
    });
    if (!rma) { reply.code(404); return { data: null, error: 'RMA not found' }; }
    return { data: rma, error: null };
  });

  // Create a return (self-service)
  server.post('/api/v1/customer-portal/rmas', {
    preHandler: [authenticateCustomerJWT],
    schema: {
      tags: ['Customer Portal'],
      summary: 'Request a return (self-service)',
      description: 'Creates an RMA in "requested" status for CSR review. Scoped to the authenticated customer.',
      body: {
        type: 'object',
        required: ['orderId', 'returnReason', 'lines'],
        properties: {
          orderId: { type: 'string', format: 'uuid' },
          returnReason: { type: 'string', enum: [...RETURN_REASONS] },
          customerNotes: { type: 'string' },
          lines: {
            type: 'array', minItems: 1,
            items: {
              type: 'object',
              required: ['orderLineItemId', 'sku', 'requestedQuantity'],
              properties: {
                orderLineItemId: { type: 'string' },
                sku: { type: 'string' },
                requestedQuantity: { type: 'integer', minimum: 1 },
                requestedDisposition: { type: 'string', enum: [...DISPOSITIONS_SUGGEST] },
              },
            },
          },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const user = req.customerUser!;
    const body = z.object({
      orderId: z.string().uuid(),
      returnReason: z.enum(RETURN_REASONS),
      customerNotes: z.string().optional(),
      lines: z.array(z.object({
        orderLineItemId: z.string(),
        sku: z.string(),
        requestedQuantity: z.number().int().min(1),
        requestedDisposition: z.enum(DISPOSITIONS_SUGGEST).optional(),
      })).min(1),
    }).parse((req as any).body);

    // Verify the order belongs to this customer
    const order = await server.prisma.order.findFirst({
      where: { id: body.orderId, customerId: user.customerId },
      select: { id: true },
    });
    if (!order) {
      reply.code(404);
      return { data: null, error: 'Order not found or does not belong to your account' };
    }

    // Multi-tenancy: orgId comes from the customer-user middleware.
    const result = await commandBus.dispatch({
      type: CREATE_RMA,
      orgId: req.orgId!,
      actorId: `customer-portal:${user.sub}`,
      payload: {
        customerId: user.customerId,
        orderId: body.orderId,
        returnReason: body.returnReason,
        customerNotes: body.customerNotes,
        initiatedVia: 'customer_portal',
        lines: body.lines,
        autoAuthorize: false,
      },
      metadata: { correlationId: crypto.randomUUID(), source: 'customer-portal' },
    });

    if (!result.success) { reply.code(400); return { data: null, error: result.error }; }
    reply.code(201);
    return { data: result.data, error: null };
  });

  // Download return label (if one has been generated)
  server.get('/api/v1/customer-portal/rmas/:id/return-label', {
    preHandler: [authenticateCustomerJWT],
    schema: { tags: ['Customer Portal'], summary: 'Download the return shipping label for your RMA' },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const customerId = req.customerUser!.customerId;
    const rma = await server.prisma.rma.findFirst({
      where: { id, customerId },
      select: { rmaNumber: true, returnLabelStorageKey: true, returnLabelFormat: true },
    });
    if (!rma) { reply.code(404); return { data: null, error: 'RMA not found' }; }
    if (!rma.returnLabelStorageKey) { reply.code(404); return { data: null, error: 'No return label available yet' }; }

    const content = await binaryStorage.retrieve(rma.returnLabelStorageKey);
    const format = rma.returnLabelFormat ?? 'pdf';
    const contentType = format === 'pdf' ? 'application/pdf' : format === 'png' ? 'image/png' : 'application/octet-stream';
    reply.header('Content-Type', contentType);
    reply.header('Content-Disposition', `attachment; filename="return-label-${rma.rmaNumber}.${format}"`);
    return reply.send(content);
  });

  // List returnable order line items for the customer (helper for the request form)
  server.get('/api/v1/customer-portal/rmas/eligible-orders', {
    preHandler: [authenticateCustomerJWT],
    schema: {
      tags: ['Customer Portal'],
      summary: 'List delivered orders eligible for return (with their line items)',
      querystring: {
        type: 'object',
        properties: { limit: { type: 'integer', default: 25 } },
      },
    },
  }, async (req: FastifyRequest) => {
    const customerId = req.customerUser!.customerId;
    const q = req.query as { limit?: number };
    const orders = await server.prisma.order.findMany({
      where: { customerId, status: { in: ['delivered', 'partially_delivered'] } },
      orderBy: { createdAt: 'desc' },
      take: q.limit || 25,
      include: { lineItems: true },
    });
    return { data: orders, error: null };
  });
}
