/**
 * Event Routes — queryable access to the immutable DomainEventLog.
 *
 * Supports:
 * - Offset pagination (limit/offset) for UI listing
 * - Cursor pagination (afterId) for data warehouse incremental pulls
 * - Wildcard type filtering (shipment.* matches shipment.created, etc.)
 * - Entity-scoped queries
 * - Aggregate stats by type
 */

import { FastifyInstance } from 'fastify';

export async function eventRoutes(server: FastifyInstance) {
  const prefix = '/api/v1/events';

  // List events (paginated, filterable)
  server.get(prefix, {
    schema: {
      tags: ['Events'],
      summary: 'List domain events',
      querystring: {
        type: 'object',
        properties: {
          type: { type: 'string', description: 'Event type filter, supports .* wildcard (e.g. "shipment.*")' },
          entityType: { type: 'string' },
          entityId: { type: 'string' },
          orgId: { type: 'string' },
          since: { type: 'string', description: 'ISO-8601 timestamp — events after this time' },
          afterId: { type: 'string', description: 'Cursor — events after this event ID (for warehouse pulls)' },
          limit: { type: 'integer', default: 50, maximum: 1000 },
          offset: { type: 'integer', default: 0 },
        },
      },
    },
  }, async (request) => {
    const { type, entityType, entityId, orgId, since, afterId, limit = 50, offset = 0 } = request.query as any;

    const where: any = {};

    // Wildcard type filter: "shipment.*" matches all shipment events
    if (type) {
      if (type.endsWith('.*')) {
        where.type = { startsWith: type.slice(0, -1) };
      } else {
        where.type = type;
      }
    }

    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (orgId) where.orgId = orgId;
    if (since) where.timestamp = { gte: since };

    // Cursor-based pagination for warehouse incremental pulls
    if (afterId) {
      const cursor = await server.prisma.domainEventLog.findUnique({
        where: { id: afterId },
        select: { createdAt: true },
      });
      if (cursor) {
        where.createdAt = { gt: cursor.createdAt };
      }
    }

    const take = Math.min(Number(limit), 1000);

    const [events, total] = await Promise.all([
      server.prisma.domainEventLog.findMany({
        where,
        orderBy: { createdAt: afterId ? 'asc' : 'desc' },
        take,
        skip: afterId ? 0 : Number(offset),
      }),
      server.prisma.domainEventLog.count({ where }),
    ]);

    const nextCursor = events.length === take ? events[events.length - 1].id : null;

    return {
      data: {
        events,
        total,
        nextCursor,
        hasMore: events.length === take,
      },
      error: null,
    };
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
    },
  }, async (request) => {
    const { entityType, entityId } = request.params as any;

    const events = await server.prisma.domainEventLog.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
    });

    return { data: events, error: null };
  });

  // Event stats — counts by type, useful for dashboards and monitoring
  server.get(`${prefix}/stats`, {
    schema: {
      tags: ['Events'],
      summary: 'Get event counts grouped by type',
      querystring: {
        type: 'object',
        properties: {
          since: { type: 'string', description: 'ISO-8601 timestamp — count events after this time' },
          orgId: { type: 'string' },
        },
      },
    },
  }, async (request) => {
    const { since, orgId } = request.query as any;

    const where: any = {};
    if (since) where.timestamp = { gte: since };
    if (orgId) where.orgId = orgId;

    const stats = await server.prisma.domainEventLog.groupBy({
      by: ['type'],
      where,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    const total = stats.reduce((sum, s) => sum + s._count.id, 0);

    return {
      data: {
        total,
        byType: stats.map((s) => ({ type: s.type, count: s._count.id })),
      },
      error: null,
    };
  });
}
