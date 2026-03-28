import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { IOrdersRepository } from '../repositories/OrdersRepository.js';
import { IOrganizationRepository } from '../repositories/OrganizationRepository.js';
import { IShipmentAssignmentService } from '../services/ShipmentAssignmentService.js';
import { container, TOKENS } from '../di/index.js';
import { createOrderSchema } from './orders.js';
import { authenticateApiKey, checkRateLimit } from '../middleware/apiKeyAuth.js';

// Schema for the customer-facing order creation (customerId is not accepted — it comes from the API key)
const customerCreateOrderSchema = createOrderSchema.omit({ customerId: true }).extend({
  autoAssign: z.boolean().default(false)
});

export async function customerApiRoutes(server: FastifyInstance) {
  const ordersRepo = container.resolve<IOrdersRepository>(TOKENS.IOrdersRepository);
  const orgRepo = container.resolve<IOrganizationRepository>(TOKENS.IOrganizationRepository);
  const assignmentService = container.resolve<IShipmentAssignmentService>(TOKENS.IShipmentAssignmentService);

  // Shared auth + rate limit check. Returns customerId or sends error response.
  async function authenticate(req: FastifyRequest, reply: FastifyReply): Promise<string | null> {
    const ip = req.ip || 'unknown';
    if (!checkRateLimit(ip)) {
      reply.code(429);
      reply.send({
        data: null,
        error: 'Too many requests. Please try again later.',
        retryAfter: '60 seconds'
      });
      return null;
    }

    const authResult = await authenticateApiKey(server, req, reply);
    if (authResult.error) {
      reply.send({ data: null, error: authResult.error });
      return null;
    }

    if (!authResult.customerId) {
      reply.code(403);
      reply.send({
        data: null,
        error: 'This API key is not linked to a customer account. Contact your administrator to associate it with a customer.'
      });
      return null;
    }

    return authResult.customerId;
  }

  // POST /api/v1/customer-api/orders — Create an order
  server.post('/api/v1/customer-api/orders', async (req: FastifyRequest, reply: FastifyReply) => {
    const customerId = await authenticate(req, reply);
    if (!customerId) return;

    let body;
    try {
      body = customerCreateOrderSchema.parse((req as any).body);
    } catch (err: any) {
      reply.code(400);
      return { data: null, error: err.errors || err.message || 'Invalid request body' };
    }

    const { autoAssign, ...orderFields } = body;

    // Get organization settings for default units
    const orgSettings = await orgRepo.getSettings();

    const applyOrgDefaults = (items: any[]) => {
      return items.map((item: any) => ({
        ...item,
        weightUnit: item.weightUnit || orgSettings.weightUnit || 'kg',
        dimUnit: item.dimUnit || orgSettings.dimUnit || 'cm'
      }));
    };

    // Build order data
    const orderData: any = {
      ...orderFields,
      customerId,
      importSource: 'api'
    };

    // Convert date strings to Date objects
    if (orderFields.orderDate) orderData.orderDate = new Date(orderFields.orderDate);
    if (orderFields.requestedPickupDate) orderData.requestedPickupDate = new Date(orderFields.requestedPickupDate);
    if (orderFields.requestedDeliveryDate) orderData.requestedDeliveryDate = new Date(orderFields.requestedDeliveryDate);

    // Apply org defaults to line items
    if (orderData.lineItems && orderData.lineItems.length > 0) {
      orderData.lineItems = applyOrgDefaults(orderData.lineItems);
    }
    if (orderData.trackableUnits && orderData.trackableUnits.length > 0) {
      orderData.trackableUnits = orderData.trackableUnits.map((unit: any) => ({
        ...unit,
        lineItems: unit.lineItems ? applyOrgDefaults(unit.lineItems) : []
      }));
    }

    // Determine order status based on location validation
    let status = 'pending';
    if (!orderFields.originId && orderFields.originData) {
      status = 'location_error';
    } else if (!orderFields.destinationId && orderFields.destinationData) {
      status = 'location_error';
    } else if (orderFields.originId && orderFields.destinationId) {
      status = 'validated';
    }
    orderData.status = status;

    let created;
    try {
      created = await ordersRepo.create(orderData);
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        reply.code(409);
        return { data: null, error: `Order number '${orderFields.orderNumber}' already exists.` };
      }
      throw err;
    }

    // Optionally auto-assign to shipment
    let assignmentResult = null;
    if (autoAssign && status === 'validated') {
      try {
        assignmentResult = await assignmentService.assignOrderToShipment(created.id);
      } catch (_err) {
        // Assignment failure is non-fatal — order was still created
        assignmentResult = { success: false, message: 'Auto-assignment failed. Order was created successfully.' };
      }
    }

    reply.code(201);
    return {
      data: created,
      assignment: assignmentResult,
      error: null
    };
  });

  // GET /api/v1/customer-api/orders — List orders for the authenticated customer
  server.get('/api/v1/customer-api/orders', async (req: FastifyRequest, reply: FastifyReply) => {
    const customerId = await authenticate(req, reply);
    if (!customerId) return;

    const query = req.query as { status?: string; limit?: string; offset?: string };
    const options = {
      status: query.status,
      limit: query.limit ? Math.min(parseInt(query.limit, 10), 100) : 50,
      offset: query.offset ? parseInt(query.offset, 10) : 0
    };

    const orders = await ordersRepo.findByCustomerId(customerId, options);
    return { data: orders, error: null };
  });

  // GET /api/v1/customer-api/orders/:id — Get order detail
  server.get('/api/v1/customer-api/orders/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const customerId = await authenticate(req, reply);
    if (!customerId) return;

    const { id } = req.params as { id: string };
    const order = await ordersRepo.findById(id);

    if (!order || order.customerId !== customerId) {
      reply.code(404);
      return { data: null, error: 'Order not found' };
    }

    return { data: order, error: null };
  });

  // GET /api/v1/customer-api/orders/:id/status — Get order status (lightweight)
  server.get('/api/v1/customer-api/orders/:id/status', async (req: FastifyRequest, reply: FastifyReply) => {
    const customerId = await authenticate(req, reply);
    if (!customerId) return;

    const { id } = req.params as { id: string };
    const order = await ordersRepo.findById(id);

    if (!order || order.customerId !== customerId) {
      reply.code(404);
      return { data: null, error: 'Order not found' };
    }

    return {
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        deliveryStatus: order.deliveryStatus,
        deliveredAt: order.deliveredAt,
        updatedAt: order.updatedAt
      },
      error: null
    };
  });
}
