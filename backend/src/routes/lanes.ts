import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

export async function laneRoutes(server: FastifyInstance) {
  // Get all lanes
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

  // Create lane
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

  // Get lane by ID
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

  // Update lane
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

  // Delete (archive) lane
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
}
