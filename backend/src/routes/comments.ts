/**
 * Comments API routes — polymorphic comments for any entity (issues, shipments, etc.)
 */

import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { container, TOKENS } from '../di/index.js';
import type { IEventBus } from '../events/index.js';
import { EVENT_TYPES, createEvent } from '../events/index.js';

export const commentRoutes: FastifyPluginAsync = async (server) => {
  const prisma = container.resolve<PrismaClient>(TOKENS.PrismaClient);

  // GET /api/v1/comments — query comments for a specific entity
  server.get('/api/v1/comments', {
    schema: {
      tags: ['Comments'],
      summary: 'List comments for an entity',
      querystring: {
        type: 'object',
        required: ['entityType', 'entityId'],
        properties: {
          entityType: { type: 'string', description: 'Entity type (e.g. "issue", "shipment", "order")' },
          entityId: { type: 'string', description: 'Entity ID' },
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
                items: { type: 'array', items: { type: 'object' } },
                total: { type: 'integer' },
              },
            },
            error: { type: 'null' },
          },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const query = req.query as {
      entityType: string;
      entityId: string;
      limit?: number;
      offset?: number;
    };

    const limit = Number(query.limit) || 50;
    const offset = Number(query.offset) || 0;

    const where = {
      entityType: query.entityType,
      entityId: query.entityId,
    };

    const [items, total] = await Promise.all([
      prisma.comment.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        take: limit,
        skip: offset,
      }),
      prisma.comment.count({ where }),
    ]);

    return { data: { items, total }, error: null };
  });

  // POST /api/v1/comments — create a comment
  server.post('/api/v1/comments', {
    schema: {
      tags: ['Comments'],
      summary: 'Create a comment on an entity',
      body: {
        type: 'object',
        required: ['entityType', 'entityId', 'body'],
        properties: {
          entityType: { type: 'string', description: 'Entity type (e.g. "issue", "shipment", "order")' },
          entityId: { type: 'string', description: 'Entity ID' },
          body: { type: 'string', description: 'Comment body (markdown)' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            data: { type: 'object' },
            error: { type: 'null' },
          },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { entityType, entityId, body } = (req as any).body as {
      entityType: string;
      entityId: string;
      body: string;
    };

    if (!entityType || !entityId || !body) {
      reply.code(400);
      return { data: null, error: 'entityType, entityId, and body are required' };
    }

    const authorId = (req as any).userId || 'system';
    const authorName = (req as any).userName || 'System';
    const authorType = 'user';
    const orgId = (req as any).orgId || 'default-org';

    const comment = await prisma.comment.create({
      data: {
        orgId,
        entityType,
        entityId,
        authorId,
        authorName,
        authorType,
        body,
      },
    });

    // Update IssueReadModel.commentCount if this is an issue comment
    if (entityType === 'issue') {
      await prisma.issueReadModel.update({
        where: { id: entityId },
        data: { commentCount: { increment: 1 } },
      }).catch(() => {
        // Silently ignore if IssueReadModel record doesn't exist
      });
    }

    // Emit domain event
    try {
      const eventBus = container.resolve<IEventBus>(TOKENS.IEventBus);
      await eventBus.publish(createEvent({
        type: EVENT_TYPES.COMMENT_ADDED,
        orgId,
        actorId: authorId,
        entityType,
        entityId,
        payload: {
          commentId: comment.id,
          body,
          authorId,
          authorName,
          authorType,
        },
        source: 'api',
      }));
    } catch {
      // Event bus may not be available in test environments
    }

    reply.code(201);
    return { data: comment, error: null };
  });

  // PUT /api/v1/comments/:id — update a comment (author only)
  server.put('/api/v1/comments/:id', {
    schema: {
      tags: ['Comments'],
      summary: 'Update a comment (author only)',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
      body: {
        type: 'object',
        required: ['body'],
        properties: {
          body: { type: 'string', description: 'Updated comment body (markdown)' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: 'object' },
            error: { type: 'null' },
          },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const { body } = (req as any).body as { body: string };

    if (!body) {
      reply.code(400);
      return { data: null, error: 'body is required' };
    }

    const existing = await prisma.comment.findUnique({ where: { id } });
    if (!existing) {
      reply.code(404);
      return { data: null, error: 'Comment not found' };
    }

    const currentUserId = (req as any).userId || 'system';
    if (existing.authorId !== currentUserId) {
      reply.code(403);
      return { data: null, error: 'Only the author can edit this comment' };
    }

    const updated = await prisma.comment.update({
      where: { id },
      data: { body },
    });

    // Emit domain event
    try {
      const eventBus = container.resolve<IEventBus>(TOKENS.IEventBus);
      await eventBus.publish(createEvent({
        type: EVENT_TYPES.COMMENT_UPDATED,
        orgId: existing.orgId,
        actorId: currentUserId,
        entityType: existing.entityType,
        entityId: existing.entityId,
        payload: {
          commentId: id,
          body,
        },
        source: 'api',
      }));
    } catch {
      // Event bus may not be available in test environments
    }

    return { data: updated, error: null };
  });

  // DELETE /api/v1/comments/:id — delete a comment (author or admin)
  server.delete('/api/v1/comments/:id', {
    schema: {
      tags: ['Comments'],
      summary: 'Delete a comment (author or admin)',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
              },
            },
            error: { type: 'null' },
          },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    const existing = await prisma.comment.findUnique({ where: { id } });
    if (!existing) {
      reply.code(404);
      return { data: null, error: 'Comment not found' };
    }

    const currentUserId = (req as any).userId || 'system';
    const userRole = (req as any).userRole || '';
    const isAuthor = existing.authorId === currentUserId;
    const isAdmin = userRole === 'admin';

    if (!isAuthor && !isAdmin) {
      reply.code(403);
      return { data: null, error: 'Only the author or an admin can delete this comment' };
    }

    await prisma.comment.delete({ where: { id } });

    // Decrement IssueReadModel.commentCount if this is an issue comment
    if (existing.entityType === 'issue') {
      await prisma.issueReadModel.update({
        where: { id: existing.entityId },
        data: { commentCount: { decrement: 1 } },
      }).catch(() => {
        // Silently ignore if IssueReadModel record doesn't exist
      });
    }

    // Emit domain event
    try {
      const eventBus = container.resolve<IEventBus>(TOKENS.IEventBus);
      await eventBus.publish(createEvent({
        type: EVENT_TYPES.COMMENT_DELETED,
        orgId: existing.orgId,
        actorId: currentUserId,
        entityType: existing.entityType,
        entityId: existing.entityId,
        payload: {
          commentId: id,
        },
        source: 'api',
      }));
    } catch {
      // Event bus may not be available in test environments
    }

    return { data: { success: true }, error: null };
  });
};
