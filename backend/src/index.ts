import Fastify, { FastifyReply, FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import { z } from 'zod';
import prismaPlugin from './plugins/prisma.js';
import { DistanceService } from './services/distanceService.js';

const server = Fastify({ logger: true });

async function start() {
await server.register(cors, { origin: true });
await server.register(swagger, {
  openapi: {
    info: { title: 'Open TMS API', version: '0.1.0' }
  }
});
await server.register(swaggerUI, { routePrefix: '/docs' });
await server.register(prismaPlugin);

server.get('/health', async () => ({ status: 'ok' }));

// Customers CRUD
server.get('/api/v1/customers', async (_req: FastifyRequest, _reply: FastifyReply) => {
    const customers = await server.prisma.customer.findMany({ 
      where: { archived: false },
      orderBy: { createdAt: 'desc' } 
    });
  return { data: customers, error: null };
});

server.post('/api/v1/customers', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({ 
      name: z.string().min(1), 
      contactEmail: z.string().email().optional() 
    }).parse((req as any).body);
  const created = await server.prisma.customer.create({ data: body });
  reply.code(201);
  return { data: created, error: null };
});

  server.get('/api/v1/customers/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const customer = await server.prisma.customer.findFirst({
      where: { id, archived: false }
    });
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
    
    const customer = await server.prisma.customer.findFirst({
      where: { id, archived: false }
    });
    if (!customer) {
      reply.code(404);
      return { data: null, error: 'Customer not found' };
    }
    
    const updated = await server.prisma.customer.update({
      where: { id },
      data: body
    });
    return { data: updated, error: null };
  });

  server.delete('/api/v1/customers/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    
    const customer = await server.prisma.customer.findFirst({
      where: { id, archived: false }
    });
    if (!customer) {
      reply.code(404);
      return { data: null, error: 'Customer not found' };
    }
    
    const archived = await server.prisma.customer.update({
      where: { id },
      data: { 
        archived: true, 
        archivedAt: new Date() 
      }
    });
    return { data: archived, error: null };
  });

// Carriers CRUD
server.get('/api/v1/carriers', async (_req: FastifyRequest, _reply: FastifyReply) => {
  const carriers = await server.prisma.carrier.findMany({ 
    orderBy: { name: 'asc' } 
  });
  return { data: carriers, error: null };
});

server.get('/api/v1/carriers/:id', async (req: FastifyRequest, reply: FastifyReply) => {
  const { id } = req.params as { id: string };
  const carrier = await server.prisma.carrier.findUnique({
    where: { id }
  });
  if (!carrier) {
    reply.code(404);
    return { data: null, error: 'Carrier not found' };
  }
  return { data: carrier, error: null };
});

server.post('/api/v1/carriers', async (req: FastifyRequest, reply: FastifyReply) => {
  const body = z
    .object({
      name: z.string().min(1),
      mcNumber: z.string().optional(),
      dotNumber: z.string().optional()
    })
    .parse((req as any).body);
  const created = await server.prisma.carrier.create({ data: body });
  reply.code(201);
  return { data: created, error: null };
});

server.put('/api/v1/carriers/:id', async (req: FastifyRequest, reply: FastifyReply) => {
  const { id } = req.params as { id: string };
  const body = z.object({
    name: z.string().min(1).optional(),
    mcNumber: z.string().optional(),
    dotNumber: z.string().optional()
  }).parse((req as any).body);
  
  const carrier = await server.prisma.carrier.findUnique({
    where: { id }
  });
  if (!carrier) {
    reply.code(404);
    return { data: null, error: 'Carrier not found' };
  }
  
  const updated = await server.prisma.carrier.update({
    where: { id },
    data: body
  });
  return { data: updated, error: null };
});

server.delete('/api/v1/carriers/:id', async (req: FastifyRequest, reply: FastifyReply) => {
  const { id } = req.params as { id: string };
  
  const carrier = await server.prisma.carrier.findUnique({
    where: { id }
  });
  if (!carrier) {
    reply.code(404);
    return { data: null, error: 'Carrier not found' };
  }
  
  await server.prisma.carrier.delete({
    where: { id }
  });
  reply.code(204);
  return { data: null, error: null };
});

// Locations CRUD
server.get('/api/v1/locations', async (_req: FastifyRequest, _reply: FastifyReply) => {
    const locations = await server.prisma.location.findMany({ 
      where: { archived: false },
      orderBy: { name: 'asc' } 
    });
  return { data: locations, error: null };
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
  const created = await server.prisma.location.create({ data: body });
  reply.code(201);
  return { data: created, error: null };
});

  server.get('/api/v1/locations/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const location = await server.prisma.location.findFirst({
      where: { id, archived: false }
    });
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
    
    const location = await server.prisma.location.findFirst({
      where: { id, archived: false }
    });
    if (!location) {
      reply.code(404);
      return { data: null, error: 'Location not found' };
    }
    
    const updated = await server.prisma.location.update({
      where: { id },
      data: body
    });
    return { data: updated, error: null };
  });

  // Location search endpoint
  server.get('/api/v1/locations/search', async (req: FastifyRequest, reply: FastifyReply) => {
    const { q } = req.query as { q?: string };
    
    if (!q || q.trim().length < 2) {
      return { data: [], error: null };
    }

    const searchTerm = q.trim().toLowerCase();
    
    const locations = await server.prisma.location.findMany({
      where: {
        archived: false,
        OR: [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { city: { contains: searchTerm, mode: 'insensitive' } },
          { state: { contains: searchTerm, mode: 'insensitive' } },
          { country: { contains: searchTerm, mode: 'insensitive' } },
          { address1: { contains: searchTerm, mode: 'insensitive' } },
          { postalCode: { contains: searchTerm, mode: 'insensitive' } }
        ]
      },
      orderBy: [
        { name: 'asc' },
        { city: 'asc' }
      ],
      take: 20 // Limit results for performance
    });

    return { data: locations, error: null };
  });

  server.delete('/api/v1/locations/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    
    const location = await server.prisma.location.findFirst({
      where: { id, archived: false }
    });
    if (!location) {
      reply.code(404);
      return { data: null, error: 'Location not found' };
    }
    
    const archived = await server.prisma.location.update({
      where: { id },
      data: { 
        archived: true, 
        archivedAt: new Date() 
      }
    });
    return { data: archived, error: null };
  });

  // Shipments CRUD
server.get('/api/v1/shipments', async (_req: FastifyRequest, _reply: FastifyReply) => {
    const shipments = await server.prisma.shipment.findMany({ 
      where: { archived: false },
      include: { 
        customer: true, 
        origin: true, 
        destination: true,
        lane: {
          include: {
            origin: true,
            destination: true
          }
        }
      }, 
      orderBy: { createdAt: 'desc' } 
    });
  return { data: shipments, error: null };
});

  server.post('/api/v1/shipments', async (req: FastifyRequest, reply: FastifyReply) => {
  const schema = z.object({
    reference: z.string().min(1),
    customerId: z.string().uuid(),
    laneId: z.string().uuid().optional(),
    originId: z.string().uuid().optional(),
    destinationId: z.string().uuid().optional(),
    pickupDate: z.string().datetime().optional(),
    deliveryDate: z.string().datetime().optional(),
      items: z.array(z.object({ 
        sku: z.string(), 
        description: z.string().optional(), 
        quantity: z.number().int().positive(), 
        weightKg: z.number().nonnegative().optional(), 
        volumeM3: z.number().nonnegative().optional() 
      })).default([])
  }).refine((data) => {
    // Either laneId OR (originId AND destinationId) must be provided
    return (data.laneId && !data.originId && !data.destinationId) || 
           (!data.laneId && data.originId && data.destinationId);
  }, {
    message: "Either laneId or both originId and destinationId must be provided"
  });
  
  const body = schema.parse((req as any).body);
  
  // If laneId is provided, get the lane's origin and destination
  let finalOriginId = body.originId;
  let finalDestinationId = body.destinationId;
  
  if (body.laneId) {
    const lane = await server.prisma.lane.findFirst({
      where: { id: body.laneId, archived: false },
      include: { origin: true, destination: true }
    });
    
    if (!lane) {
      reply.code(400);
      return { data: null, error: 'Lane not found' };
    }
    
    finalOriginId = lane.originId;
    finalDestinationId = lane.destinationId;
  }
  
  const created = await server.prisma.shipment.create({ 
    data: { 
      ...body, 
      originId: finalOriginId!,
      destinationId: finalDestinationId!,
      status: 'draft' 
    },
    include: {
      customer: true,
      origin: true,
      destination: true,
      lane: body.laneId ? { include: { origin: true, destination: true } } : false
    }
  });
    reply.code(201);
  return { data: created, error: null };
});

  server.get('/api/v1/shipments/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const shipment = await server.prisma.shipment.findFirst({
      where: { id, archived: false },
      include: { 
        customer: true, 
        origin: true, 
        destination: true,
        lane: {
          include: {
            origin: true,
            destination: true,
            stops: {
              include: {
                location: true
              },
              orderBy: {
                order: 'asc'
              }
            }
          }
        },
        loads: {
          include: {
            vehicle: true,
            driver: true
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

  server.put('/api/v1/shipments/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      reference: z.string().min(1).optional(),
      status: z.string().optional(),
      pickupDate: z.string().datetime().optional(),
      deliveryDate: z.string().datetime().optional(),
      customerId: z.string().uuid().optional(),
      laneId: z.string().uuid().optional(),
      originId: z.string().uuid().optional(),
      destinationId: z.string().uuid().optional(),
      items: z.array(z.object({ 
        sku: z.string(), 
        description: z.string().optional(), 
        quantity: z.number().int().positive(), 
        weightKg: z.number().nonnegative().optional(), 
        volumeM3: z.number().nonnegative().optional() 
      })).optional()
    }).refine((data) => {
      // If any route fields are provided, validate the combination
      const hasRouteFields = data.laneId !== undefined || data.originId !== undefined || data.destinationId !== undefined;
      if (!hasRouteFields) return true; // No route changes
      
      // Either laneId OR (originId AND destinationId) must be provided
      return (data.laneId && !data.originId && !data.destinationId) || 
             (!data.laneId && data.originId && data.destinationId);
    }, {
      message: "Either laneId or both originId and destinationId must be provided"
    }).parse((req as any).body);
    
    const shipment = await server.prisma.shipment.findFirst({
      where: { id, archived: false }
    });
    if (!shipment) {
      reply.code(404);
      return { data: null, error: 'Shipment not found' };
    }
    
    // Prepare update data
    const updateData: any = { ...body };
    
    // If laneId is provided, get the lane's origin and destination
    if (body.laneId) {
      const lane = await server.prisma.lane.findFirst({
        where: { id: body.laneId, archived: false },
        include: { origin: true, destination: true }
      });
      
      if (!lane) {
        reply.code(400);
        return { data: null, error: 'Lane not found' };
      }
      
      updateData.originId = lane.originId;
      updateData.destinationId = lane.destinationId;
    }
    
    const updated = await server.prisma.shipment.update({
      where: { id },
      data: updateData,
      include: {
        customer: true,
        origin: true,
        destination: true,
        lane: updateData.laneId ? { include: { origin: true, destination: true } } : false
      }
    });
    return { data: updated, error: null };
  });

  server.delete('/api/v1/shipments/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    
    const shipment = await server.prisma.shipment.findFirst({
      where: { id, archived: false }
    });
    if (!shipment) {
      reply.code(404);
      return { data: null, error: 'Shipment not found' };
    }
    
    const archived = await server.prisma.shipment.update({
      where: { id },
      data: { 
        archived: true, 
        archivedAt: new Date() 
      }
    });
    return { data: archived, error: null };
  });

  // Lanes CRUD
  server.get('/api/v1/lanes', async (_req: FastifyRequest, _reply: FastifyReply) => {
    const lanes = await server.prisma.lane.findMany({
      where: { archived: false },
      include: {
        origin: true,
        destination: true,
        stops: {
          include: { location: true },
          orderBy: { order: 'asc' }
        },
        customerLanes: {
          include: { customer: true }
        },
        laneCarriers: {
          include: { carrier: true }
        }
      },
      orderBy: { name: 'asc' }
    });
    return { data: lanes, error: null };
  });

  server.post('/api/v1/lanes', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z
      .object({
        originId: z.string().uuid(),
        destinationId: z.string().uuid(),
        distance: z.number().positive().optional(),
        notes: z.string().optional(),
        stops: z.array(z.object({
          locationId: z.string().uuid(),
          order: z.number().int().positive(),
          notes: z.string().optional()
        })).optional().default([])
      })
      .parse((req as any).body);

    // Validate that stops don't include origin or destination
    const stopLocationIds = body.stops.map(stop => stop.locationId);
    if (stopLocationIds.includes(body.originId) || stopLocationIds.includes(body.destinationId)) {
      reply.code(400);
      return { data: null, error: 'Stops cannot include the origin or destination locations' };
    }

    // Validate stop orders are sequential and unique
    const orders = body.stops.map(stop => stop.order).sort((a, b) => a - b);
    for (let i = 0; i < orders.length; i++) {
      if (orders[i] !== i + 1) {
        reply.code(400);
        return { data: null, error: 'Stop orders must be sequential starting from 1 (1, 2, 3, ...)' };
      }
    }

    // Get origin and destination to generate lane name
    const [origin, destination] = await Promise.all([
      server.prisma.location.findUnique({ where: { id: body.originId } }),
      server.prisma.location.findUnique({ where: { id: body.destinationId } })
    ]);

    if (!origin || !destination) {
      reply.code(400);
      return { data: null, error: 'Origin or destination location not found' };
    }

    // Validate that all stop locations exist
    if (body.stops.length > 0) {
      const stopLocations = await server.prisma.location.findMany({
        where: {
          id: { in: stopLocationIds },
          archived: false
        }
      });

      if (stopLocations.length !== stopLocationIds.length) {
        reply.code(400);
        return { data: null, error: 'One or more stop locations not found or are archived' };
      }
    }

    const laneName = `${origin.city} → ${destination.city}`;

    // Create lane with stops in a transaction
    const created = await server.prisma.$transaction(async (tx) => {
      // Create the lane
      const lane = await tx.lane.create({
        data: {
          originId: body.originId,
          destinationId: body.destinationId,
          distance: body.distance,
          notes: body.notes,
          name: laneName
        }
      });

      // Create stops if any
      if (body.stops.length > 0) {
        await tx.laneStop.createMany({
          data: body.stops.map(stop => ({
            laneId: lane.id,
            locationId: stop.locationId,
            order: stop.order,
            notes: stop.notes
          }))
        });
      }

      // Return the complete lane with relationships
      return await tx.lane.findUnique({
        where: { id: lane.id },
        include: {
          origin: true,
          destination: true,
          stops: {
            include: { location: true },
            orderBy: { order: 'asc' }
          }
        }
      });
    });

    reply.code(201);
    return { data: created, error: null };
  });

  server.get('/api/v1/lanes/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const lane = await server.prisma.lane.findFirst({
      where: { id, archived: false },
      include: {
        origin: true,
        destination: true,
        stops: {
          include: { location: true },
          orderBy: { order: 'asc' }
        },
        customerLanes: {
          include: { customer: true }
        },
        laneCarriers: {
          include: { carrier: true }
        }
      }
    });
    if (!lane) {
      reply.code(404);
      return { data: null, error: 'Lane not found' };
    }
    return { data: lane, error: null };
  });

  server.put('/api/v1/lanes/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      originId: z.string().uuid().optional(),
      destinationId: z.string().uuid().optional(),
      distance: z.number().positive().optional(),
      notes: z.string().optional(),
      status: z.string().optional(),
      stops: z.array(z.object({
        locationId: z.string().uuid(),
        order: z.number().int().positive(),
        notes: z.string().optional()
      })).optional()
    }).parse((req as any).body);

    const lane = await server.prisma.lane.findFirst({
      where: { id, archived: false }
    });
    if (!lane) {
      reply.code(404);
      return { data: null, error: 'Lane not found' };
    }

    // Validate stops if provided
    if (body.stops) {
      const finalOriginId = body.originId || lane.originId;
      const finalDestinationId = body.destinationId || lane.destinationId;

      // Validate that stops don't include origin or destination
      const stopLocationIds = body.stops.map(stop => stop.locationId);
      if (stopLocationIds.includes(finalOriginId) || stopLocationIds.includes(finalDestinationId)) {
        reply.code(400);
        return { data: null, error: 'Stops cannot include the origin or destination locations' };
      }

      // Validate stop orders are sequential and unique
      const orders = body.stops.map(stop => stop.order).sort((a, b) => a - b);
      for (let i = 0; i < orders.length; i++) {
        if (orders[i] !== i + 1) {
          reply.code(400);
          return { data: null, error: 'Stop orders must be sequential starting from 1 (1, 2, 3, ...)' };
        }
      }

      // Validate that all stop locations exist
      if (body.stops.length > 0) {
        const stopLocations = await server.prisma.location.findMany({
          where: {
            id: { in: stopLocationIds },
            archived: false
          }
        });

        if (stopLocations.length !== stopLocationIds.length) {
          reply.code(400);
          return { data: null, error: 'One or more stop locations not found or are archived' };
        }
      }
    }

    // If origin or destination is being updated, validate they exist
    if (body.originId || body.destinationId) {
      const [origin, destination] = await Promise.all([
        body.originId ? server.prisma.location.findUnique({ where: { id: body.originId } }) : null,
        body.destinationId ? server.prisma.location.findUnique({ where: { id: body.destinationId } }) : null
      ]);

      if (body.originId && !origin) {
        reply.code(400);
        return { data: null, error: 'Origin location not found' };
      }
      if (body.destinationId && !destination) {
        reply.code(400);
        return { data: null, error: 'Destination location not found' };
      }
    }

    // Update lane with stops in a transaction
    const updated = await server.prisma.$transaction(async (tx) => {
      // Prepare lane update data
      const updateData: any = {
        originId: body.originId,
        destinationId: body.destinationId,
        distance: body.distance,
        notes: body.notes,
        status: body.status
      };

      // Remove undefined values
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });

      // If origin or destination changed, update the lane name
      if (body.originId || body.destinationId) {
        const finalOriginId = body.originId || lane.originId;
        const finalDestinationId = body.destinationId || lane.destinationId;

        const [origin, destination] = await Promise.all([
          tx.location.findUnique({ where: { id: finalOriginId } }),
          tx.location.findUnique({ where: { id: finalDestinationId } })
        ]);

        if (origin && destination) {
          updateData.name = `${origin.city} → ${destination.city}`;
        }
      }

      // Update the lane
      await tx.lane.update({
        where: { id },
        data: updateData
      });

      // Update stops if provided
      if (body.stops !== undefined) {
        // Delete existing stops
        await tx.laneStop.deleteMany({
          where: { laneId: id }
        });

        // Create new stops if any
        if (body.stops.length > 0) {
          await tx.laneStop.createMany({
            data: body.stops.map(stop => ({
              laneId: id,
              locationId: stop.locationId,
              order: stop.order,
              notes: stop.notes
            }))
          });
        }
      }

      // Return the complete updated lane
      return await tx.lane.findUnique({
        where: { id },
        include: {
          origin: true,
          destination: true,
          stops: {
            include: { location: true },
            orderBy: { order: 'asc' }
          },
          customerLanes: {
            include: { customer: true }
          },
          laneCarriers: {
            include: { carrier: true }
          }
        }
      });
    });

    return { data: updated, error: null };
  });

  server.delete('/api/v1/lanes/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    
    const lane = await server.prisma.lane.findFirst({
      where: { id, archived: false }
    });
    if (!lane) {
      reply.code(404);
      return { data: null, error: 'Lane not found' };
    }
    
    const archived = await server.prisma.lane.update({
      where: { id },
      data: { 
        archived: true, 
        archivedAt: new Date() 
      }
    });
    return { data: archived, error: null };
  });

  // Customer-Lane relationships
  server.post('/api/v1/lanes/:id/customers', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      customerId: z.string().uuid()
    }).parse((req as any).body);

    const lane = await server.prisma.lane.findFirst({
      where: { id, archived: false }
    });
    if (!lane) {
      reply.code(404);
      return { data: null, error: 'Lane not found' };
    }

    const customer = await server.prisma.customer.findFirst({
      where: { id: body.customerId, archived: false }
    });
    if (!customer) {
      reply.code(404);
      return { data: null, error: 'Customer not found' };
    }

    const customerLane = await server.prisma.customerLane.create({
      data: {
        laneId: id,
        customerId: body.customerId
      },
      include: {
        customer: true,
        lane: {
          include: { origin: true, destination: true }
        }
      }
    });

    reply.code(201);
    return { data: customerLane, error: null };
  });

  server.delete('/api/v1/lanes/:id/customers/:customerId', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id, customerId } = req.params as { id: string; customerId: string };
    
    const customerLane = await server.prisma.customerLane.findFirst({
      where: { laneId: id, customerId }
    });
    if (!customerLane) {
      reply.code(404);
      return { data: null, error: 'Customer-lane relationship not found' };
    }

    await server.prisma.customerLane.delete({
      where: { id: customerLane.id }
    });

    return { data: { message: 'Customer removed from lane' }, error: null };
  });

  // Lane-Carrier relationships
  server.post('/api/v1/lanes/:id/carriers', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      carrierId: z.string().uuid(),
      price: z.number().positive().optional(),
      currency: z.string().optional(),
      serviceLevel: z.string().optional(),
      notes: z.string().optional()
    }).parse((req as any).body);

    const lane = await server.prisma.lane.findFirst({
      where: { id, archived: false }
    });
    if (!lane) {
      reply.code(404);
      return { data: null, error: 'Lane not found' };
    }

    const carrier = await server.prisma.carrier.findUnique({
      where: { id: body.carrierId }
    });
    if (!carrier) {
      reply.code(404);
      return { data: null, error: 'Carrier not found' };
    }

    const laneCarrier = await server.prisma.laneCarrier.create({
      data: {
        laneId: id,
        carrierId: body.carrierId,
        price: body.price,
        currency: body.currency || 'USD',
        serviceLevel: body.serviceLevel,
        notes: body.notes
      },
      include: {
        carrier: true,
        lane: {
          include: { origin: true, destination: true }
        }
      }
    });

    reply.code(201);
    return { data: laneCarrier, error: null };
  });

  server.put('/api/v1/lanes/:id/carriers/:carrierId', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id, carrierId } = req.params as { id: string; carrierId: string };
    const body = z.object({
      price: z.number().positive().optional(),
      currency: z.string().optional(),
      serviceLevel: z.string().optional(),
      notes: z.string().optional()
    }).parse((req as any).body);

    const laneCarrier = await server.prisma.laneCarrier.findFirst({
      where: { laneId: id, carrierId }
    });
    if (!laneCarrier) {
      reply.code(404);
      return { data: null, error: 'Lane-carrier relationship not found' };
    }

    const updated = await server.prisma.laneCarrier.update({
      where: { id: laneCarrier.id },
      data: body,
      include: {
        carrier: true,
        lane: {
          include: { origin: true, destination: true }
        }
      }
    });

    return { data: updated, error: null };
  });

  server.delete('/api/v1/lanes/:id/carriers/:carrierId', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id, carrierId } = req.params as { id: string; carrierId: string };
    
    const laneCarrier = await server.prisma.laneCarrier.findFirst({
      where: { laneId: id, carrierId }
    });
    if (!laneCarrier) {
      reply.code(404);
      return { data: null, error: 'Lane-carrier relationship not found' };
    }

    await server.prisma.laneCarrier.delete({
      where: { id: laneCarrier.id }
    });

    return { data: { message: 'Carrier removed from lane' }, error: null };
  });

  // Seed data endpoint
  server.post('/api/v1/seed', async (_req: FastifyRequest, reply: FastifyReply) => {
    try {
      // Clear existing data
      await server.prisma.shipment.deleteMany();
      await server.prisma.location.deleteMany();
      await server.prisma.customer.deleteMany();

      // Create customers
      const customers = await server.prisma.customer.createMany({
        data: [
          { name: 'Walmart Inc.', contactEmail: 'logistics@walmart.com' },
          { name: 'Best Buy Co. Inc.', contactEmail: 'supply@bestbuy.com' },
          { name: 'Target Corporation', contactEmail: 'operations@target.com' },
          { name: 'Amazon.com Inc.', contactEmail: 'fulfillment@amazon.com' },
          { name: 'Home Depot Inc.', contactEmail: 'distribution@homedepot.com' },
          { name: 'Lowe\'s Companies Inc.', contactEmail: 'logistics@lowes.com' },
          { name: 'Costco Wholesale Corporation', contactEmail: 'supply@costco.com' },
          { name: 'Kroger Company', contactEmail: 'distribution@kroger.com' },
          { name: 'CVS Health Corporation', contactEmail: 'logistics@cvs.com' },
          { name: 'Walgreens Boots Alliance', contactEmail: 'supply@walgreens.com' }
        ]
      });

      // Create locations (20 warehouses/distribution centers + real Walmart/Best Buy locations)
      const locations = await server.prisma.location.createMany({
        data: [
          // Head Office - Dallas, Texas
          {
            name: 'Head Office - Dallas',
            address1: '1234 Commerce Street',
            city: 'Dallas',
            state: 'Texas',
            postalCode: '75201',
            country: 'USA',
            lat: 32.7767,
            lng: -96.7970
          },
          // Warehouses and Distribution Centers (20)
          {
            name: 'Central Distribution Center - Chicago',
            address1: '5000 W 159th St',
            city: 'Chicago',
            state: 'Illinois',
            postalCode: '60477',
            country: 'USA',
            lat: 41.8781,
            lng: -87.6298
          },
          {
            name: 'West Coast Hub - Los Angeles',
            address1: '12000 E 40th St',
            city: 'Los Angeles',
            state: 'California',
            postalCode: '90058',
            country: 'USA',
            lat: 34.0522,
            lng: -118.2437
          },
          {
            name: 'Northeast Distribution - New York',
            address1: '1000 6th Ave',
            city: 'New York',
            state: 'New York',
            postalCode: '10018',
            country: 'USA',
            lat: 40.7128,
            lng: -74.0060
          },
          {
            name: 'Southeast Warehouse - Atlanta',
            address1: '2000 Peachtree Rd',
            city: 'Atlanta',
            state: 'Georgia',
            postalCode: '30309',
            country: 'USA',
            lat: 33.7490,
            lng: -84.3880
          },
          {
            name: 'Midwest Logistics Center - Kansas City',
            address1: '3000 Main St',
            city: 'Kansas City',
            state: 'Missouri',
            postalCode: '64111',
            country: 'USA',
            lat: 39.0997,
            lng: -94.5786
          },
          {
            name: 'Southwest Distribution - Phoenix',
            address1: '4000 N Central Ave',
            city: 'Phoenix',
            state: 'Arizona',
            postalCode: '85012',
            country: 'USA',
            lat: 33.4484,
            lng: -112.0740
          },
          {
            name: 'Phoenix DC - Distribution Center',
            address1: '2500 W Buckeye Rd',
            city: 'Phoenix',
            state: 'Arizona',
            postalCode: '85009',
            country: 'USA',
            lat: 33.4484,
            lng: -112.0740
          },
          {
            name: 'Northwest Hub - Seattle',
            address1: '5000 1st Ave S',
            city: 'Seattle',
            state: 'Washington',
            postalCode: '98134',
            country: 'USA',
            lat: 47.6062,
            lng: -122.3321
          },
          {
            name: 'Rocky Mountain Distribution - Denver',
            address1: '6000 E Colfax Ave',
            city: 'Denver',
            state: 'Colorado',
            postalCode: '80220',
            country: 'USA',
            lat: 39.7392,
            lng: -104.9903
          },
          {
            name: 'Gulf Coast Warehouse - Houston',
            address1: '7000 Main St',
            city: 'Houston',
            state: 'Texas',
            postalCode: '77002',
            country: 'USA',
            lat: 29.7604,
            lng: -95.3698
          },
          {
            name: 'Great Lakes Distribution - Detroit',
            address1: '8000 Woodward Ave',
            city: 'Detroit',
            state: 'Michigan',
            postalCode: '48201',
            country: 'USA',
            lat: 42.3314,
            lng: -83.0458
          },
          {
            name: 'Pacific Northwest Hub - Portland',
            address1: '9000 SW 5th Ave',
            city: 'Portland',
            state: 'Oregon',
            postalCode: '97204',
            country: 'USA',
            lat: 45.5152,
            lng: -122.6784
          },
          {
            name: 'Walmart Supercenter - Portland',
            address1: '4200 SE 82nd Ave',
            city: 'Portland',
            state: 'Oregon',
            postalCode: '97266',
            country: 'USA',
            lat: 45.5152,
            lng: -122.6784
          },
          {
            name: 'Southeast Logistics - Miami',
            address1: '10000 Biscayne Blvd',
            city: 'Miami',
            state: 'Florida',
            postalCode: '33132',
            country: 'USA',
            lat: 25.7617,
            lng: -80.1918
          },
          {
            name: 'Central Plains Distribution - Omaha',
            address1: '11000 Dodge St',
            city: 'Omaha',
            state: 'Nebraska',
            postalCode: '68102',
            country: 'USA',
            lat: 41.2565,
            lng: -95.9345
          },
          {
            name: 'Desert Southwest Hub - Las Vegas',
            address1: '12000 Las Vegas Blvd',
            city: 'Las Vegas',
            state: 'Nevada',
            postalCode: '89101',
            country: 'USA',
            lat: 36.1699,
            lng: -115.1398
          },
          {
            name: 'Appalachian Distribution - Nashville',
            address1: '13000 Broadway',
            city: 'Nashville',
            state: 'Tennessee',
            postalCode: '37203',
            country: 'USA',
            lat: 36.1627,
            lng: -86.7816
          },
          {
            name: 'Great Plains Logistics - Oklahoma City',
            address1: '14000 N Lincoln Blvd',
            city: 'Oklahoma City',
            state: 'Oklahoma',
            postalCode: '73105',
            country: 'USA',
            lat: 35.4676,
            lng: -97.5164
          },
          {
            name: 'Mountain West Distribution - Salt Lake City',
            address1: '15000 S State St',
            city: 'Salt Lake City',
            state: 'Utah',
            postalCode: '84115',
            country: 'USA',
            lat: 40.7608,
            lng: -111.8910
          },
          {
            name: 'Upper Midwest Hub - Minneapolis',
            address1: '16000 Nicollet Mall',
            city: 'Minneapolis',
            state: 'Minnesota',
            postalCode: '55403',
            country: 'USA',
            lat: 44.9778,
            lng: -93.2650
          },
          {
            name: 'New England Distribution - Boston',
            address1: '17000 Boylston St',
            city: 'Boston',
            state: 'Massachusetts',
            postalCode: '02115',
            country: 'USA',
            lat: 42.3398,
            lng: -71.0882
          },
          {
            name: 'Mid-Atlantic Logistics - Philadelphia',
            address1: '18000 Market St',
            city: 'Philadelphia',
            state: 'Pennsylvania',
            postalCode: '19107',
            country: 'USA',
            lat: 39.9526,
            lng: -75.1652
          },
          {
            name: 'Deep South Distribution - New Orleans',
            address1: '19000 Canal St',
            city: 'New Orleans',
            state: 'Louisiana',
            postalCode: '70112',
            country: 'USA',
            lat: 29.9511,
            lng: -90.0715
          },
          // Real Walmart Locations (10 major stores)
          {
            name: 'Walmart Supercenter - Dallas',
            address1: '4000 E Mockingbird Ln',
            city: 'Dallas',
            state: 'Texas',
            postalCode: '75206',
            country: 'USA',
            lat: 32.7767,
            lng: -96.7970
          },
          {
            name: 'Walmart Supercenter - Los Angeles',
            address1: '6040 S Vermont Ave',
            city: 'Los Angeles',
            state: 'California',
            postalCode: '90044',
            country: 'USA',
            lat: 34.0522,
            lng: -118.2437
          },
          {
            name: 'Walmart Supercenter - New York',
            address1: '2500 Broadway',
            city: 'New York',
            state: 'New York',
            postalCode: '10025',
            country: 'USA',
            lat: 40.7128,
            lng: -74.0060
          },
          {
            name: 'Walmart Supercenter - Chicago',
            address1: '4650 W North Ave',
            city: 'Chicago',
            state: 'Illinois',
            postalCode: '60639',
            country: 'USA',
            lat: 41.8781,
            lng: -87.6298
          },
          {
            name: 'Walmart Supercenter - Houston',
            address1: '11111 Katy Fwy',
            city: 'Houston',
            state: 'Texas',
            postalCode: '77079',
            country: 'USA',
            lat: 29.7604,
            lng: -95.3698
          },
          {
            name: 'Walmart Supercenter - Phoenix',
            address1: '8080 N 19th Ave',
            city: 'Phoenix',
            state: 'Arizona',
            postalCode: '85021',
            country: 'USA',
            lat: 33.4484,
            lng: -112.0740
          },
          {
            name: 'Walmart Supercenter - Philadelphia',
            address1: '2200 S 67th St',
            city: 'Philadelphia',
            state: 'Pennsylvania',
            postalCode: '19142',
            country: 'USA',
            lat: 39.9526,
            lng: -75.1652
          },
          {
            name: 'Walmart Supercenter - San Antonio',
            address1: '5555 De Zavala Rd',
            city: 'San Antonio',
            state: 'Texas',
            postalCode: '78249',
            country: 'USA',
            lat: 29.4241,
            lng: -98.4936
          },
          {
            name: 'Walmart Supercenter - San Diego',
            address1: '3040 Market St',
            city: 'San Diego',
            state: 'California',
            postalCode: '92101',
            country: 'USA',
            lat: 32.7157,
            lng: -117.1611
          },
          {
            name: 'Walmart Supercenter - Jacksonville',
            address1: '8800 Beach Blvd',
            city: 'Jacksonville',
            state: 'Florida',
            postalCode: '32216',
            country: 'USA',
            lat: 30.3322,
            lng: -81.6557
          },
          // Real Best Buy Locations (10 major stores)
          {
            name: 'Best Buy - Dallas',
            address1: '11661 Preston Rd',
            city: 'Dallas',
            state: 'Texas',
            postalCode: '75230',
            country: 'USA',
            lat: 32.7767,
            lng: -96.7970
          },
          {
            name: 'Best Buy - Los Angeles',
            address1: '10820 W Pico Blvd',
            city: 'Los Angeles',
            state: 'California',
            postalCode: '90064',
            country: 'USA',
            lat: 34.0522,
            lng: -118.2437
          },
          {
            name: 'Best Buy - New York',
            address1: '517 86th St',
            city: 'New York',
            state: 'New York',
            postalCode: '10028',
            country: 'USA',
            lat: 40.7128,
            lng: -74.0060
          },
          {
            name: 'Best Buy - Chicago',
            address1: '1200 N Clark St',
            city: 'Chicago',
            state: 'Illinois',
            postalCode: '60610',
            country: 'USA',
            lat: 41.8781,
            lng: -87.6298
          },
          {
            name: 'Best Buy - Houston',
            address1: '5929 Westheimer Rd',
            city: 'Houston',
            state: 'Texas',
            postalCode: '77057',
            country: 'USA',
            lat: 29.7604,
            lng: -95.3698
          },
          {
            name: 'Best Buy - Phoenix',
            address1: '4730 E Cactus Rd',
            city: 'Phoenix',
            state: 'Arizona',
            postalCode: '85032',
            country: 'USA',
            lat: 33.4484,
            lng: -112.0740
          },
          {
            name: 'Best Buy - Atlanta',
            address1: '3500 Peachtree Rd NE',
            city: 'Atlanta',
            state: 'Georgia',
            postalCode: '30326',
            country: 'USA',
            lat: 33.7490,
            lng: -84.3880
          },
          {
            name: 'Best Buy - Miami',
            address1: '11401 NW 12th St',
            city: 'Miami',
            state: 'Florida',
            postalCode: '33172',
            country: 'USA',
            lat: 25.7617,
            lng: -80.1918
          },
          {
            name: 'Best Buy - Seattle',
            address1: '2800 SW Barton St',
            city: 'Seattle',
            state: 'Washington',
            postalCode: '98126',
            country: 'USA',
            lat: 47.6062,
            lng: -122.3321
          },
          {
            name: 'Best Buy - Denver',
            address1: '7800 E Hampden Ave',
            city: 'Denver',
            state: 'Colorado',
            postalCode: '80231',
            country: 'USA',
            lat: 39.7392,
            lng: -104.9903
          }
        ]
      });

      // Create realistic lane routes based on locations
      const allLocations = await server.prisma.location.findMany();
      
      // Group locations by city for easier reference
      const locationsByCity = allLocations.reduce((acc, location) => {
        if (!acc[location.city]) {
          acc[location.city] = [];
        }
        acc[location.city].push(location);
        return acc;
      }, {} as Record<string, typeof allLocations>);

      // Define major interstate routes (realistic trucking lanes)
      const majorRoutes = [
        // East Coast Corridor
        { from: 'New York', to: 'Philadelphia', distance: 95 },
        { from: 'Philadelphia', to: 'Atlanta', distance: 750 },
        { from: 'Atlanta', to: 'Miami', distance: 660 },
        { from: 'New York', to: 'Boston', distance: 215 },
        
        // I-95 Corridor
        { from: 'Boston', to: 'New York', distance: 215 },
        { from: 'New York', to: 'Philadelphia', distance: 95 },
        { from: 'Philadelphia', to: 'Atlanta', distance: 750 },
        { from: 'Atlanta', to: 'Jacksonville', distance: 350 },
        { from: 'Jacksonville', to: 'Miami', distance: 350 },
        
        // I-10 Corridor (Southern Route)
        { from: 'Los Angeles', to: 'Phoenix', distance: 370 },
        { from: 'Phoenix', to: 'San Antonio', distance: 870 },
        { from: 'San Antonio', to: 'Houston', distance: 200 },
        { from: 'Houston', to: 'New Orleans', distance: 350 },
        { from: 'New Orleans', to: 'Jacksonville', distance: 500 },
        
        // I-40 Corridor (Central Route)
        { from: 'Los Angeles', to: 'Phoenix', distance: 370 },
        { from: 'Phoenix', to: 'Oklahoma City', distance: 850 },
        { from: 'Oklahoma City', to: 'Nashville', distance: 650 },
        { from: 'Nashville', to: 'Atlanta', distance: 250 },
        
        // I-80 Corridor (Northern Route)
        { from: 'San Francisco', to: 'Salt Lake City', distance: 650 },
        { from: 'Salt Lake City', to: 'Denver', distance: 520 },
        { from: 'Denver', to: 'Chicago', distance: 920 },
        { from: 'Chicago', to: 'New York', distance: 790 },
        
        // I-35 Corridor (North-South Central)
        { from: 'Dallas', to: 'Oklahoma City', distance: 200 },
        { from: 'Oklahoma City', to: 'Kansas City', distance: 350 },
        { from: 'Kansas City', to: 'Minneapolis', distance: 400 },
        { from: 'Dallas', to: 'San Antonio', distance: 280 },
        { from: 'San Antonio', to: 'Houston', distance: 200 },
        
        // Regional Routes
        { from: 'Seattle', to: 'Denver', distance: 1020 },
        { from: 'Denver', to: 'Phoenix', distance: 600 },
        { from: 'Chicago', to: 'Minneapolis', distance: 400 },
        { from: 'Minneapolis', to: 'Denver', distance: 680 },
        { from: 'Atlanta', to: 'Nashville', distance: 250 },
        { from: 'Nashville', to: 'Chicago', distance: 470 },
        { from: 'Houston', to: 'Dallas', distance: 240 },
        { from: 'Dallas', to: 'Atlanta', distance: 800 },
        { from: 'Los Angeles', to: 'San Diego', distance: 120 },
        { from: 'San Francisco', to: 'Los Angeles', distance: 380 },
        { from: 'Miami', to: 'Atlanta', distance: 660 },
        { from: 'Jacksonville', to: 'Atlanta', distance: 350 },
        { from: 'New Orleans', to: 'Atlanta', distance: 470 },
        { from: 'Boston', to: 'Philadelphia', distance: 310 },
        { from: 'Philadelphia', to: 'New York', distance: 95 }
      ];

      // Create lanes from the route definitions
      const lanesToCreate = [];
      for (const route of majorRoutes) {
        const fromLocations = locationsByCity[route.from];
        const toLocations = locationsByCity[route.to];
        
        if (fromLocations && toLocations) {
          // Create lanes between different location types in each city
          for (const fromLocation of fromLocations) {
            for (const toLocation of toLocations) {
              if (fromLocation.id !== toLocation.id) {
                lanesToCreate.push({
                  name: `${fromLocation.city} → ${toLocation.city}`,
                  originId: fromLocation.id,
                  destinationId: toLocation.id,
                  distance: route.distance,
                  notes: `Major ${route.from} → ${route.to} route`
                });
              }
            }
          }
        }
      }

      // Add some additional regional and local routes
      const additionalRoutes = [
        // Texas Triangle
        { from: 'Dallas', to: 'Houston', distance: 240 },
        { from: 'Houston', to: 'San Antonio', distance: 200 },
        { from: 'San Antonio', to: 'Dallas', distance: 280 },
        
        // California Routes
        { from: 'Los Angeles', to: 'San Francisco', distance: 380 },
        { from: 'San Francisco', to: 'San Diego', distance: 500 },
        { from: 'Los Angeles', to: 'San Diego', distance: 120 },
        
        // Florida Routes
        { from: 'Miami', to: 'Jacksonville', distance: 350 },
        { from: 'Jacksonville', to: 'Atlanta', distance: 350 },
        
        // Midwest Routes
        { from: 'Chicago', to: 'Minneapolis', distance: 400 },
        { from: 'Minneapolis', to: 'Denver', distance: 680 },
        { from: 'Chicago', to: 'Nashville', distance: 470 },

        // Northeast Routes
        { from: 'Boston', to: 'New York', distance: 215 },
        { from: 'New York', to: 'Philadelphia', distance: 95 },
        { from: 'Philadelphia', to: 'Boston', distance: 310 },

        // Phoenix to Portland Route
        { from: 'Phoenix', to: 'Portland', distance: 1140 }
      ];

      for (const route of additionalRoutes) {
        const fromLocations = locationsByCity[route.from];
        const toLocations = locationsByCity[route.to];
        
        if (fromLocations && toLocations) {
          // Create one lane per city pair (not all combinations)
          const fromLocation = fromLocations[0]; // Take first location of each type
          const toLocation = toLocations[0];
          
          if (fromLocation.id !== toLocation.id) {
            lanesToCreate.push({
              name: `${fromLocation.city} → ${toLocation.city}`,
              originId: fromLocation.id,
              destinationId: toLocation.id,
              distance: route.distance,
              notes: `Regional ${route.from} → ${route.to} route`
            });
          }
        }
      }

      // Create all lanes
      if (lanesToCreate.length > 0) {
        await server.prisma.lane.createMany({
          data: lanesToCreate
        });
      }

      // Create some sample shipments
      const allCustomers = await server.prisma.customer.findMany();

      // Find Phoenix DC and Portland Walmart locations
      const phoenixDC = allLocations.find(loc => loc.name === 'Phoenix DC - Distribution Center');
      const portlandWalmart = allLocations.find(loc => loc.name === 'Walmart Supercenter - Portland');
      const walmartCustomer = allCustomers.find(customer => customer.name === 'Walmart Inc.');

      const sampleShipments = [];

      // Add specific Phoenix to Portland shipment
      if (phoenixDC && portlandWalmart && walmartCustomer) {
        sampleShipments.push({
          reference: 'SH-PHX-PDX-001',
          customerId: walmartCustomer.id,
          originId: phoenixDC.id,
          destinationId: portlandWalmart.id,
          status: 'in_transit',
          items: [
            {
              sku: 'WAL-ELEC-001',
              description: 'Electronics - Tablets and Accessories',
              quantity: 120,
              weightKg: 580,
              volumeM3: 12
            },
            {
              sku: 'WAL-HOME-002',
              description: 'Home Goods - Kitchen Appliances',
              quantity: 85,
              weightKg: 920,
              volumeM3: 18
            }
          ]
        });
      }

      // Add random shipments
      for (let i = 0; i < 14; i++) {
        const customer = allCustomers[Math.floor(Math.random() * allCustomers.length)];
        const origin = allLocations[Math.floor(Math.random() * allLocations.length)];
        const destination = allLocations[Math.floor(Math.random() * allLocations.length)];

        sampleShipments.push({
          reference: `SH-${String(i + 2).padStart(4, '0')}`,
          customerId: customer.id,
          originId: origin.id,
          destinationId: destination.id,
          status: ['draft', 'in_transit', 'delivered'][Math.floor(Math.random() * 3)],
          items: [
            {
              sku: `ITEM-${Math.floor(Math.random() * 1000)}`,
              description: `Product ${i + 2}`,
              quantity: Math.floor(Math.random() * 50) + 1,
              weightKg: Math.floor(Math.random() * 100) + 1,
              volumeM3: Math.floor(Math.random() * 10) + 1
            }
          ]
        });
      }

      await server.prisma.shipment.createMany({
        data: sampleShipments
      });

      // Get count of created lanes
      const laneCount = await server.prisma.lane.count();

      reply.code(201);
      return { 
        data: { 
          message: 'Database seeded successfully',
          customers: allCustomers.length,
          locations: allLocations.length,
          lanes: laneCount,
          shipments: sampleShipments.length
        }, 
        error: null 
      };
    } catch (error) {
      reply.code(500);
      return { data: null, error: 'Failed to seed database' };
    }
  });

  // Distance calculation endpoint
  server.post('/api/v1/distance/calculate', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      originId: z.string().uuid(),
      destinationId: z.string().uuid()
    }).parse((req as any).body);

    try {
      // Get locations from database
      const [origin, destination] = await Promise.all([
        server.prisma.location.findUnique({ where: { id: body.originId } }),
        server.prisma.location.findUnique({ where: { id: body.destinationId } })
      ]);

      if (!origin || !destination) {
        reply.code(404);
        return { data: null, error: 'Origin or destination location not found' };
      }

      // Check if both locations have coordinates
      if (!origin.lat || !origin.lng || !destination.lat || !destination.lng) {
        reply.code(400);
        return { 
          data: null, 
          error: 'Both locations must have latitude and longitude coordinates for distance calculation' 
        };
      }

      // Calculate distance using the service
      const result = await DistanceService.getDistance(origin, destination);

      return { data: result, error: null };
    } catch (error) {
      console.error('Distance calculation error:', error);
      reply.code(500);
      return { data: null, error: 'Failed to calculate distance' };
    }
  });

  // Start the server with automatic port retry
  const preferredPort = Number(process.env.PORT || 3001);
  let port = preferredPort;
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    try {
      await server.listen({ port, host: '0.0.0.0' });
      server.log.info(`API running on http://localhost:${port}`);
      if (port !== preferredPort) {
        server.log.warn(`Port ${preferredPort} was unavailable, using port ${port} instead`);
        server.log.warn(`Update VITE_API_URL in frontend/.env to: http://localhost:${port}`);
      }
      break;
    } catch (err: any) {
      if (err.code === 'EADDRINUSE') {
        attempts++;
        port++;
        if (attempts < maxAttempts) {
          server.log.warn(`Port ${port - 1} is in use, trying ${port}...`);
        } else {
          server.log.error(`Could not find available port after ${maxAttempts} attempts`);
          throw err;
        }
      } else {
        throw err;
      }
    }
  }
}

// Start the application
start().catch((err) => {
    server.log.error(err);
    process.exit(1);
  });