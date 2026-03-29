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

// Shared OpenAPI security and error responses for all customer API endpoints
const apiKeySecurity = [{ ApiKeyAuth: [] }];

const errorResponses = {
  401: {
    description: 'API key required',
    type: 'object',
    properties: {
      data: { type: 'null' },
      error: { type: 'string', example: 'API key required. Please provide x-api-key header or Authorization Bearer token.' }
    }
  },
  403: {
    description: 'Invalid/inactive API key or key not linked to a customer',
    type: 'object',
    properties: {
      data: { type: 'null' },
      error: { type: 'string' }
    }
  },
  429: {
    description: 'Rate limit exceeded (100 requests/minute)',
    type: 'object',
    properties: {
      data: { type: 'null' },
      error: { type: 'string' },
      retryAfter: { type: 'string', example: '60 seconds' }
    }
  }
};

// Reusable schema fragments
const locationDataSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    address1: { type: 'string' },
    address2: { type: 'string' },
    city: { type: 'string' },
    state: { type: 'string' },
    postalCode: { type: 'string' },
    country: { type: 'string' }
  },
  required: ['name', 'address1', 'city', 'country']
};

const lineItemSchema = {
  type: 'object',
  properties: {
    sku: { type: 'string' },
    description: { type: 'string' },
    quantity: { type: 'integer', minimum: 1 },
    weight: { type: 'number' },
    weightUnit: { type: 'string', default: 'kg' },
    length: { type: 'number' },
    width: { type: 'number' },
    height: { type: 'number' },
    dimUnit: { type: 'string', default: 'cm' },
    hazmat: { type: 'boolean', default: false },
    temperature: { type: 'string' }
  },
  required: ['sku', 'quantity']
};

const trackableUnitSchema = {
  type: 'object',
  properties: {
    identifier: { type: 'string', description: 'Unit identifier, e.g. "PALLET-001"' },
    unitType: { type: 'string', description: 'pallet, tote, box, stillage, or custom' },
    customTypeName: { type: 'string' },
    barcode: { type: 'string' },
    notes: { type: 'string' },
    lineItems: { type: 'array', items: lineItemSchema, minItems: 1 }
  },
  required: ['identifier', 'unitType', 'lineItems']
};

const orderStatusSchema = {
  type: 'object',
  properties: {
    orderId: { type: 'string', format: 'uuid' },
    orderNumber: { type: 'string' },
    status: { type: 'string', enum: ['pending', 'validated', 'location_error', 'assigned', 'converted', 'pending_lane', 'cancelled', 'archived'] },
    deliveryStatus: { type: 'string', enum: ['unassigned', 'assigned', 'in_transit', 'delivered', 'exception', 'cancelled'] },
    deliveredAt: { type: 'string', format: 'date-time', nullable: true },
    updatedAt: { type: 'string', format: 'date-time' }
  }
};

export async function customerApiRoutes(server: FastifyInstance) {
  const ordersRepo = container.resolve<IOrdersRepository>(TOKENS.IOrdersRepository);
  const orgRepo = container.resolve<IOrganizationRepository>(TOKENS.IOrganizationRepository);
  const assignmentService = container.resolve<IShipmentAssignmentService>(TOKENS.IShipmentAssignmentService);

  // Register API key security scheme for Swagger
  server.addSchema({
    $id: 'CustomerApiSecurity',
    type: 'object',
    description: 'Customer API requires an API key linked to a customer. Pass via x-api-key header or Authorization: Bearer <key>.'
  });

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
  server.post('/api/v1/customer-api/orders', {
    schema: {
      description: 'Create a new order. The customer is determined by the API key — no customerId is needed in the body. Optionally set autoAssign: true to trigger automatic lane matching and shipment assignment.',
      tags: ['Customer API'],
      security: apiKeySecurity,
      headers: {
        type: 'object',
        properties: {
          'x-api-key': { type: 'string', description: 'Customer-scoped API key (alternative: Authorization: Bearer <key>)' }
        }
      },
      body: {
        type: 'object',
        required: ['orderNumber'],
        properties: {
          orderNumber: { type: 'string', description: 'Unique order reference number' },
          poNumber: { type: 'string', description: 'Purchase order number' },
          originId: { type: 'string', format: 'uuid', description: 'ID of an existing origin location' },
          destinationId: { type: 'string', format: 'uuid', description: 'ID of an existing destination location' },
          originData: { ...locationDataSchema, description: 'Raw origin address (used if originId not provided)' },
          destinationData: { ...locationDataSchema, description: 'Raw destination address (used if destinationId not provided)' },
          orderDate: { type: 'string', format: 'date-time' },
          requestedPickupDate: { type: 'string', format: 'date-time' },
          requestedDeliveryDate: { type: 'string', format: 'date-time' },
          serviceLevel: { type: 'string', enum: ['FTL', 'LTL'], default: 'LTL' },
          temperatureControl: { type: 'string', enum: ['ambient', 'refrigerated', 'frozen'], default: 'ambient' },
          requiresHazmat: { type: 'boolean', default: false },
          trackableUnits: {
            type: 'array',
            items: trackableUnitSchema,
            description: 'Trackable units (pallets, totes, boxes) containing line items'
          },
          lineItems: {
            type: 'array',
            items: lineItemSchema,
            description: 'Legacy line items (prefer trackableUnits instead)'
          },
          specialInstructions: { type: 'string' },
          notes: { type: 'string' },
          autoAssign: {
            type: 'boolean',
            default: false,
            description: 'If true, automatically attempt to match the order to a lane and assign to a shipment'
          }
        }
      },
      response: {
        201: {
          description: 'Order created successfully',
          type: 'object',
          properties: {
            data: { type: 'object', description: 'The created order with all relations' },
            assignment: {
              type: 'object',
              nullable: true,
              description: 'Shipment assignment result (only if autoAssign was true)',
              properties: {
                success: { type: 'boolean' },
                shipmentId: { type: 'string' },
                pendingLaneRequestId: { type: 'string' },
                message: { type: 'string' }
              }
            },
            error: { type: 'null' }
          }
        },
        400: {
          description: 'Validation error',
          type: 'object',
          properties: {
            data: { type: 'null' },
            error: { description: 'Validation error details' }
          }
        },
        409: {
          description: 'Order number already exists',
          type: 'object',
          properties: {
            data: { type: 'null' },
            error: { type: 'string' }
          }
        },
        ...errorResponses
      }
    }
  }, async (req: FastifyRequest, reply: FastifyReply) => {
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
  server.get('/api/v1/customer-api/orders', {
    schema: {
      description: 'List all orders belonging to the authenticated customer. Supports filtering by status and pagination via limit/offset.',
      tags: ['Customer API'],
      security: apiKeySecurity,
      headers: {
        type: 'object',
        properties: {
          'x-api-key': { type: 'string', description: 'Customer-scoped API key' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Filter by order status', enum: ['pending', 'validated', 'location_error', 'assigned', 'converted', 'pending_lane', 'cancelled'] },
          limit: { type: 'integer', default: 50, minimum: 1, maximum: 100, description: 'Max results to return (default 50, max 100)' },
          offset: { type: 'integer', default: 0, minimum: 0, description: 'Number of results to skip for pagination' }
        }
      },
      response: {
        200: {
          description: 'List of orders',
          type: 'object',
          properties: {
            data: { type: 'array', items: { type: 'object' } },
            error: { type: 'null' }
          }
        },
        ...errorResponses
      }
    }
  }, async (req: FastifyRequest, reply: FastifyReply) => {
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
  server.get('/api/v1/customer-api/orders/:id', {
    schema: {
      description: 'Get full details of a specific order. Only returns orders belonging to the authenticated customer.',
      tags: ['Customer API'],
      security: apiKeySecurity,
      headers: {
        type: 'object',
        properties: {
          'x-api-key': { type: 'string', description: 'Customer-scoped API key' }
        }
      },
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid', description: 'Order ID' }
        },
        required: ['id']
      },
      response: {
        200: {
          description: 'Order details with trackable units, line items, and location data',
          type: 'object',
          properties: {
            data: { type: 'object' },
            error: { type: 'null' }
          }
        },
        404: {
          description: 'Order not found (or belongs to a different customer)',
          type: 'object',
          properties: {
            data: { type: 'null' },
            error: { type: 'string' }
          }
        },
        ...errorResponses
      }
    }
  }, async (req: FastifyRequest, reply: FastifyReply) => {
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
  server.get('/api/v1/customer-api/orders/:id/status', {
    schema: {
      description: 'Get a lightweight status summary for an order. Useful for polling order progress without fetching all details.',
      tags: ['Customer API'],
      security: apiKeySecurity,
      headers: {
        type: 'object',
        properties: {
          'x-api-key': { type: 'string', description: 'Customer-scoped API key' }
        }
      },
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid', description: 'Order ID' }
        },
        required: ['id']
      },
      response: {
        200: {
          description: 'Order status summary',
          type: 'object',
          properties: {
            data: orderStatusSchema,
            error: { type: 'null' }
          }
        },
        404: {
          description: 'Order not found',
          type: 'object',
          properties: {
            data: { type: 'null' },
            error: { type: 'string' }
          }
        },
        ...errorResponses
      }
    }
  }, async (req: FastifyRequest, reply: FastifyReply) => {
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
