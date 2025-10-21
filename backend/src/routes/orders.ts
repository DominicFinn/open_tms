import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { IOrdersRepository } from '../repositories/OrdersRepository.js';
import { ILocationsRepository } from '../repositories/LocationsRepository.js';
import { container, TOKENS } from '../di/index.js';

// Validation schemas
const lineItemSchema = z.object({
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

const createOrderSchema = z.object({
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

  // Line items
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

  // Get all orders
  server.get('/api/v1/orders', async (_req: FastifyRequest, _reply: FastifyReply) => {
    const orders = await ordersRepo.all();
    return { data: orders, error: null };
  });

  // Create order
  server.post('/api/v1/orders', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = createOrderSchema.parse((req as any).body);

    // Convert date strings to Date objects
    const orderData: any = { ...body };
    if (body.orderDate) orderData.orderDate = new Date(body.orderDate);
    if (body.requestedPickupDate) orderData.requestedPickupDate = new Date(body.requestedPickupDate);
    if (body.requestedDeliveryDate) orderData.requestedDeliveryDate = new Date(body.requestedDeliveryDate);

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

    const locationData = body.locationType === 'origin' ? order.originData : order.destinationData;

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

  // CSV Import endpoint (placeholder)
  server.post('/api/v1/orders/import/csv', async (req: FastifyRequest, reply: FastifyReply) => {
    // TODO: Implement CSV parsing and order creation
    reply.code(501);
    return {
      data: null,
      error: 'CSV import not yet implemented. Coming soon!'
    };
  });

  // EDI Import endpoint (placeholder)
  server.post('/api/v1/orders/import/edi', async (req: FastifyRequest, reply: FastifyReply) => {
    // TODO: Implement EDI parsing (X12/EDIFACT) and order creation
    reply.code(501);
    return {
      data: null,
      error: 'EDI import not yet implemented. Coming soon!'
    };
  });
}
