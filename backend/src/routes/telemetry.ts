import { FastifyInstance } from 'fastify';

export default async function telemetryRoutes(server: FastifyInstance) {
  const prisma = server.prisma;

  // GET /api/v1/shipments/:id/telemetry — Sensor time-series for a shipment
  server.get('/api/v1/shipments/:id/telemetry', async (req, reply) => {
    const { id } = req.params as { id: string };
    const query = req.query as { since?: string; limit?: string };
    const limit = Math.min(parseInt(query.limit || '500'), 2000);

    try {
      const readings = await prisma.sensorReading.findMany({
        where: {
          shipmentId: id,
          ...(query.since ? { eventTime: { gte: new Date(query.since) } } : {}),
        },
        orderBy: { eventTime: 'asc' },
        take: limit,
        include: {
          device: { select: { id: true, name: true, displayId: true, model: true } },
        },
      });

      // Summary stats
      const temps = readings.filter(r => r.temperature != null).map(r => r.temperature!);
      const summary = {
        readingCount: readings.length,
        alertCount: readings.filter(r => r.isAlert).length,
        temperature: temps.length > 0 ? {
          min: Math.min(...temps),
          max: Math.max(...temps),
          avg: Number((temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1)),
          latest: temps[temps.length - 1],
        } : null,
        latestBattery: readings.filter(r => r.batteryLevel != null).at(-1)?.batteryLevel ?? null,
        devices: [...new Set(readings.map(r => r.deviceId))].length,
      };

      return reply.send({ data: { readings, summary } });
    } catch (err: any) {
      return reply.status(500).send({ data: null, error: err.message });
    }
  });

  // GET /api/v1/orders/:id/telemetry — Sensor time-series for an order
  server.get('/api/v1/orders/:id/telemetry', async (req, reply) => {
    const { id } = req.params as { id: string };
    const query = req.query as { since?: string; limit?: string };
    const limit = Math.min(parseInt(query.limit || '500'), 2000);

    try {
      const readings = await prisma.sensorReading.findMany({
        where: {
          orderId: id,
          ...(query.since ? { eventTime: { gte: new Date(query.since) } } : {}),
        },
        orderBy: { eventTime: 'asc' },
        take: limit,
        include: {
          device: { select: { id: true, name: true, displayId: true, model: true } },
        },
      });

      return reply.send({ data: { readings, summary: { readingCount: readings.length } } });
    } catch (err: any) {
      return reply.status(500).send({ data: null, error: err.message });
    }
  });
}
