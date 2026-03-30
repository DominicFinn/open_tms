/**
 * Event Routes — query the immutable event store.
 *
 * GET /api/v1/events                — list events (paginated, filterable)
 * GET /api/v1/events/:entityType/:entityId — events for a specific entity
 */

import { FastifyInstance } from 'fastify';

export async function eventRoutes(server: FastifyInstance) {
  const prefix = '/api/v1/events';

  // List events (paginated)
  server.get(prefix, {
    schema: {
      tags: ['Events'],
      summary: 'List domain events',
      querystring: {
        type: 'object',
        properties: {
          type: { type: 'string', description: 'Event type filter, e.g. "shipment.created"' },
          entityType: { type: 'string' },
          entityId: { type: 'string' },
          orgId: { type: 'string' },
          since: { type: 'string', description: 'ISO-8601 timestamp' },
          limit: { type: 'integer', default: 50 },
          offset: { type: 'integer', default: 0 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                events: { type: 'array', items: { type: 'object' } },
                total: { type: 'integer' },
              },
            },
            error: { type: 'string', nullable: true },
          },
        },
      },
    },
  }, async (request) => {
    const { type, entityType, entityId, orgId, since, limit = 50, offset = 0 } = request.query as any;

    const where: any = {};
    if (type) where.type = type;
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (orgId) where.orgId = orgId;
    if (since) where.timestamp = { gte: since };

    const [events, total] = await Promise.all([
      server.prisma.domainEventLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Number(limit),
        skip: Number(offset),
      }),
      server.prisma.domainEventLog.count({ where }),
    ]);

    return { data: { events, total }, error: null };
  });

  // Events for a specific entity
  server.get(`${prefix}/:entityType/:entityId`, {
    schema: {
      tags: ['Events'],
      summary: 'Get events for a specific entity',
      params: {
        type: 'object',
        properties: {
          entityType: { type: 'string' },
          entityId: { type: 'string' },
        },
        required: ['entityType', 'entityId'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: 'array', items: { type: 'object' } },
            error: { type: 'string', nullable: true },
          },
        },
      },
    },
  }, async (request) => {
    const { entityType, entityId } = request.params as any;

    const events = await server.prisma.domainEventLog.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
    });

    return { data: events, error: null };
  });
}
