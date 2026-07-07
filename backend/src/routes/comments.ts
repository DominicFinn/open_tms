/**
 * Comments API routes — polymorphic comments for any entity (issues, shipments, etc.)
 *
 * Author capture: the author's display name + ID are pulled from the
 * authenticated user (`req.user.sub` from the JWT) plus a one-shot lookup
 * against the User table for `firstName`/`lastName`. Falling back to email
 * keeps the row meaningful even if the name fields are blank.
 *
 * Soft delete: the DELETE endpoint sets `deletedAt` + `deletedBy` rather than
 * removing the row, so we keep the audit trail. The list endpoint hides
 * soft-deleted rows by default; pass `includeDeleted=true` (admin only) to
 * see them.
 *
 * Writes go through the command bus (CreateComment / UpdateComment /
 * DeleteComment). The IssueProjection owns IssueReadModel.commentCount; this
 * file used to update that column directly which double-counted.
 *
 * Response schemas use `data: {}` deliberately — fast-json-stringify with
 * `type: 'object'` and no `properties` strips every field from the response,
 * which is the same trap the carrier-tracking endpoints hit.
 */

import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { container, TOKENS } from '../di/index.js';
import { ICommandBus } from '../commands/CommandBus.js';
import { CREATE_COMMENT, UPDATE_COMMENT, DELETE_COMMENT } from '../commands/comments/index.js';

const dataObject = {
  type: 'object' as const,
  properties: {
    data: {},
    error: { type: ['string', 'null'] as const },
  },
};

async function resolveAuthor(
  prisma: PrismaClient,
  req: FastifyRequest,
): Promise<{ authorId: string | null; authorName: string; orgId: string }> {
  const sub = req.user?.sub ?? null;
  const email = req.user?.email ?? null;
  const orgId = req.user?.organizationId ?? 'default-org';

  if (!sub) {
    return { authorId: null, authorName: 'System', orgId };
  }

  const user = await prisma.user.findUnique({
    where: { id: sub },
    select: { firstName: true, lastName: true, email: true },
  });

  const fullName = user
    ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim()
    : '';
  const authorName = fullName || user?.email || email || 'Unknown user';

  return { authorId: sub, authorName, orgId };
}

function isAdmin(req: FastifyRequest): boolean {
  const roles = req.user?.roles ?? [];
  const permissions = req.user?.permissions ?? [];
  return roles.includes('admin') || permissions.includes('*') || permissions.includes('comments:*');
}

export const commentRoutes: FastifyPluginAsync = async (server) => {
  const prisma = container.resolve<PrismaClient>(TOKENS.PrismaClient);
  const commandBus = container.resolve<ICommandBus>(TOKENS.ICommandBus);

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
          includeDeleted: { type: 'boolean', default: false, description: 'Admin only — include soft-deleted comments' },
        },
      },
      response: { 200: dataObject },
    },
  }, async (req: FastifyRequest, _reply: FastifyReply) => {
    const query = req.query as {
      entityType: string;
      entityId: string;
      limit?: number;
      offset?: number;
      includeDeleted?: boolean | string;
    };

    const limit = Number(query.limit) || 50;
    const offset = Number(query.offset) || 0;
    const wantDeleted = String(query.includeDeleted) === 'true' && isAdmin(req);

    const where: Record<string, unknown> = {
      entityType: query.entityType,
      entityId: query.entityId,
    };
    if (!wantDeleted) where.deletedAt = null;

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
          visibleToCustomer: { type: 'boolean', default: false, description: 'If true, the comment is exposed to the customer portal for the related entity owner.' },
          tag: { type: 'string', description: 'Optional free-form tag for categorizing the note (e.g. "issue", "requirement")' },
        },
      },
      response: { 201: dataObject },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { entityType, entityId, body, visibleToCustomer, tag } = z.object({
      entityType: z.string().min(1),
      entityId: z.string().min(1),
      body: z.string().min(1),
      visibleToCustomer: z.boolean().optional(),
      tag: z.string().min(1).optional(),
    }).parse(req.body);

    const { authorId, authorName, orgId } = await resolveAuthor(prisma, req);

    const result = await commandBus.dispatch({
      type: CREATE_COMMENT,
      orgId,
      actorId: authorId,
      payload: {
        entityType,
        entityId,
        body,
        authorId,
        authorName,
        authorType: 'user',
        visibleToCustomer,
        tag,
      },
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error ?? 'Failed to create comment' };
    }

    reply.code(201);
    return { data: result.data, error: null };
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
      response: { 200: dataObject },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const { body } = z.object({
      body: z.string().min(1),
    }).parse(req.body);

    // Author-only authorisation: keep the permission check in the route so
    // the command handler stays focused on the data write.
    const existing = await prisma.comment.findUnique({ where: { id } });
    if (!existing) {
      reply.code(404);
      return { data: null, error: 'Comment not found' };
    }
    if (existing.deletedAt) {
      reply.code(410);
      return { data: null, error: 'Comment has been deleted' };
    }

    const currentUserId = req.user?.sub ?? null;
    if (!currentUserId || existing.authorId !== currentUserId) {
      reply.code(403);
      return { data: null, error: 'Only the author can edit this comment' };
    }

    const result = await commandBus.dispatch({
      type: UPDATE_COMMENT,
      orgId: existing.orgId,
      actorId: currentUserId,
      payload: { id, body },
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error ?? 'Failed to update comment' };
    }

    return { data: result.data, error: null };
  });

  // DELETE /api/v1/comments/:id — soft-delete a comment (author or admin)
  server.delete('/api/v1/comments/:id', {
    schema: {
      tags: ['Comments'],
      summary: 'Soft-delete a comment (author or admin). Sets deletedAt + deletedBy; the row is kept for audit.',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
      response: { 200: dataObject },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    const existing = await prisma.comment.findUnique({ where: { id } });
    if (!existing) {
      reply.code(404);
      return { data: null, error: 'Comment not found' };
    }

    const currentUserId = req.user?.sub ?? null;
    const isAuthor = !!currentUserId && existing.authorId === currentUserId;
    const admin = isAdmin(req);

    if (!existing.deletedAt && !isAuthor && !admin) {
      reply.code(403);
      return { data: null, error: 'Only the author or an admin can delete this comment' };
    }

    const result = await commandBus.dispatch({
      type: DELETE_COMMENT,
      orgId: existing.orgId,
      actorId: currentUserId,
      payload: { id },
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error ?? 'Failed to delete comment' };
    }

    const data = result.data as { id: string; alreadyDeleted: boolean };
    return { data: { success: true, alreadyDeleted: data.alreadyDeleted }, error: null };
  });
};
