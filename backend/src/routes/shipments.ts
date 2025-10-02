import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

export async function shipmentRoutes(server: FastifyInstance) {
  // Get all shipments
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

  // Create shipment
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

  // Get shipment by ID
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

  // Update shipment
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

  // Delete (archive) shipment
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
}
