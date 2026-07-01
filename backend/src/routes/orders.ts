import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { IOrdersRepository } from '../repositories/OrdersRepository.js';
import { ILocationsRepository } from '../repositories/LocationsRepository.js';
import { IShipmentAssignmentService } from '../services/ShipmentAssignmentService.js';
import { ICSVImportService } from '../services/CSVImportService.js';
import { IOrderDeliveryService } from '../services/OrderDeliveryService.js';
import { IOrderConversionService } from '../services/OrderConversionService.js';
import { IOrganizationRepository } from '../repositories/OrganizationRepository.js';
import { ILocationResolutionService } from '../services/LocationResolutionService.js';
import { container, TOKENS } from '../di/index.js';
import { ICommandBus } from '../commands/CommandBus.js';
import { CREATE_ORDER } from '../commands/orders/CreateOrderCommand.js';
import { UPDATE_ORDER } from '../commands/orders/UpdateOrderCommand.js';
import { ARCHIVE_ORDER } from '../commands/orders/ArchiveOrderCommand.js';
import { SOFT_DELETE_ORDER } from '../commands/orders/SoftDeleteOrderCommand.js';
import { UNARCHIVE_ORDER } from '../commands/orders/UnarchiveOrderCommand.js';
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
import { registerOrgScope } from '../auth/orgScopeMiddleware.js';
import { requirePermission } from '../middleware/jwtAuth.js';

// Validation schemas (exported for reuse by customerApi.ts)
export const lineItemSchema = z.object({
  sku: z.string().min(1),
  description: z.string().optional(),
  quantity: z.number().int().positive(),
  weight: z.number().positive().optional(),
  weightUnit: z.string().default('kg'),
  length: z.number().positive().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  dimUnit: z.string().default('cm'),
  hazmat: z.boolean().default(false),
  temperature: z.string().optional(),

  // Phase 1 additions
  unitOfMeasure: z.string().optional(),
  unitPriceCents: z.number().int().nonnegative().optional(),
  totalPriceCents: z.number().int().nonnegative().optional(),
  priceCurrency: z.string().optional(),
  freightClass: z.string().optional(),
  nmfcCode: z.string().optional(),
  unNumber: z.string().optional(),
  hazmatClass: z.string().optional(),
  packingGroup: z.string().optional(),
  properShippingName: z.string().optional(),
  hsCode: z.string().optional(),
  countryOfOrigin: z.string().length(2).optional(),
  tempMinC: z.number().optional(),
  tempMaxC: z.number().optional(),
});

export const trackableUnitSchema = z.object({
  identifier: z.string().min(1),
  unitType: z.string().min(1),
  customTypeName: z.string().optional(),
  barcode: z.string().optional(),
  notes: z.string().optional(),
  packagingTypeId: z.string().uuid().nullable().optional(),
  lineItems: z.array(lineItemSchema).min(1, 'Each trackable unit must have at least one line item')
});

export const packingSummarySchema = z.object({
  packagingTypeId: z.string().uuid().nullable().optional(),
  unitCount: z.number().int().positive(),
  stackable: z.boolean().optional(),
  notes: z.string().optional(),
});

export const createOrderSchema = z.object({
  orderNumber: z.string().min(1),
  poNumber: z.string().optional(),
  customerId: z.string().uuid(),
  importSource: z.string().default('manual'),

  // Location IDs (if they exist)
  originId: z.string().uuid().optional(),
  destinationId: z.string().uuid().optional(),

  // Raw location data (if location doesn't exist)
  originData: z.object({
    name: z.string(),
    address1: z.string(),
    address2: z.string().optional(),
    city: z.string(),
    state: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string()
  }).optional(),
  destinationData: z.object({
    name: z.string(),
    address1: z.string(),
    address2: z.string().optional(),
    city: z.string(),
    state: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string()
  }).optional(),

  // Dates
  orderDate: z.string().datetime().optional(),
  requestedPickupDate: z.string().datetime().optional(),
  requestedDeliveryDate: z.string().datetime().optional(),

  // Special requirements
  serviceLevel: z.enum(['FTL', 'LTL']).default('LTL'),
  temperatureControl: z.enum(['ambient', 'refrigerated', 'frozen']).default('ambient'),
  requiresHazmat: z.boolean().default(false),
  specialRequirements: z.array(z.string()).optional(),

  // Trackable units (new preferred way)
  trackableUnits: z.array(trackableUnitSchema).optional(),

  // Line items (legacy - for backward compatibility)
  lineItems: z.array(lineItemSchema).optional(),

  // Order-level "packing summary" (Phase 1). Auto-generates handling units
  // when trackableUnits is not explicitly supplied.
  packingSummary: packingSummarySchema.optional(),

  // Additional info
  specialInstructions: z.string().optional(),
  notes: z.string().optional()
});

const ORDER_STATUSES = ['pending', 'validated', 'location_error', 'converted', 'cancelled', 'archived'] as const;
const DELIVERY_STATUSES = ['unassigned', 'assigned', 'in_transit', 'delivered', 'exception', 'cancelled'] as const;
const DELIVERY_METHODS = ['manual', 'geofence', 'geofence_iot', 'auto', 'driver_app'] as const;
const EXCEPTION_TYPES = ['delay', 'damage', 'refused', 'address_issue', 'weather', 'other'] as const;

const updateOrderSchema = z.object({
  orderNumber: z.string().min(1).optional(),
  poNumber: z.string().optional(),
  status: z.enum(ORDER_STATUSES).optional(),
  originId: z.string().uuid().optional(),
  destinationId: z.string().uuid().optional(),
  requestedPickupDate: z.string().datetime().optional(),
  requestedDeliveryDate: z.string().datetime().optional(),
  serviceLevel: z.string().optional(),
  temperatureControl: z.string().optional(),
  requiresHazmat: z.boolean().optional(),
  specialInstructions: z.string().optional(),
  notes: z.string().optional()
});

export async function orderRoutes(server: FastifyInstance) {
  const ordersRepo = container.resolve<IOrdersRepository>(TOKENS.IOrdersRepository);
  const locationsRepo = container.resolve<ILocationsRepository>(TOKENS.ILocationsRepository);
  const assignmentService = container.resolve<IShipmentAssignmentService>(TOKENS.IShipmentAssignmentService);
  const csvImportService = container.resolve<ICSVImportService>(TOKENS.ICSVImportService);
  const deliveryService = container.resolve<IOrderDeliveryService>(TOKENS.IOrderDeliveryService);
  const conversionService = container.resolve<IOrderConversionService>(TOKENS.IOrderConversionService);
  const orgRepo = container.resolve<IOrganizationRepository>(TOKENS.IOrganizationRepository);
  const commandBus = container.resolve<ICommandBus>(TOKENS.ICommandBus);
  const locationResolution = container.resolve<ILocationResolutionService>(TOKENS.ILocationResolutionService);
  const prisma = container.resolve<import('@prisma/client').PrismaClient>(TOKENS.PrismaClient);

  /**
   * Belt-and-braces check that a child entity actually belongs to the URL-path
   * order. Without this, a request like
   *   PUT /orders/MY-ORDER/trackable-units/<some-other-tenant's-unit-id>
   * would dispatch the command against the foreign unit, since the command
   * handler only fetches by id (not by orderId). Cross-tenant write.
   *
   * Returns the unit's orderId if present and matching, otherwise null.
   */
  async function unitBelongsToOrder(unitId: string, orderId: string): Promise<boolean> {
    const u = await prisma.trackableUnit.findUnique({ where: { id: unitId }, select: { orderId: true } });
    return !!u && u.orderId === orderId;
  }
  async function lineItemBelongsToOrder(itemId: string, orderId: string): Promise<boolean> {
    const li = await prisma.orderLineItem.findUnique({ where: { id: itemId }, select: { orderId: true } });
    return !!li && li.orderId === orderId;
  }

  await registerOrgScope(server);

  // Get all orders (optionally filtered by customer) — scoped to JWT org.
  server.get('/api/v1/orders', async (req: FastifyRequest, _reply: FastifyReply) => {
    const { customerId } = (req.query as { customerId?: string }) || {};
    const orgId = req.orgId!;
    const orders = customerId
      ? await ordersRepo.findByCustomerId(customerId, { orgId })
      : await ordersRepo.all(orgId);
    return { data: orders, error: null };
  });

  // Create order
  server.post('/api/v1/orders', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = createOrderSchema.parse((req as any).body);

    // Get organization settings for default units
    const orgSettings = await orgRepo.getSettings();

    // Apply organization defaults to line items if not specified
    const applyOrgDefaults = (items: any[]) => {
      return items.map((item: any) => ({
        ...item,
        weightUnit: item.weightUnit || orgSettings.weightUnit || 'kg',
        dimUnit: item.dimUnit || orgSettings.dimUnit || 'cm'
      }));
    };

    // Convert date strings to Date objects
    const orderData: any = { ...body };
    if (body.orderDate) orderData.orderDate = new Date(body.orderDate);
    if (body.requestedPickupDate) orderData.requestedPickupDate = new Date(body.requestedPickupDate);
    if (body.requestedDeliveryDate) orderData.requestedDeliveryDate = new Date(body.requestedDeliveryDate);

    // Apply defaults to legacy line items
    if (orderData.lineItems && orderData.lineItems.length > 0) {
      orderData.lineItems = applyOrgDefaults(orderData.lineItems);
    }

    // Apply defaults to trackable unit line items
    if (orderData.trackableUnits && orderData.trackableUnits.length > 0) {
      orderData.trackableUnits = orderData.trackableUnits.map((unit: any) => ({
        ...unit,
        lineItems: unit.lineItems ? applyOrgDefaults(unit.lineItems) : []
      }));
    }

    // Auto-resolve locations: if originData/destinationData provided, create the location
    if (!orderData.originId && body.originData) {
      try {
        const result = await locationResolution.resolveOrCreate(body.originData, req.user?.sub);
        orderData.originId = result.location.id;
        orderData.originValidated = true;
        delete orderData.originData;
      } catch (err) {
        server.log.warn('Failed to auto-resolve origin location: ' + (err as Error).message);
      }
    }

    if (!orderData.destinationId && body.destinationData) {
      try {
        const result = await locationResolution.resolveOrCreate(body.destinationData, req.user?.sub);
        orderData.destinationId = result.location.id;
        orderData.destinationValidated = true;
        delete orderData.destinationData;
      } catch (err) {
        server.log.warn('Failed to auto-resolve destination location: ' + (err as Error).message);
      }
    }

    // Determine order status based on location validation
    let status = 'pending';
    if (!orderData.originId && body.originData) {
      status = 'location_error';
    } else if (!orderData.destinationId && body.destinationData) {
      status = 'location_error';
    } else if (orderData.originId && orderData.destinationId) {
      status = 'validated';
    }

    const orgId = req.orgId!;
    const result = await commandBus.dispatch({
      type: CREATE_ORDER,
      orgId,
      actorId: req.user?.sub ?? null,
      payload: { orderData: { ...orderData, orgId }, status },
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error };
    }

    // Fetch full order with relations for response
    const created = await ordersRepo.findById((result.data as any).id, orgId);
    reply.code(201);
    return { data: created, error: null };
  });

  // Get order by ID. Uses findByIdIncludingArchived (not findById) so an
  // archived order still loads — the detail page needs this to show the
  // archived banner + Unarchive action. Soft-deleted orders still 404.
  server.get('/api/v1/orders/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const orgId = req.orgId!;
    const order = await ordersRepo.findByIdIncludingArchived(id, orgId);
    if (!order) {
      reply.code(404);
      return { data: null, error: 'Order not found' };
    }
    return { data: order, error: null };
  });

  // Update order
  server.put('/api/v1/orders/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = updateOrderSchema.parse((req as any).body);

    // Convert date strings to Date objects
    const data: any = { ...body };
    if (body.requestedPickupDate) data.requestedPickupDate = new Date(body.requestedPickupDate);
    if (body.requestedDeliveryDate) data.requestedDeliveryDate = new Date(body.requestedDeliveryDate);

    const orgId = req.orgId!;
    // Cross-tenant guard before we hit the command bus.
    const existing = await ordersRepo.findById(id, orgId);
    if (!existing) {
      reply.code(404);
      return { data: null, error: 'Order not found' };
    }

    const result = await commandBus.dispatch({
      type: UPDATE_ORDER,
      orgId,
      actorId: req.user?.sub ?? null,
      payload: { id, data },
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(result.error?.includes('not found') ? 404 : 400);
      return { data: null, error: result.error };
    }

    const updated = await ordersRepo.findById(id, orgId);
    return { data: updated, error: null };
  });

  // Archive order (recoverable). Any operational user with orders:write may
  // archive. Mirrors DELETE /api/v1/shipments/:id.
  server.delete('/api/v1/orders/:id', {
    preHandler: requirePermission('orders:write'),
    schema: {
      tags: ['Orders'],
      summary: 'Archive order',
      description: 'Archives an order (recoverable). Removes it from active lists; the row is retained for audit.',
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    const orgId = req.orgId!;
    const existing = await ordersRepo.findById(id, orgId);
    if (!existing) {
      reply.code(404);
      return { data: null, error: 'Order not found' };
    }

    const result = await commandBus.dispatch({
      type: ARCHIVE_ORDER,
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

  // Soft delete (admin-only, orders:delete). Hidden from every view; the row
  // is retained for audit with a deletedAt/deletedBy tombstone. Mirrors
  // POST /api/v1/shipments/:id/soft-delete.
  server.post('/api/v1/orders/:id/soft-delete', {
    preHandler: requirePermission('orders:delete'),
    schema: {
      tags: ['Orders'],
      summary: 'Soft delete order (admin)',
      description: 'Marks an order deleted (deletedAt/deletedBy). Removes it from all views; retained for audit. Requires orders:delete.',
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const orgId = req.orgId!;

    const existing = await prisma.order.findFirst({
      where: { id, orgId, deletedAt: null },
      select: { id: true },
    });
    if (!existing) {
      reply.code(404);
      return { data: null, error: 'Order not found' };
    }

    const result = await commandBus.dispatch({
      type: SOFT_DELETE_ORDER,
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

  // Unarchive (restore). Admin action (orders:delete), mirroring archive's
  // privileged counterpart. Re-inserts the order into active lists and
  // restores its pre-archive status. Mirrors POST /api/v1/shipments/:id/unarchive.
  server.post('/api/v1/orders/:id/unarchive', {
    preHandler: requirePermission('orders:delete'),
    schema: {
      tags: ['Orders'],
      summary: 'Unarchive order (admin)',
      description: 'Restores an archived order to active lists. Requires orders:delete.',
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const orgId = req.orgId!;

    const existing = await prisma.order.findFirst({
      where: { id, orgId, deletedAt: null },
      select: { id: true },
    });
    if (!existing) {
      reply.code(404);
      return { data: null, error: 'Order not found' };
    }

    const result = await commandBus.dispatch({
      type: UNARCHIVE_ORDER,
      orgId,
      actorId: req.user?.sub ?? null,
      payload: { id },
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(404);
      return { data: null, error: result.error };
    }

    return { data: { id, archived: false }, error: null };
  });

  // Validate and create location if needed
  server.post('/api/v1/orders/:id/validate-location', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      locationType: z.enum(['origin', 'destination']),
      createLocation: z.boolean().default(false)
    }).parse((req as any).body);

    const orgId = req.orgId!;
    const order = await ordersRepo.findById(id, orgId);
    if (!order) {
      reply.code(404);
      return { data: null, error: 'Order not found' };
    }

    const locationData = body.locationType === 'origin' ? (order as any).originData : (order as any).destinationData;

    if (!locationData) {
      reply.code(400);
      return { data: null, error: 'No location data available to validate' };
    }

    let locationId: string;

    if (body.createLocation) {
      // Create the location
      const created = await locationsRepo.create(locationData as any);
      locationId = created.id;
    } else {
      // Just flag that manual intervention is needed
      reply.code(400);
      return {
        data: null,
        error: 'Location does not exist. Set createLocation=true to auto-create.',
        locationData
      };
    }

    // Update the order with the validated location
    const updated = await ordersRepo.validateLocation(id, body.locationType, locationId);

    // Fetch the updated order with relations
    const updatedOrder = await ordersRepo.findById(id, orgId);

    return { data: updatedOrder, error: null };
  });

  // Add a flat line item to an order (no specific handling unit). Phase 4
  // dispatches a command so the projection updates and the audit trail
  // captures the change.
  server.post('/api/v1/orders/:id/line-items', {
    schema: { tags: ['Orders - Line Items'], summary: 'Add a line item directly to an order (no unit allocation)' },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = lineItemSchema.parse((req as any).body);

    const orgId = req.orgId!;
    const order = await ordersRepo.findById(id, orgId);
    if (!order) { reply.code(404); return { data: null, error: 'Order not found' }; }

    const result = await commandBus.dispatch({
      type: CREATE_LINE_ITEM,
      orgId,
      actorId: req.user?.sub ?? null,
      payload: { orderId: id, item: body },
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) { reply.code(400); return { data: null, error: result.error }; }
    reply.code(201);
    return { data: result.data, error: null };
  });

  // Edit an existing line item. New in Phase 4 (previously editable only by
  // delete-and-recreate). Sparse payload — only the fields you pass get
  // patched. Emits order_line_item.updated with a changes diff.
  server.put('/api/v1/orders/:orderId/line-items/:itemId', {
    schema: { tags: ['Orders - Line Items'], summary: 'Update a line item (sparse patch)' },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { orderId, itemId } = req.params as { orderId: string; itemId: string };
    const body = lineItemSchema.partial().parse((req as any).body);

    const orgId = req.orgId!;
    const order = await ordersRepo.findById(orderId, orgId);
    if (!order) { reply.code(404); return { data: null, error: 'Order not found' }; }
    if (!(await lineItemBelongsToOrder(itemId, orderId))) {
      reply.code(404); return { data: null, error: 'Line item not found' };
    }

    const result = await commandBus.dispatch({
      type: UPDATE_LINE_ITEM,
      orgId,
      actorId: req.user?.sub ?? null,
      payload: { id: itemId, data: body },
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) { reply.code(400); return { data: null, error: result.error }; }
    return { data: result.data, error: null };
  });

  // Remove line item
  server.delete('/api/v1/orders/:orderId/line-items/:itemId', {
    schema: { tags: ['Orders - Line Items'], summary: 'Delete a line item' },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { orderId, itemId } = req.params as { orderId: string; itemId: string };

    const orgId = req.orgId!;
    const order = await ordersRepo.findById(orderId, orgId);
    if (!order) { reply.code(404); return { data: null, error: 'Order not found' }; }
    if (!(await lineItemBelongsToOrder(itemId, orderId))) {
      reply.code(404); return { data: null, error: 'Line item not found' };
    }

    const result = await commandBus.dispatch({
      type: DELETE_LINE_ITEM,
      orgId,
      actorId: req.user?.sub ?? null,
      payload: { id: itemId },
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) { reply.code(400); return { data: null, error: result.error }; }
    return { data: { success: true }, error: null };
  });

  // Add trackable unit to order — Phase 2 dispatches a command so the
  // creation emits trackable_unit.created and the read model stays in sync.
  server.post('/api/v1/orders/:id/trackable-units', {
    schema: { tags: ['Orders - Handling Units'], summary: 'Add a trackable unit to an order' },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = trackableUnitSchema.parse((req as any).body);

    const orgId = req.orgId!;
    const order = await ordersRepo.findById(id, orgId);
    if (!order) {
      reply.code(404);
      return { data: null, error: 'Order not found' };
    }

    const result = await commandBus.dispatch({
      type: CREATE_TRACKABLE_UNIT,
      orgId,
      actorId: req.user?.sub ?? null,
      payload: {
        orderId: id,
        identifier: body.identifier,
        unitType: body.unitType,
        customTypeName: body.customTypeName,
        barcode: body.barcode,
        notes: body.notes,
        packagingTypeId: body.packagingTypeId ?? null,
      },
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error };
    }
    reply.code(201);
    return { data: result.data, error: null };
  });

  // Update trackable unit. Phase 2 widens this beyond identifier/notes/barcode
  // to include per-unit dim/weight overrides + stackable + packagingType.
  server.put('/api/v1/orders/:orderId/trackable-units/:unitId', {
    schema: { tags: ['Orders - Handling Units'], summary: 'Update a trackable unit (identifier, notes, barcode, dims, weight, stackable)' },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { orderId, unitId } = req.params as { orderId: string; unitId: string };
    if (!(await unitBelongsToOrder(unitId, orderId))) {
      reply.code(404); return { data: null, error: 'Unit not found' };
    }
    const body = z.object({
      identifier: z.string().min(1).optional(),
      notes: z.string().nullable().optional(),
      barcode: z.string().nullable().optional(),
      packagingTypeId: z.string().uuid().nullable().optional(),
      customTypeName: z.string().nullable().optional(),
      weight: z.number().nullable().optional(),
      weightUnit: z.string().optional(),
      length: z.number().nullable().optional(),
      width: z.number().nullable().optional(),
      height: z.number().nullable().optional(),
      dimUnit: z.string().optional(),
      stackable: z.boolean().optional(),
      condition: z.string().optional(),
    }).parse((req as any).body);

    const orgId = req.orgId!;
    const order = await ordersRepo.findById(orderId, orgId);
    if (!order) {
      reply.code(404);
      return { data: null, error: 'Order not found' };
    }

    const result = await commandBus.dispatch({
      type: UPDATE_TRACKABLE_UNIT,
      orgId,
      actorId: req.user?.sub ?? null,
      payload: { id: unitId, data: body },
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error };
    }
    return { data: result.data, error: null };
  });

  // Remove trackable unit
  server.delete('/api/v1/orders/:orderId/trackable-units/:unitId', {
    schema: { tags: ['Orders - Handling Units'], summary: 'Delete a trackable unit (cascade-deletes its line items)' },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { orderId, unitId } = req.params as { orderId: string; unitId: string };
    if (!(await unitBelongsToOrder(unitId, orderId))) {
      reply.code(404); return { data: null, error: 'Unit not found' };
    }

    const orgId = req.orgId!;
    const order = await ordersRepo.findById(orderId, orgId);
    if (!order) {
      reply.code(404);
      return { data: null, error: 'Order not found' };
    }

    const result = await commandBus.dispatch({
      type: DELETE_TRACKABLE_UNIT,
      orgId,
      actorId: req.user?.sub ?? null,
      payload: { id: unitId },
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error };
    }
    return { data: { success: true }, error: null };
  });

  // Add line item to trackable unit
  server.post('/api/v1/orders/:orderId/trackable-units/:unitId/line-items', {
    schema: { tags: ['Orders - Handling Units'], summary: 'Add a new line item directly to a trackable unit' },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { orderId, unitId } = req.params as { orderId: string; unitId: string };
    if (!(await unitBelongsToOrder(unitId, orderId))) {
      reply.code(404); return { data: null, error: 'Unit not found' };
    }
    const body = lineItemSchema.parse((req as any).body);

    const orgId = req.orgId!;
    const order = await ordersRepo.findById(orderId, orgId);
    if (!order) {
      reply.code(404);
      return { data: null, error: 'Order not found' };
    }

    const result = await commandBus.dispatch({
      type: ADD_LINE_ITEM_TO_UNIT,
      orgId,
      actorId: req.user?.sub ?? null,
      payload: { unitId, item: body },
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error };
    }
    reply.code(201);
    return { data: result.data, error: null };
  });

  // Move line item to another trackable unit (drag-and-drop reallocation).
  // `targetUnitId: null` detaches the line from any unit.
  server.put('/api/v1/orders/:orderId/line-items/:itemId/move', {
    schema: { tags: ['Orders - Handling Units'], summary: 'Move a line item to another trackable unit (or detach)' },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { orderId, itemId } = req.params as { orderId: string; itemId: string };
    const body = z.object({
      targetUnitId: z.string().uuid().nullable(),
    }).parse((req as any).body);

    const orgId = req.orgId!;
    const order = await ordersRepo.findById(orderId, orgId);
    if (!order) {
      reply.code(404);
      return { data: null, error: 'Order not found' };
    }
    if (!(await lineItemBelongsToOrder(itemId, orderId))) {
      reply.code(404); return { data: null, error: 'Line item not found' };
    }
    if (body.targetUnitId && !(await unitBelongsToOrder(body.targetUnitId, orderId))) {
      reply.code(404); return { data: null, error: 'Target unit not found' };
    }

    const result = await commandBus.dispatch({
      type: MOVE_LINE_ITEM_BETWEEN_UNITS,
      orgId,
      actorId: req.user?.sub ?? null,
      payload: { lineItemId: itemId, targetUnitId: body.targetUnitId },
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error };
    }
    return { data: result.data, error: null };
  });

  // Generate barcode for trackable unit
  server.post('/api/v1/orders/:orderId/trackable-units/:unitId/generate-barcode', {
    schema: { tags: ['Orders - Handling Units'], summary: 'Generate a barcode (TU-{unitId}-{timestamp}) for a unit' },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { orderId, unitId } = req.params as { orderId: string; unitId: string };
    if (!(await unitBelongsToOrder(unitId, orderId))) {
      reply.code(404); return { data: null, error: 'Unit not found' };
    }

    const orgId = req.orgId!;
    const order = await ordersRepo.findById(orderId, orgId);
    if (!order) {
      reply.code(404);
      return { data: null, error: 'Order not found' };
    }

    const result = await commandBus.dispatch({
      type: GENERATE_TRACKABLE_UNIT_BARCODE,
      orgId,
      actorId: req.user?.sub ?? null,
      payload: { id: unitId },
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error };
    }
    return { data: result.data, error: null };
  });

  // Convert order to shipment
  server.post('/api/v1/orders/:id/convert-to-shipment', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    try {
      const orgId = req.orgId!;
      const order = await ordersRepo.findById(id, orgId);
      if (!order) {
        reply.code(404);
        return { data: null, error: 'Order not found' };
      }

      const result = await ordersRepo.convertToShipment(id);
      return { data: result, error: null };
    } catch (err: any) {
      reply.code(400);
      return { data: null, error: err.message || 'Failed to convert order to shipment' };
    }
  });

  // Get audit logs for order
  server.get('/api/v1/orders/:id/audit-logs', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    const orgId = req.orgId!;
    const order = await ordersRepo.findById(id, orgId);
    if (!order) {
      reply.code(404);
      return { data: null, error: 'Order not found' };
    }

    // Fetch audit logs (for now, return empty array - audit logging would be implemented across all operations)
    const auditLogs = await (ordersRepo as any).prisma.auditLog.findMany({
      where: { orderId: id },
      orderBy: { createdAt: 'desc' }
    });

    return { data: auditLogs, error: null };
  });

  // Get status timeline for order
  server.get('/api/v1/orders/:id/status-timeline', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    const orgId = req.orgId!;
    const order = await ordersRepo.findById(id, orgId);
    if (!order) {
      reply.code(404);
      return { data: null, error: 'Order not found' };
    }

    // Fetch audit logs relevant to status changes
    const auditLogs = await (ordersRepo as any).prisma.auditLog.findMany({
      where: {
        orderId: id,
        action: {
          in: ['delivery_status_changed', 'exception_resolved', 'created', 'status_changed']
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    // Build timeline: start with creation event, then audit log entries
    const timeline: any[] = [];

    // Always include the order creation event
    timeline.push({
      id: `created-${(order as any).id}`,
      timestamp: (order as any).createdAt,
      action: 'created',
      description: `Order created via ${(order as any).importSource || 'manual'}`,
      fromStatus: null,
      toStatus: 'unassigned',
      method: (order as any).importSource || 'manual',
      actor: null
    });

    // Add audit log entries
    for (const log of auditLogs) {
      const changes = log.changes as any;
      timeline.push({
        id: log.id,
        timestamp: log.createdAt,
        action: log.action,
        description: log.description,
        fromStatus: changes?.before?.deliveryStatus || null,
        toStatus: changes?.after?.deliveryStatus || null,
        method: changes?.after?.deliveryMethod || null,
        actor: log.userId || null
      });
    }

    return { data: timeline, error: null };
  });

  // Merge trackable units — moves all of source's line items onto target
  // then deletes source. Both must belong to the same order.
  server.post('/api/v1/orders/:orderId/trackable-units/merge', {
    schema: { tags: ['Orders - Handling Units'], summary: 'Merge two trackable units (source -> target, source deleted)' },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { orderId } = req.params as { orderId: string };
    const body = z.object({
      sourceUnitId: z.string().uuid(),
      targetUnitId: z.string().uuid()
    }).parse((req as any).body);

    const orgId = req.orgId!;
    const order = await ordersRepo.findById(orderId, orgId);
    if (!order) {
      reply.code(404);
      return { data: null, error: 'Order not found' };
    }
    // Both source and target must belong to the URL-path order. Without this,
    // an admin could merge units from another tenant by guessing IDs.
    if (!(await unitBelongsToOrder(body.sourceUnitId, orderId))) {
      reply.code(404); return { data: null, error: 'Source unit not found' };
    }
    if (!(await unitBelongsToOrder(body.targetUnitId, orderId))) {
      reply.code(404); return { data: null, error: 'Target unit not found' };
    }

    const result = await commandBus.dispatch({
      type: MERGE_TRACKABLE_UNITS,
      orgId,
      actorId: req.user?.sub ?? null,
      payload: { sourceUnitId: body.sourceUnitId, targetUnitId: body.targetUnitId },
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error };
    }
    return { data: result.data, error: null };
  });

  // Split trackable unit
  server.post('/api/v1/orders/:orderId/trackable-units/:unitId/split', {
    schema: { tags: ['Orders - Handling Units'], summary: 'Split a trackable unit by moving specified line items to a new unit' },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { orderId, unitId } = req.params as { orderId: string; unitId: string };
    const body = z.object({
      itemIdsToMove: z.array(z.string().uuid()).min(1),
      newIdentifier: z.string().min(1),
      notes: z.string().optional()
    }).parse((req as any).body);

    const orgId = req.orgId!;
    const order = await ordersRepo.findById(orderId, orgId);
    if (!order) {
      reply.code(404);
      return { data: null, error: 'Order not found' };
    }
    if (!(await unitBelongsToOrder(unitId, orderId))) {
      reply.code(404); return { data: null, error: 'Unit not found' };
    }
    // Verify every itemIdsToMove belongs to this order. The command also checks
    // the items belong to the source unit, but cheaper to fail fast here.
    for (const itemId of body.itemIdsToMove) {
      if (!(await lineItemBelongsToOrder(itemId, orderId))) {
        reply.code(404); return { data: null, error: `Line item ${itemId} not found` };
      }
    }

    const result = await commandBus.dispatch({
      type: SPLIT_TRACKABLE_UNIT,
      orgId,
      actorId: req.user?.sub ?? null,
      payload: { unitId, lineItemIds: body.itemIdsToMove, newIdentifier: body.newIdentifier },
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error };
    }
    reply.code(201);
    return { data: result.data, error: null };
  });

  // Export order to CSV
  server.get('/api/v1/orders/:id/export/csv', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    const orgId = req.orgId!;
    const order = await ordersRepo.findById(id, orgId);
    if (!order) {
      reply.code(404);
      return { data: null, error: 'Order not found' };
    }

    // Build CSV content
    const csvRows = [];

    // Header
    csvRows.push('Unit ID,Unit Type,Line Item,SKU,Description,Quantity,Weight,Weight Unit,Length,Width,Height,Dim Unit,Hazmat,Temperature');

    // Trackable units
    order.trackableUnits.forEach(unit => {
      (unit as any).lineItems.forEach((item: any, index: number) => {
        csvRows.push([
          (unit as any).identifier,
          (unit as any).customTypeName || (unit as any).unitType,
          index + 1,
          item.sku,
          item.description || '',
          item.quantity,
          item.weight || '',
          item.weightUnit || '',
          item.length || '',
          item.width || '',
          item.height || '',
          item.dimUnit || '',
          item.hazmat ? 'Yes' : 'No',
          item.temperature || ''
        ].map(field => `"${field}"`).join(','));
      });
    });

    // Legacy line items
    order.lineItems.forEach((item, index) => {
      csvRows.push([
        'N/A',
        'Legacy',
        index + 1,
        item.sku,
        item.description || '',
        item.quantity,
        item.weight || '',
        item.weightUnit || '',
        item.length || '',
        item.width || '',
        item.height || '',
        item.dimUnit || '',
        item.hazmat ? 'Yes' : 'No',
        item.temperature || ''
      ].map(field => `"${field}"`).join(','));
    });

    const csvContent = csvRows.join('\n');

    reply
      .header('Content-Type', 'text/csv')
      .header('Content-Disposition', `attachment; filename="order-${(order as any).orderNumber}.csv"`)
      .send(csvContent);
  });

  // CSV Import endpoint. Accepts either a JSON body `{ csvContent }` (default,
  // matches the frontend uploader) OR a raw text/csv body (handy for curl).
  // Per-line mode-rules validation runs server-side; orders with any failing
  // line are rejected with row-level errors while siblings still go through.
  server.post('/api/v1/orders/import/csv', {
    schema: {
      tags: ['Orders - Bulk Import'],
      summary: 'Bulk-import orders from a CSV',
      description: 'Accepts a JSON body with `csvContent`. Validates every line against the active mode rules (FTL/LTL × hazmat × international × temp-controlled). All-or-nothing per order: an order is rejected entirely if any of its lines fail.',
      body: {
        type: 'object',
        required: ['csvContent'],
        properties: { csvContent: { type: 'string' } },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      let csvContent: string | undefined;
      const ct = (req.headers['content-type'] ?? '').toString().toLowerCase();
      if (ct.includes('text/csv') || ct.includes('text/plain')) {
        csvContent = typeof req.body === 'string' ? req.body : undefined;
      } else {
        const body = req.body as { csvContent?: string };
        csvContent = body?.csvContent;
      }

      if (!csvContent) {
        reply.code(400);
        return { data: null, error: 'csvContent is required' };
      }

      const orgId = req.orgId!;
      const result = await csvImportService.importOrders(csvContent, {
        orgId,
        actorId: req.user?.sub ?? null,
        source: 'csv',
      });

      // Return 200 with the full result even on partial errors so the UI can
      // show row-level diagnostics + the orders that did get created.
      return { data: result, error: null };
    } catch (err: any) {
      reply.code(500);
      return { data: null, error: err.message || 'CSV import failed' };
    }
  });

  // CSV template download — header-only CSV with every column the importer
  // understands. Customers download this, fill it in, upload it back.
  server.get('/api/v1/orders/import/csv/template', {
    schema: {
      tags: ['Orders - Bulk Import'],
      summary: 'Download a blank CSV template with all supported columns',
      response: { 200: { type: 'string' } },
    },
  }, async (_req: FastifyRequest, reply: FastifyReply) => {
    const template = csvImportService.buildTemplate();
    return reply
      .header('Content-Type', 'text/csv')
      .header('Content-Disposition', 'attachment; filename="order-import-template.csv"')
      .send(template);
  });

  // EDI Import endpoint — handled by ediImport.ts route module
  // POST /api/v1/orders/import/edi and POST /api/v1/orders/import/edi/preview

  // Assign order to shipment based on matching lane
  server.post('/api/v1/orders/:id/assign-to-shipment', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    try {
      const orgId = req.orgId!;
      const order = await ordersRepo.findById(id, orgId);
      if (!order) {
        reply.code(404);
        return { data: null, error: 'Order not found' };
      }

      const result = await assignmentService.assignOrderToShipment(id);

      if (!result.success) {
        reply.code(400);
        return { data: null, error: result.message };
      }

      return { data: result, error: null };
    } catch (err: any) {
      reply.code(500);
      return { data: null, error: err.message || 'Failed to assign order to shipment' };
    }
  });

  // Update order delivery status
  server.post('/api/v1/orders/:id/delivery-status', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    const deliveryStatusSchema = z.object({
      deliveryStatus: z.enum(DELIVERY_STATUSES),
      deliveryMethod: z.enum(DELIVERY_METHODS).optional(),
      deliveryConfirmedBy: z.string().optional(),
      deliveryNotes: z.string().optional(),
      exceptionType: z.enum(EXCEPTION_TYPES).optional(),
      exceptionNotes: z.string().optional(),
    });

    const parsed = deliveryStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { data: null, error: parsed.error.issues.map(i => i.message).join(', ') };
    }

    const body = parsed.data;

    try {
      const updatedOrder = await deliveryService.updateOrderDeliveryStatus({
        orderId: id,
        deliveryStatus: body.deliveryStatus,
        deliveryMethod: body.deliveryMethod,
        deliveryConfirmedBy: body.deliveryConfirmedBy,
        deliveryNotes: body.deliveryNotes,
        exceptionType: body.exceptionType,
        exceptionNotes: body.exceptionNotes
      });

      return { data: updatedOrder, error: null };
    } catch (err: any) {
      reply.code(400);
      return { data: null, error: err.message || 'Failed to update delivery status' };
    }
  });

  // Mark order as delivered
  server.post('/api/v1/orders/:id/mark-delivered', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = req.body as {
      method?: string;
      confirmedBy?: string;
      notes?: string;
    };

    try {
      const updatedOrder = await deliveryService.markOrderDelivered(
        id,
        body.method || 'manual',
        body.confirmedBy,
        body.notes
      );

      return { data: updatedOrder, error: null };
    } catch (err: any) {
      reply.code(400);
      return { data: null, error: err.message || 'Failed to mark order as delivered' };
    }
  });

  // Create delivery exception
  server.post('/api/v1/orders/:id/delivery-exception', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    const exceptionSchema = z.object({
      exceptionType: z.enum(EXCEPTION_TYPES),
      exceptionNotes: z.string(),
      reportedBy: z.string().optional(),
    });

    const parsed = exceptionSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { data: null, error: parsed.error.issues.map(i => i.message).join(', ') };
    }

    const body = parsed.data;

    try {
      const updatedOrder = await deliveryService.createDeliveryException({
        orderId: id,
        exceptionType: body.exceptionType,
        exceptionNotes: body.exceptionNotes,
        reportedBy: body.reportedBy
      });

      return { data: updatedOrder, error: null };
    } catch (err: any) {
      reply.code(400);
      return { data: null, error: err.message || 'Failed to create delivery exception' };
    }
  });

  // Resolve delivery exception
  server.post('/api/v1/orders/:id/resolve-exception', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = req.body as {
      resolvedBy?: string;
      notes?: string;
    };

    try {
      const updatedOrder = await deliveryService.resolveDeliveryException(
        id,
        body.resolvedBy,
        body.notes
      );

      return { data: updatedOrder, error: null };
    } catch (err: any) {
      reply.code(400);
      return { data: null, error: err.message || 'Failed to resolve exception' };
    }
  });

  // Update all orders for a shipment stop
  server.post('/api/v1/shipment-stops/:id/update-orders', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = req.body as {
      status: string;
      method?: string;
    };

    try {
      const ordersUpdated = await deliveryService.updateOrdersForStop(
        id,
        body.status,
        body.method || 'auto'
      );

      return { data: { ordersUpdated }, error: null };
    } catch (err: any) {
      reply.code(400);
      return { data: null, error: err.message || 'Failed to update orders for stop' };
    }
  });

  // Check compatibility of orders for batch conversion
  server.post('/api/v1/orders/check-compatibility', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      orderIds: z.array(z.string().uuid()).min(1)
    }).parse((req as any).body);

    try {
      const result = await conversionService.checkCompatibility(body.orderIds);
      return { data: result, error: null };
    } catch (err: any) {
      reply.code(400);
      return { data: null, error: err.message || 'Failed to check compatibility' };
    }
  });

  // Batch convert orders to shipment(s)
  server.post('/api/v1/orders/batch-convert', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      orderIds: z.array(z.string().uuid()).min(1),
      mode: z.enum(['combine', 'individual'])
    }).parse((req as any).body);

    try {
      const result = await conversionService.batchConvert(body.orderIds, { mode: body.mode }, req.user?.sub);

      if (!result.success && result.shipmentIds.length === 0) {
        reply.code(400);
        return { data: result, error: result.message };
      }

      return { data: result, error: null };
    } catch (err: any) {
      reply.code(500);
      return { data: null, error: err.message || 'Failed to batch convert orders' };
    }
  });

  // Split order into multiple shipments
  server.post('/api/v1/orders/:id/split-to-shipments', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      groups: z.array(z.object({
        trackableUnitIds: z.array(z.string().uuid()),
        legacyItemIds: z.array(z.string().uuid())
      })).min(2)
    }).parse((req as any).body);

    try {
      const orgId = req.orgId!;
      const order = await ordersRepo.findById(id, orgId);
      if (!order) {
        reply.code(404);
        return { data: null, error: 'Order not found' };
      }

      const result = await conversionService.splitOrder(id, body.groups, req.user?.sub);

      if (!result.success) {
        reply.code(400);
        return { data: result, error: result.message };
      }

      return { data: result, error: null };
    } catch (err: any) {
      reply.code(500);
      return { data: null, error: err.message || 'Failed to split order' };
    }
  });

  // Geofence check (webhook endpoint for GPS tracking)
  server.post('/api/v1/shipments/:id/geofence-check', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = req.body as {
      lat: number;
      lng: number;
    };

    try {
      const ordersUpdated = await deliveryService.checkGeofenceAndUpdateOrders(
        id,
        body.lat,
        body.lng
      );

      return { data: { ordersUpdated }, error: null };
    } catch (err: any) {
      reply.code(400);
      return { data: null, error: err.message || 'Failed to check geofence' };
    }
  });
}
