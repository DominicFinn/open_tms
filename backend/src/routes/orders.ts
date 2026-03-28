import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { IOrdersRepository } from '../repositories/OrdersRepository.js';
import { ILocationsRepository } from '../repositories/LocationsRepository.js';
import { IShipmentAssignmentService } from '../services/ShipmentAssignmentService.js';
import { ICSVImportService } from '../services/CSVImportService.js';
import { IOrderDeliveryService } from '../services/OrderDeliveryService.js';
import { IOrganizationRepository } from '../repositories/OrganizationRepository.js';
import { container, TOKENS } from '../di/index.js';

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
  temperature: z.string().optional()
});

export const trackableUnitSchema = z.object({
  identifier: z.string().min(1),
  unitType: z.string().min(1),
  customTypeName: z.string().optional(),
  barcode: z.string().optional(),
  notes: z.string().optional(),
  lineItems: z.array(lineItemSchema).min(1, 'Each trackable unit must have at least one line item')
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

  // Additional info
  specialInstructions: z.string().optional(),
  notes: z.string().optional()
});

const updateOrderSchema = z.object({
  orderNumber: z.string().min(1).optional(),
  poNumber: z.string().optional(),
  status: z.string().optional(),
  originId: z.string().uuid().optional(),
  destinationId: z.string().uuid().optional(),
  requestedPickupDate: z.string().datetime().optional(),
  requestedDeliveryDate: z.string().datetime().optional(),
  specialInstructions: z.string().optional(),
  notes: z.string().optional()
});

export async function orderRoutes(server: FastifyInstance) {
  const ordersRepo = container.resolve<IOrdersRepository>(TOKENS.IOrdersRepository);
  const locationsRepo = container.resolve<ILocationsRepository>(TOKENS.ILocationsRepository);
  const assignmentService = container.resolve<IShipmentAssignmentService>(TOKENS.IShipmentAssignmentService);
  const csvImportService = container.resolve<ICSVImportService>(TOKENS.ICSVImportService);
  const deliveryService = container.resolve<IOrderDeliveryService>(TOKENS.IOrderDeliveryService);
  const orgRepo = container.resolve<IOrganizationRepository>(TOKENS.IOrganizationRepository);

  // Get all orders
  server.get('/api/v1/orders', async (_req: FastifyRequest, _reply: FastifyReply) => {
    const orders = await ordersRepo.all();
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

    // Determine order status based on location validation
    let status = 'pending';
    if (!body.originId && body.originData) {
      status = 'location_error';
    } else if (!body.destinationId && body.destinationData) {
      status = 'location_error';
    } else if (body.originId && body.destinationId) {
      status = 'validated';
    }

    orderData.status = status;

    const created = await ordersRepo.create(orderData);
    reply.code(201);
    return { data: created, error: null };
  });

  // Get order by ID
  server.get('/api/v1/orders/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const order = await ordersRepo.findById(id);
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

    const order = await ordersRepo.findById(id);
    if (!order) {
      reply.code(404);
      return { data: null, error: 'Order not found' };
    }

    // Convert date strings to Date objects
    const updateData: any = { ...body };
    if (body.requestedPickupDate) updateData.requestedPickupDate = new Date(body.requestedPickupDate);
    if (body.requestedDeliveryDate) updateData.requestedDeliveryDate = new Date(body.requestedDeliveryDate);

    const updated = await ordersRepo.update(id, updateData);
    return { data: updated, error: null };
  });

  // Delete (archive) order
  server.delete('/api/v1/orders/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    const order = await ordersRepo.findById(id);
    if (!order) {
      reply.code(404);
      return { data: null, error: 'Order not found' };
    }

    const archived = await ordersRepo.archive(id);
    return { data: archived, error: null };
  });

  // Validate and create location if needed
  server.post('/api/v1/orders/:id/validate-location', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      locationType: z.enum(['origin', 'destination']),
      createLocation: z.boolean().default(false)
    }).parse((req as any).body);

    const order = await ordersRepo.findById(id);
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
    const updatedOrder = await ordersRepo.findById(id);

    return { data: updatedOrder, error: null };
  });

  // Add line item to order
  server.post('/api/v1/orders/:id/line-items', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = lineItemSchema.parse((req as any).body);

    const order = await ordersRepo.findById(id);
    if (!order) {
      reply.code(404);
      return { data: null, error: 'Order not found' };
    }

    const lineItem = await ordersRepo.addLineItem(id, body);
    reply.code(201);
    return { data: lineItem, error: null };
  });

  // Remove line item
  server.delete('/api/v1/orders/:orderId/line-items/:itemId', async (req: FastifyRequest, reply: FastifyReply) => {
    const { orderId, itemId } = req.params as { orderId: string; itemId: string };

    const order = await ordersRepo.findById(orderId);
    if (!order) {
      reply.code(404);
      return { data: null, error: 'Order not found' };
    }

    await ordersRepo.removeLineItem(itemId);
    return { data: { success: true }, error: null };
  });

  // Add trackable unit to order
  server.post('/api/v1/orders/:id/trackable-units', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = trackableUnitSchema.parse((req as any).body);

    const order = await ordersRepo.findById(id);
    if (!order) {
      reply.code(404);
      return { data: null, error: 'Order not found' };
    }

    const unit = await ordersRepo.addTrackableUnit(id, body);
    reply.code(201);
    return { data: unit, error: null };
  });

  // Update trackable unit
  server.put('/api/v1/orders/:orderId/trackable-units/:unitId', async (req: FastifyRequest, reply: FastifyReply) => {
    const { orderId, unitId } = req.params as { orderId: string; unitId: string };
    const body = z.object({
      identifier: z.string().min(1).optional(),
      notes: z.string().optional(),
      barcode: z.string().optional()
    }).parse((req as any).body);

    const order = await ordersRepo.findById(orderId);
    if (!order) {
      reply.code(404);
      return { data: null, error: 'Order not found' };
    }

    const updated = await ordersRepo.updateTrackableUnit(unitId, body);
    return { data: updated, error: null };
  });

  // Remove trackable unit
  server.delete('/api/v1/orders/:orderId/trackable-units/:unitId', async (req: FastifyRequest, reply: FastifyReply) => {
    const { orderId, unitId } = req.params as { orderId: string; unitId: string };

    const order = await ordersRepo.findById(orderId);
    if (!order) {
      reply.code(404);
      return { data: null, error: 'Order not found' };
    }

    await ordersRepo.removeTrackableUnit(unitId);
    return { data: { success: true }, error: null };
  });

  // Add line item to trackable unit
  server.post('/api/v1/orders/:orderId/trackable-units/:unitId/line-items', async (req: FastifyRequest, reply: FastifyReply) => {
    const { orderId, unitId } = req.params as { orderId: string; unitId: string };
    const body = lineItemSchema.parse((req as any).body);

    const order = await ordersRepo.findById(orderId);
    if (!order) {
      reply.code(404);
      return { data: null, error: 'Order not found' };
    }

    const lineItem = await ordersRepo.addLineItemToUnit(unitId, body);
    reply.code(201);
    return { data: lineItem, error: null };
  });

  // Move line item to another trackable unit
  server.put('/api/v1/orders/:orderId/line-items/:itemId/move', async (req: FastifyRequest, reply: FastifyReply) => {
    const { orderId, itemId } = req.params as { orderId: string; itemId: string };
    const body = z.object({
      targetUnitId: z.string().uuid()
    }).parse((req as any).body);

    const order = await ordersRepo.findById(orderId);
    if (!order) {
      reply.code(404);
      return { data: null, error: 'Order not found' };
    }

    const lineItem = await ordersRepo.moveLineItemToUnit(itemId, body.targetUnitId);
    return { data: lineItem, error: null };
  });

  // Generate barcode for trackable unit
  server.post('/api/v1/orders/:orderId/trackable-units/:unitId/generate-barcode', async (req: FastifyRequest, reply: FastifyReply) => {
    const { orderId, unitId } = req.params as { orderId: string; unitId: string };

    const order = await ordersRepo.findById(orderId);
    if (!order) {
      reply.code(404);
      return { data: null, error: 'Order not found' };
    }

    const updated = await ordersRepo.generateBarcode(unitId);
    return { data: updated, error: null };
  });

  // Convert order to shipment
  server.post('/api/v1/orders/:id/convert-to-shipment', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    try {
      const order = await ordersRepo.findById(id);
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

    const order = await ordersRepo.findById(id);
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

  // Merge trackable units
  server.post('/api/v1/orders/:orderId/trackable-units/merge', async (req: FastifyRequest, reply: FastifyReply) => {
    const { orderId } = req.params as { orderId: string };
    const body = z.object({
      sourceUnitId: z.string().uuid(),
      targetUnitId: z.string().uuid()
    }).parse((req as any).body);

    try {
      const order = await ordersRepo.findById(orderId);
      if (!order) {
        reply.code(404);
        return { data: null, error: 'Order not found' };
      }

      await ordersRepo.mergeUnits(body.sourceUnitId, body.targetUnitId);
      return { data: { success: true }, error: null };
    } catch (err: any) {
      reply.code(400);
      return { data: null, error: err.message || 'Failed to merge units' };
    }
  });

  // Split trackable unit
  server.post('/api/v1/orders/:orderId/trackable-units/:unitId/split', async (req: FastifyRequest, reply: FastifyReply) => {
    const { orderId, unitId } = req.params as { orderId: string; unitId: string };
    const body = z.object({
      itemIdsToMove: z.array(z.string().uuid()),
      newIdentifier: z.string().min(1),
      notes: z.string().optional()
    }).parse((req as any).body);

    try {
      const order = await ordersRepo.findById(orderId);
      if (!order) {
        reply.code(404);
        return { data: null, error: 'Order not found' };
      }

      const newUnit = await ordersRepo.splitUnit(unitId, body.itemIdsToMove, {
        identifier: body.newIdentifier,
        notes: body.notes
      });

      reply.code(201);
      return { data: newUnit, error: null };
    } catch (err: any) {
      reply.code(400);
      return { data: null, error: err.message || 'Failed to split unit' };
    }
  });

  // Export order to CSV
  server.get('/api/v1/orders/:id/export/csv', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    const order = await ordersRepo.findById(id);
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

  // CSV Import endpoint
  server.post('/api/v1/orders/import/csv', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = req.body as { csvContent: string };

      if (!body.csvContent) {
        reply.code(400);
        return {
          data: null,
          error: 'CSV content is required'
        };
      }

      const result = await csvImportService.importOrders(body.csvContent);

      if (!result.success && result.errors.length > 0) {
        reply.code(400);
        return {
          data: result,
          error: `Import completed with errors: ${result.errors.length} errors occurred`
        };
      }

      return {
        data: result,
        error: null
      };
    } catch (err: any) {
      reply.code(500);
      return {
        data: null,
        error: err.message || 'CSV import failed'
      };
    }
  });

  // EDI Import endpoint — handled by ediImport.ts route module
  // POST /api/v1/orders/import/edi and POST /api/v1/orders/import/edi/preview

  // Assign order to shipment based on matching lane
  server.post('/api/v1/orders/:id/assign-to-shipment', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    try {
      const order = await ordersRepo.findById(id);
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
    const body = req.body as {
      deliveryStatus: string;
      deliveryMethod?: string;
      deliveryConfirmedBy?: string;
      deliveryNotes?: string;
      exceptionType?: string;
      exceptionNotes?: string;
    };

    try {
      const updatedOrder = await deliveryService.updateOrderDeliveryStatus({
        orderId: id,
        deliveryStatus: body.deliveryStatus as any,
        deliveryMethod: body.deliveryMethod as any,
        deliveryConfirmedBy: body.deliveryConfirmedBy,
        deliveryNotes: body.deliveryNotes,
        exceptionType: body.exceptionType as any,
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
    const body = req.body as {
      exceptionType: string;
      exceptionNotes: string;
      reportedBy?: string;
    };

    try {
      const updatedOrder = await deliveryService.createDeliveryException({
        orderId: id,
        exceptionType: body.exceptionType as any,
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
