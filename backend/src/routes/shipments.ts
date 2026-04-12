import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { container } from '../di/container.js';
import { TOKENS } from '../di/tokens.js';
import { ICommandBus } from '../commands/CommandBus.js';
import { CREATE_SHIPMENT } from '../commands/shipments/CreateShipmentCommand.js';
import { UPDATE_SHIPMENT } from '../commands/shipments/UpdateShipmentCommand.js';
import { ARCHIVE_SHIPMENT } from '../commands/shipments/ArchiveShipmentCommand.js';

export async function shipmentRoutes(server: FastifyInstance) {
  const commandBus = container.resolve<ICommandBus>(TOKENS.ICommandBus);

  const getOrgId = async () => {
    const org = await server.prisma.organization.findFirst({ select: { id: true } });
    return org?.id || 'default';
  };

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
            destination: true,
            laneCarriers: {
              where: { assigned: true },
              include: { carrier: true }
            }
          }
        },
        carrier: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return { data: shipments, error: null };
  });

  // Create shipment
  server.post('/api/v1/shipments', async (req: FastifyRequest, reply: FastifyReply) => {
    const addressSchema = z.object({
      name: z.string().min(1),
      address1: z.string().min(1),
      address2: z.string().optional(),
      city: z.string().min(1),
      state: z.string().optional(),
      postalCode: z.string().optional(),
      country: z.string().min(1),
      lat: z.number().optional(),
      lng: z.number().optional(),
    });

    const schema = z.object({
      reference: z.string().min(1),
      customerId: z.string().uuid(),
      laneId: z.string().uuid().optional(),
      carrierId: z.string().uuid().optional(),
      originId: z.string().uuid().optional(),
      destinationId: z.string().uuid().optional(),
      originData: addressSchema.optional(),
      destinationData: addressSchema.optional(),
      pickupDate: z.string().datetime().optional(),
      deliveryDate: z.string().datetime().optional(),
      proNumber: z.string().optional(),
      items: z.array(z.object({
        sku: z.string(),
        description: z.string().optional(),
        quantity: z.number().int().positive(),
        weightKg: z.number().nonnegative().optional(),
        volumeM3: z.number().nonnegative().optional()
      })).default([])
    }).refine((data) => {
      // Accept lane, explicit IDs, or raw address data
      return (data.laneId) ||
        (data.originId && data.destinationId) ||
        (data.originData && data.destinationData);
    }, {
      message: "Provide laneId, both originId/destinationId, or both originData/destinationData"
    });

    const body = schema.parse((req as any).body);

    const result = await commandBus.dispatch({
      type: CREATE_SHIPMENT,
      orgId: await getOrgId(),
      actorId: null,
      payload: body,
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error };
    }

    // Fetch full shipment for response
    const created = await server.prisma.shipment.findFirst({
      where: { id: (result.data as any).id },
      include: {
        customer: true,
        origin: true,
        destination: true,
        carrier: true,
        lane: body.laneId ? { include: { origin: true, destination: true } } : false,
        orderShipments: {
          include: {
            order: {
              include: {
                trackableUnits: { include: { lineItems: true }, orderBy: { sequenceNumber: 'asc' } },
                lineItems: true
              }
            }
          }
        }
      }
    });

    // Event publishing and queue integration handled by CreateShipmentCommand

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
            stops: { include: { location: true }, orderBy: { order: 'asc' } },
            laneCarriers: { include: { carrier: true }, orderBy: { assigned: 'desc' } }
          }
        },
        carrier: true,
        loads: { include: { vehicle: true, driver: true } },
        events: { orderBy: { eventTime: 'desc' } },
        stops: {
          include: {
            location: true,
            orders: {
              select: {
                id: true, orderNumber: true, deliveryStatus: true, status: true,
                customer: { select: { name: true } }
              }
            }
          },
          orderBy: { sequenceNumber: 'asc' }
        },
        orderShipments: {
          include: {
            order: {
              select: {
                id: true, orderNumber: true, status: true, deliveryStatus: true,
                customer: { select: { name: true } }
              }
            }
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

  // Get shipment events
  server.get('/api/v1/shipments/:id/events', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const shipment = await server.prisma.shipment.findFirst({ where: { id, archived: false } });
    if (!shipment) {
      reply.code(404);
      return { data: null, error: 'Shipment not found' };
    }
    const events = await server.prisma.shipmentEvent.findMany({
      where: { shipmentId: id },
      orderBy: { eventTime: 'desc' }
    });
    return { data: events, error: null };
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
      carrierId: z.string().uuid().nullable().optional(),
      proNumber: z.string().nullable().optional(),
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
      const hasRouteFields = data.laneId !== undefined || data.originId !== undefined || data.destinationId !== undefined;
      if (!hasRouteFields) return true;
      return (data.laneId && !data.originId && !data.destinationId) ||
        (!data.laneId && data.originId && data.destinationId);
    }, {
      message: "Either laneId or both originId and destinationId must be provided"
    }).parse((req as any).body);

    const result = await commandBus.dispatch({
      type: UPDATE_SHIPMENT,
      orgId: await getOrgId(),
      actorId: null,
      payload: { id, data: body },
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(result.error?.includes('not found') ? 404 : 400);
      return { data: null, error: result.error };
    }

    const updated = await server.prisma.shipment.findFirst({
      where: { id },
      include: {
        customer: true, origin: true, destination: true,
        lane: body.laneId ? { include: { origin: true, destination: true } } : false
      }
    });
    // Event publishing handled by UpdateShipmentCommand

    return { data: updated, error: null };
  });

  // Delete (archive) shipment
  server.delete('/api/v1/shipments/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    const result = await commandBus.dispatch({
      type: ARCHIVE_SHIPMENT,
      orgId: await getOrgId(),
      actorId: null,
      payload: { id },
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(404);
      return { data: null, error: result.error };
    }

    return { data: { id, archived: true }, error: null };
  });
}
