import Fastify, { FastifyReply, FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import { z } from 'zod';

const server = Fastify({ logger: true });

// In-memory data store for demo
let customers: any[] = [
  { id: '1', name: 'Walmart Inc.', contactEmail: 'logistics@walmart.com', archived: false, createdAt: new Date(), updatedAt: new Date() },
  { id: '2', name: 'Best Buy Co. Inc.', contactEmail: 'supply@bestbuy.com', archived: false, createdAt: new Date(), updatedAt: new Date() },
  { id: '3', name: 'Target Corporation', contactEmail: 'operations@target.com', archived: false, createdAt: new Date(), updatedAt: new Date() }
];

let locations: any[] = [
  { id: '1', name: 'Head Office - Dallas', address1: '1234 Commerce Street', city: 'Dallas', state: 'Texas', postalCode: '75201', country: 'USA', lat: 32.7767, lng: -96.7970, archived: false, createdAt: new Date(), updatedAt: new Date() },
  { id: '2', name: 'Central Distribution Center - Chicago', address1: '5000 W 159th St', city: 'Chicago', state: 'Illinois', postalCode: '60477', country: 'USA', lat: 41.8781, lng: -87.6298, archived: false, createdAt: new Date(), updatedAt: new Date() },
  { id: '3', name: 'West Coast Hub - Los Angeles', address1: '12000 E 40th St', city: 'Los Angeles', state: 'California', postalCode: '90058', country: 'USA', lat: 34.0522, lng: -118.2437, archived: false, createdAt: new Date(), updatedAt: new Date() }
];

let shipments: any[] = [
  { id: '1', reference: 'SH-0001', status: 'in_transit', customerId: '1', originId: '1', destinationId: '2', items: [{ sku: 'ITEM-001', description: 'Product 1', quantity: 10, weightKg: 5, volumeM3: 1 }], archived: false, createdAt: new Date(), updatedAt: new Date() },
  { id: '2', reference: 'SH-0002', status: 'delivered', customerId: '2', originId: '2', destinationId: '3', items: [{ sku: 'ITEM-002', description: 'Product 2', quantity: 5, weightKg: 3, volumeM3: 0.5 }], archived: false, createdAt: new Date(), updatedAt: new Date() }
];

// Simple rate limiting for demo protection
const requestCounts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 50; // requests per minute
const WINDOW_MS = 60 * 1000; // 1 minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const userLimit = requestCounts.get(ip);
  
  if (!userLimit || now > userLimit.resetTime) {
    requestCounts.set(ip, { count: 1, resetTime: now + WINDOW_MS });
    return true;
  }
  
  if (userLimit.count >= RATE_LIMIT) {
    return false;
  }
  
  userLimit.count++;
  return true;
}

async function start() {
  await server.register(cors, { origin: true });
  
  // Add rate limiting middleware
  server.addHook('onRequest', async (request, reply) => {
    const ip = request.ip || 'unknown';
    if (!checkRateLimit(ip)) {
      reply.code(429).send({
        code: 429,
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: 60
      });
      return;
    }
  });
  
  await server.register(swagger, {
    openapi: {
      info: { title: 'Open TMS API', version: '0.1.0' }
    }
  });
  await server.register(swaggerUI, { routePrefix: '/docs' });

  // Health check
  server.get('/health', async () => ({ status: 'ok' }));

  // Customers CRUD
  server.get('/api/v1/customers', async (_req: FastifyRequest, _reply: FastifyReply) => {
    return { data: customers.filter(c => !c.archived), error: null };
  });

  server.post('/api/v1/customers', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({ 
      name: z.string().min(1), 
      contactEmail: z.string().email().optional() 
    }).parse((req as any).body);
    
    const newCustomer = {
      id: String(customers.length + 1),
      name: body.name,
      contactEmail: body.contactEmail,
      archived: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    customers.push(newCustomer);
    
    reply.code(201);
    return { data: newCustomer, error: null };
  });

  server.get('/api/v1/customers/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const customer = customers.find(c => c.id === id && !c.archived);
    if (!customer) {
      reply.code(404);
      return { data: null, error: 'Customer not found' };
    }
    return { data: customer, error: null };
  });

  server.put('/api/v1/customers/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = z.object({ 
      name: z.string().min(1).optional(), 
      contactEmail: z.string().email().optional() 
    }).parse((req as any).body);
    
    const customerIndex = customers.findIndex(c => c.id === id && !c.archived);
    if (customerIndex === -1) {
      reply.code(404);
      return { data: null, error: 'Customer not found' };
    }
    
    customers[customerIndex] = { ...customers[customerIndex], ...body, updatedAt: new Date() };
    return { data: customers[customerIndex], error: null };
  });

  server.delete('/api/v1/customers/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const customerIndex = customers.findIndex(c => c.id === id && !c.archived);
    if (customerIndex === -1) {
      reply.code(404);
      return { data: null, error: 'Customer not found' };
    }
    
    customers[customerIndex] = { ...customers[customerIndex], archived: true, archivedAt: new Date() };
    return { data: customers[customerIndex], error: null };
  });

  // Locations CRUD
  server.get('/api/v1/locations', async (_req: FastifyRequest, _reply: FastifyReply) => {
    return { data: locations.filter(l => !l.archived), error: null };
  });

  server.post('/api/v1/locations', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z
      .object({
        name: z.string().min(1),
        address1: z.string().min(1),
        address2: z.string().optional(),
        city: z.string().min(1),
        state: z.string().optional(),
        postalCode: z.string().optional(),
        country: z.string().min(2),
        lat: z.number().optional(),
        lng: z.number().optional()
      })
      .parse((req as any).body);
    
    const newLocation = {
      id: String(locations.length + 1),
      ...body,
      archived: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    locations.push(newLocation);
    
    reply.code(201);
    return { data: newLocation, error: null };
  });

  server.get('/api/v1/locations/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const location = locations.find(l => l.id === id && !l.archived);
    if (!location) {
      reply.code(404);
      return { data: null, error: 'Location not found' };
    }
    return { data: location, error: null };
  });

  server.put('/api/v1/locations/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      name: z.string().min(1).optional(),
      address1: z.string().min(1).optional(),
      address2: z.string().optional(),
      city: z.string().min(1).optional(),
      state: z.string().optional(),
      postalCode: z.string().optional(),
      country: z.string().min(2).optional(),
      lat: z.number().optional(),
      lng: z.number().optional()
    }).parse((req as any).body);
    
    const locationIndex = locations.findIndex(l => l.id === id && !l.archived);
    if (locationIndex === -1) {
      reply.code(404);
      return { data: null, error: 'Location not found' };
    }
    
    locations[locationIndex] = { ...locations[locationIndex], ...body, updatedAt: new Date() };
    return { data: locations[locationIndex], error: null };
  });

  server.delete('/api/v1/locations/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const locationIndex = locations.findIndex(l => l.id === id && !l.archived);
    if (locationIndex === -1) {
      reply.code(404);
      return { data: null, error: 'Location not found' };
    }
    
    locations[locationIndex] = { ...locations[locationIndex], archived: true, archivedAt: new Date() };
    return { data: locations[locationIndex], error: null };
  });

  // Shipments CRUD
  server.get('/api/v1/shipments', async (_req: FastifyRequest, _reply: FastifyReply) => {
    const shipmentsWithRelations = shipments
      .filter(s => !s.archived)
      .map(shipment => ({
        ...shipment,
        customer: customers.find(c => c.id === shipment.customerId),
        origin: locations.find(l => l.id === shipment.originId),
        destination: locations.find(l => l.id === shipment.destinationId)
      }));
    return { data: shipmentsWithRelations, error: null };
  });

  server.post('/api/v1/shipments', async (req: FastifyRequest, reply: FastifyReply) => {
    const schema = z.object({
      reference: z.string().min(1),
      customerId: z.string(),
      originId: z.string(),
      destinationId: z.string(),
      pickupDate: z.string().datetime().optional(),
      deliveryDate: z.string().datetime().optional(),
      items: z.array(z.object({ 
        sku: z.string(), 
        description: z.string().optional(), 
        quantity: z.number().int().positive(), 
        weightKg: z.number().nonnegative().optional(), 
        volumeM3: z.number().nonnegative().optional() 
      })).default([])
    });
    const body = schema.parse((req as any).body);
    
    const newShipment = {
      id: String(shipments.length + 1),
      ...body,
      status: 'draft',
      archived: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    shipments.push(newShipment);
    
    reply.code(201);
    return { data: newShipment, error: null };
  });

  server.get('/api/v1/shipments/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const shipment = shipments.find(s => s.id === id && !s.archived);
    if (!shipment) {
      reply.code(404);
      return { data: null, error: 'Shipment not found' };
    }
    
    const shipmentWithRelations = {
      ...shipment,
      customer: customers.find(c => c.id === shipment.customerId),
      origin: locations.find(l => l.id === shipment.originId),
      destination: locations.find(l => l.id === shipment.destinationId),
      loads: []
    };
    
    return { data: shipmentWithRelations, error: null };
  });

  server.put('/api/v1/shipments/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      reference: z.string().min(1).optional(),
      status: z.string().optional(),
      pickupDate: z.string().datetime().optional(),
      deliveryDate: z.string().datetime().optional(),
      customerId: z.string().optional(),
      originId: z.string().optional(),
      destinationId: z.string().optional(),
      items: z.array(z.object({ 
        sku: z.string(), 
        description: z.string().optional(), 
        quantity: z.number().int().positive(), 
        weightKg: z.number().nonnegative().optional(), 
        volumeM3: z.number().nonnegative().optional() 
      })).optional()
    }).parse((req as any).body);
    
    const shipmentIndex = shipments.findIndex(s => s.id === id && !s.archived);
    if (shipmentIndex === -1) {
      reply.code(404);
      return { data: null, error: 'Shipment not found' };
    }
    
    shipments[shipmentIndex] = { ...shipments[shipmentIndex], ...body, updatedAt: new Date() };
    return { data: shipments[shipmentIndex], error: null };
  });

  server.delete('/api/v1/shipments/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const shipmentIndex = shipments.findIndex(s => s.id === id && !s.archived);
    if (shipmentIndex === -1) {
      reply.code(404);
      return { data: null, error: 'Shipment not found' };
    }
    
    shipments[shipmentIndex] = { ...shipments[shipmentIndex], archived: true, archivedAt: new Date() };
    return { data: shipments[shipmentIndex], error: null };
  });

  // Seed data endpoint
  server.post('/api/v1/seed', async (_req: FastifyRequest, reply: FastifyReply) => {
    // Reset data
    customers = [
      { id: '1', name: 'Walmart Inc.', contactEmail: 'logistics@walmart.com', archived: false, createdAt: new Date(), updatedAt: new Date() },
      { id: '2', name: 'Best Buy Co. Inc.', contactEmail: 'supply@bestbuy.com', archived: false, createdAt: new Date(), updatedAt: new Date() },
      { id: '3', name: 'Target Corporation', contactEmail: 'operations@target.com', archived: false, createdAt: new Date(), updatedAt: new Date() },
      { id: '4', name: 'Amazon.com Inc.', contactEmail: 'fulfillment@amazon.com', archived: false, createdAt: new Date(), updatedAt: new Date() },
      { id: '5', name: 'Home Depot Inc.', contactEmail: 'distribution@homedepot.com', archived: false, createdAt: new Date(), updatedAt: new Date() }
    ];

    locations = [
      { id: '1', name: 'Head Office - Dallas', address1: '1234 Commerce Street', city: 'Dallas', state: 'Texas', postalCode: '75201', country: 'USA', lat: 32.7767, lng: -96.7970, archived: false, createdAt: new Date(), updatedAt: new Date() },
      { id: '2', name: 'Central Distribution Center - Chicago', address1: '5000 W 159th St', city: 'Chicago', state: 'Illinois', postalCode: '60477', country: 'USA', lat: 41.8781, lng: -87.6298, archived: false, createdAt: new Date(), updatedAt: new Date() },
      { id: '3', name: 'West Coast Hub - Los Angeles', address1: '12000 E 40th St', city: 'Los Angeles', state: 'California', postalCode: '90058', country: 'USA', lat: 34.0522, lng: -118.2437, archived: false, createdAt: new Date(), updatedAt: new Date() },
      { id: '4', name: 'Northeast Distribution - New York', address1: '1000 6th Ave', city: 'New York', state: 'New York', postalCode: '10018', country: 'USA', lat: 40.7128, lng: -74.0060, archived: false, createdAt: new Date(), updatedAt: new Date() },
      { id: '5', name: 'Southeast Warehouse - Atlanta', address1: '2000 Peachtree Rd', city: 'Atlanta', state: 'Georgia', postalCode: '30309', country: 'USA', lat: 33.7490, lng: -84.3880, archived: false, createdAt: new Date(), updatedAt: new Date() }
    ];

    shipments = [
      { id: '1', reference: 'SH-0001', status: 'in_transit', customerId: '1', originId: '1', destinationId: '2', items: [{ sku: 'ITEM-001', description: 'Product 1', quantity: 10, weightKg: 5, volumeM3: 1 }], archived: false, createdAt: new Date(), updatedAt: new Date() },
      { id: '2', reference: 'SH-0002', status: 'delivered', customerId: '2', originId: '2', destinationId: '3', items: [{ sku: 'ITEM-002', description: 'Product 2', quantity: 5, weightKg: 3, volumeM3: 0.5 }], archived: false, createdAt: new Date(), updatedAt: new Date() },
      { id: '3', reference: 'SH-0003', status: 'draft', customerId: '3', originId: '3', destinationId: '4', items: [{ sku: 'ITEM-003', description: 'Product 3', quantity: 8, weightKg: 4, volumeM3: 0.8 }], archived: false, createdAt: new Date(), updatedAt: new Date() }
    ];

    reply.code(201);
    return { 
      data: { 
        message: 'Database seeded successfully',
        customers: customers.length,
        locations: locations.length,
        shipments: shipments.length
      }, 
      error: null 
    };
  });

  // Start the server
  const port = Number(process.env.PORT || 3001);
  await server.listen({ port, host: '0.0.0.0' });
  server.log.info(`API running on :${port}`);
}

// Start the application
start().catch((err) => {
  server.log.error(err);
  process.exit(1);
});
