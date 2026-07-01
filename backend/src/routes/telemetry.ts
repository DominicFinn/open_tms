import { FastifyInstance } from 'fastify';

export default async function telemetryRoutes(server: FastifyInstance) {
  const prisma = server.prisma;

  // GET /api/v1/shipments/:id/telemetry — Sensor time-series for a shipment
  server.get('/api/v1/shipments/:id/telemetry', {
    schema: {
      tags: ['Telemetry'],
      summary: 'Get sensor time-series readings for a shipment',
      params: {
        type: 'object',
        properties: { id: { type: 'string', format: 'uuid' } },
        required: ['id'],
      },
      querystring: {
        type: 'object',
        properties: {
          since: { type: 'string', format: 'date-time', description: 'Only return readings at or after this time' },
          until: { type: 'string', format: 'date-time', description: 'Only return readings at or before this time' },
          limit: { type: 'string', description: 'Max readings to return (default 500, max 2000)' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: ['object', 'null'], additionalProperties: true },
            error: { type: ['string', 'null'] },
          },
        },
      },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const query = req.query as { since?: string; until?: string; limit?: string };
    const limit = Math.min(parseInt(query.limit || '500'), 2000);

    try {
      const readings = await prisma.sensorReading.findMany({
        where: {
          shipmentId: id,
          ...(query.since || query.until
            ? {
                eventTime: {
                  ...(query.since ? { gte: new Date(query.since) } : {}),
                  ...(query.until ? { lte: new Date(query.until) } : {}),
                },
              }
            : {}),
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
        latestHumidity: readings.filter(r => r.humidity != null).at(-1)?.humidity ?? null,
        latestPressure: readings.filter(r => r.atmosphericPressure != null).at(-1)?.atmosphericPressure ?? null,
        devices: [...new Set(readings.map(r => r.deviceId))].length,
      };

      return reply.send({ data: { readings, summary } });
    } catch (err: any) {
      return reply.status(500).send({ data: null, error: err.message });
    }
  });

  // GET /api/v1/orders/:id/telemetry — Sensor time-series for an order
  server.get('/api/v1/orders/:id/telemetry', {
    schema: {
      tags: ['Telemetry'],
      summary: 'Get sensor time-series readings for an order',
      params: {
        type: 'object',
        properties: { id: { type: 'string', format: 'uuid' } },
        required: ['id'],
      },
      querystring: {
        type: 'object',
        properties: {
          since: { type: 'string', format: 'date-time', description: 'Only return readings at or after this time' },
          until: { type: 'string', format: 'date-time', description: 'Only return readings at or before this time' },
          limit: { type: 'string', description: 'Max readings to return (default 500, max 2000)' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: ['object', 'null'], additionalProperties: true },
            error: { type: ['string', 'null'] },
          },
        },
      },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const query = req.query as { since?: string; until?: string; limit?: string };
    const limit = Math.min(parseInt(query.limit || '500'), 2000);

    try {
      const readings = await prisma.sensorReading.findMany({
        where: {
          orderId: id,
          ...(query.since || query.until
            ? {
                eventTime: {
                  ...(query.since ? { gte: new Date(query.since) } : {}),
                  ...(query.until ? { lte: new Date(query.until) } : {}),
                },
              }
            : {}),
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
