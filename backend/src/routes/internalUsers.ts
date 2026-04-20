import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { IAuthService } from '../services/AuthService.js';
import { authenticateJWT, requirePermission } from '../middleware/jwtAuth.js';
import { container, TOKENS } from '../di/index.js';

export async function internalUserRoutes(server: FastifyInstance) {
  const authService = container.resolve<IAuthService>(TOKENS.IAuthService);
  const prisma = container.resolve<PrismaClient>(TOKENS.PrismaClient);

  server.get('/api/v1/users', {
    schema: { tags: ['Users'], summary: 'List internal users' },
    preHandler: [authenticateJWT, requirePermission('users:read', 'users:write', 'users:*')],
  }, async (_req: FastifyRequest, _reply: FastifyReply) => {
    const users = await prisma.user.findMany({
      take: 200,
      orderBy: { createdAt: 'desc' },
      include: { roles: { include: { role: true } } },
    });
    return {
      data: users.map((u) => ({
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        active: u.active,
        authProvider: u.authProvider,
        lastLoginAt: u.lastLoginAt,
        passwordChangedAt: u.passwordChangedAt,
        roles: u.roles.map((ur) => ({ id: ur.role.id, name: ur.role.name })),
        createdAt: u.createdAt,
      })),
      error: null,
    };
  });

  server.post('/api/v1/users/:id/reset-password', {
    schema: {
      tags: ['Users'],
      summary: 'Admin reset of another user\'s password',
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: {
        type: 'object',
        required: ['newPassword'],
        properties: { newPassword: { type: 'string', minLength: 8 } },
      },
    },
    preHandler: [authenticateJWT, requirePermission('users:write', 'users:*')],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = (req.params as { id: string });
    const parsed = z.object({ newPassword: z.string().min(8) }).safeParse((req as any).body);

    if (!parsed.success) {
      reply.code(400);
      return { data: null, error: 'newPassword must be at least 8 characters' };
    }

    try {
      await authService.adminResetPassword(id, parsed.data.newPassword);
      return { data: { success: true }, error: null };
    } catch (err: any) {
      reply.code(400);
      return { data: null, error: err.message };
    }
  });

  server.patch('/api/v1/users/:id', {
    schema: {
      tags: ['Users'],
      summary: 'Update an internal user (active flag, name)',
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: {
        type: 'object',
        properties: {
          active: { type: 'boolean' },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
        },
      },
    },
    preHandler: [authenticateJWT, requirePermission('users:write', 'users:*')],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = (req.params as { id: string });
    const parsed = z.object({
      active: z.boolean().optional(),
      firstName: z.string().min(1).optional(),
      lastName: z.string().min(1).optional(),
    }).safeParse((req as any).body);

    if (!parsed.success) {
      reply.code(400);
      return { data: null, error: 'Invalid request' };
    }

    try {
      const user = await prisma.user.update({
        where: { id },
        data: parsed.data,
      });
      return { data: { id: user.id, active: user.active }, error: null };
    } catch (err: any) {
      reply.code(400);
      return { data: null, error: err.message };
    }
  });
}
