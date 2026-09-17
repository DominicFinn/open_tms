import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { container, TOKENS } from '../di/index.js';
import { registerOrgScope } from '../auth/orgScopeMiddleware.js';
import { ITelemetryService } from '../services/iot/TelemetryService.js';
import { ReadingWindow } from '../repositories/SensorReadingRepository.js';

const DEFAULT_READINGS = 500;
const MAX_READINGS = 2000;

const telemetrySchema = (summary: string) => ({
  tags: ['Telemetry'],
  summary,
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', format: 'uuid' } },
  },
  querystring: {
    type: 'object',
    properties: {
      since: { type: 'string', format: 'date-time', description: 'Only return readings at or after this time' },
      until: { type: 'string', format: 'date-time', description: 'Only return readings at or before this time' },
      limit: { type: 'integer', minimum: 1, maximum: MAX_READINGS, default: DEFAULT_READINGS },
    },
  },
});

function readingWindow(req: FastifyRequest): ReadingWindow {
  const q = req.query as { since?: string; until?: string; limit: number };
  return {
    since: q.since ? new Date(q.since) : undefined,
    until: q.until ? new Date(q.until) : undefined,
    limit: q.limit,
  };
}

export default async function telemetryRoutes(server: FastifyInstance) {
  await registerOrgScope(server);
  const telemetry = container.resolve<ITelemetryService>(TOKENS.ITelemetryService);

  server.get('/api/v1/shipments/:id/telemetry', {
    schema: telemetrySchema('Get sensor time-series readings for a shipment'),
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const data = await telemetry.forShipment(req.orgId!, id, readingWindow(req));
    if (!data) {
      reply.code(404);
      return { data: null, error: 'Shipment not found' };
    }
    return { data, error: null };
  });

  server.get('/api/v1/orders/:id/telemetry', {
    schema: telemetrySchema('Get sensor time-series readings for an order'),
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const data = await telemetry.forOrder(req.orgId!, id, readingWindow(req));
    if (!data) {
      reply.code(404);
      return { data: null, error: 'Order not found' };
    }
    return { data, error: null };
  });
}
