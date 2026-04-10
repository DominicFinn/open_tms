import { FastifyInstance } from 'fastify';

export default async function deviceRoutes(server: FastifyInstance) {
  const prisma = server.prisma;

  // GET /api/v1/devices — List all devices
  server.get('/api/v1/devices', async (_req, reply) => {
    try {
      const devices = await prisma.device.findMany({
        orderBy: { lastSeenAt: 'desc' },
        include: {
          assignments: {
            where: { active: true },
            include: {
              shipment: { select: { id: true, reference: true, status: true } },
              order: { select: { id: true, orderNumber: true, status: true } },
            },
          },
          _count: { select: { sensorReadings: true, deviceEvents: true } },
        },
      });
      return reply.send({ data: devices });
    } catch (err: any) {
      return reply.status(500).send({ data: null, error: err.message });
    }
  });

  // GET /api/v1/devices/:id — Device detail
  server.get('/api/v1/devices/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const device = await prisma.device.findUnique({
        where: { id },
        include: {
          assignments: {
            orderBy: { assignedAt: 'desc' },
            include: {
              shipment: { select: { id: true, reference: true, status: true } },
              order: { select: { id: true, orderNumber: true, status: true } },
            },
          },
          sensorReadings: { orderBy: { eventTime: 'desc' }, take: 50 },
          deviceEvents: { orderBy: { startTime: 'desc' }, take: 50 },
        },
      });
      if (!device) return reply.status(404).send({ data: null, error: 'Device not found' });
      return reply.send({ data: device });
    } catch (err: any) {
      return reply.status(500).send({ data: null, error: err.message });
    }
  });

  // POST /api/v1/devices — Register a device manually
  server.post('/api/v1/devices', async (req, reply) => {
    const body = req.body as any;
    try {
      const device = await prisma.device.create({
        data: {
          externalId: body.externalId,
          displayId: body.displayId || null,
          name: body.name,
          provider: body.provider || 'system_loco',
          model: body.model || null,
          status: 'active',
        },
      });
      return reply.status(201).send({ data: device });
    } catch (err: any) {
      return reply.status(400).send({ data: null, error: err.message });
    }
  });

  // PUT /api/v1/devices/:id — Update device
  server.put('/api/v1/devices/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as any;
    try {
      const device = await prisma.device.update({
        where: { id },
        data: {
          name: body.name,
          status: body.status,
          displayId: body.displayId,
          model: body.model,
        },
      });
      return reply.send({ data: device });
    } catch (err: any) {
      return reply.status(400).send({ data: null, error: err.message });
    }
  });

  // POST /api/v1/devices/:id/assign — Assign device to shipment or order
  server.post('/api/v1/devices/:id/assign', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { shipmentId?: string; orderId?: string; trackableUnitId?: string };
    try {
      // Deactivate any existing active assignment for this device
      await prisma.deviceAssignment.updateMany({
        where: { deviceId: id, active: true },
        data: { active: false, unassignedAt: new Date() },
      });

      const assignment = await prisma.deviceAssignment.create({
        data: {
          deviceId: id,
          shipmentId: body.shipmentId || null,
          orderId: body.orderId || null,
          trackableUnitId: body.trackableUnitId || null,
        },
      });
      return reply.status(201).send({ data: assignment });
    } catch (err: any) {
      return reply.status(400).send({ data: null, error: err.message });
    }
  });

  // DELETE /api/v1/devices/:id/assign — Unassign device
  server.delete('/api/v1/devices/:id/assign', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      await prisma.deviceAssignment.updateMany({
        where: { deviceId: id, active: true },
        data: { active: false, unassignedAt: new Date() },
      });
      return reply.send({ data: { unassigned: true } });
    } catch (err: any) {
      return reply.status(400).send({ data: null, error: err.message });
    }
  });

  // GET /api/v1/devices/:id/readings — Sensor readings for a device
  server.get('/api/v1/devices/:id/readings', async (req, reply) => {
    const { id } = req.params as { id: string };
    const query = req.query as { limit?: string; since?: string };
    const limit = Math.min(parseInt(query.limit || '200'), 1000);

    try {
      const readings = await prisma.sensorReading.findMany({
        where: {
          deviceId: id,
          ...(query.since ? { eventTime: { gte: new Date(query.since) } } : {}),
        },
        orderBy: { eventTime: 'desc' },
        take: limit,
      });
      return reply.send({ data: readings });
    } catch (err: any) {
      return reply.status(500).send({ data: null, error: err.message });
    }
  });
}
