/**
 * Notification Routes — in-app notification inbox for the bell icon.
 *
 * GET  /api/v1/notifications         — list notifications (paginated, filterable)
 * GET  /api/v1/notifications/unread-count — unread count
 * PATCH /api/v1/notifications/:id     — mark as read/dismissed
 * POST /api/v1/notifications/read-all — mark all as read
 */

import { FastifyInstance } from 'fastify';

export async function notificationRoutes(server: FastifyInstance) {
  const prefix = '/api/v1/notifications';

  // List notifications for the current user
  server.get(prefix, {
    schema: {
      tags: ['Notifications'],
      summary: 'List notifications',
      querystring: {
        type: 'object',
        properties: {
          read: { type: 'string', enum: ['true', 'false'] },
          category: { type: 'string' },
          limit: { type: 'integer', default: 20 },
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
                notifications: { type: 'array', items: { type: 'object' } },
                total: { type: 'integer' },
                unreadCount: { type: 'integer' },
              },
            },
            error: { type: 'string', nullable: true },
          },
        },
      },
    },
  }, async (request) => {
    const { read, category, limit = 20, offset = 0 } = request.query as any;

    // The inbox belongs to the signed-in user, never to a user named in the request.
    const userId = request.user!.sub;
    const orgId = request.orgId!;
    const where: any = { userId, orgId };
    if (read === 'true') where.read = true;
    if (read === 'false') where.read = false;
    if (category) where.category = category;

    const [notifications, total, unreadCount] = await Promise.all([
      server.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Number(limit),
        skip: Number(offset),
      }),
      server.prisma.notification.count({ where }),
      server.prisma.notification.count({ where: { userId, orgId, read: false } }),
    ]);

    return { data: { notifications, total, unreadCount }, error: null };
  });

  // Unread count (lightweight endpoint for polling)
  server.get(`${prefix}/unread-count`, {
    schema: {
      tags: ['Notifications'],
      summary: 'Get unread notification count',
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: 'object', properties: { count: { type: 'integer' } } },
            error: { type: 'string', nullable: true },
          },
        },
      },
    },
  }, async (request) => {
    const count = await server.prisma.notification.count({
      where: { userId: request.user!.sub, orgId: request.orgId!, read: false },
    });

    return { data: { count }, error: null };
  });

  // Mark a single notification as read
  server.patch(`${prefix}/:id`, {
    schema: {
      tags: ['Notifications'],
      summary: 'Update notification (mark read/dismissed)',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      body: {
        type: 'object',
        properties: {
          read: { type: 'boolean' },
          dismissed: { type: 'boolean' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: 'object' },
            error: { type: 'string', nullable: true },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as any;
    const body = request.body as any;

    const updateData: any = {};
    if (body.read !== undefined) {
      updateData.read = body.read;
      if (body.read) updateData.readAt = new Date();
    }
    if (body.dismissed !== undefined) {
      updateData.dismissed = body.dismissed;
    }

    const where = { id, userId: request.user!.sub, orgId: request.orgId! };
    const { count } = await server.prisma.notification.updateMany({ where, data: updateData });
    if (count === 0) {
      reply.code(404);
      return { data: null, error: 'Notification not found' };
    }

    return { data: await server.prisma.notification.findFirst({ where }), error: null };
  });

  // Mark all as read
  server.post(`${prefix}/read-all`, {
    schema: {
      tags: ['Notifications'],
      summary: 'Mark all notifications as read',
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: 'object', properties: { updated: { type: 'integer' } } },
            error: { type: 'string', nullable: true },
          },
        },
      },
    },
  }, async (request) => {
    const result = await server.prisma.notification.updateMany({
      where: { userId: request.user!.sub, orgId: request.orgId!, read: false },
      data: { read: true, readAt: new Date() },
    });

    return { data: { updated: result.count }, error: null };
  });
}
