import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { ICarrierAuthService } from '../services/CarrierAuthService.js';
import { ICarrierUserRepository } from '../repositories/CarrierUserRepository.js';
import { computeLockoutStatus } from '../services/auth/lockout.js';
import { container, TOKENS } from '../di/index.js';

export async function carrierUserRoutes(server: FastifyInstance) {
  const authService = container.resolve<ICarrierAuthService>(TOKENS.ICarrierAuthService);
  const carrierUserRepo = container.resolve<ICarrierUserRepository>(TOKENS.ICarrierUserRepository);

  // List carrier users
  server.get('/api/v1/carriers/:carrierId/users', {
    schema: {
      tags: ['Carrier Users'],
      summary: 'List users for a carrier',
    },
  }, async (req: FastifyRequest, _reply: FastifyReply) => {
    const { carrierId } = req.params as { carrierId: string };
    const users = await carrierUserRepo.findByCarrierId(carrierId);
    const safeUsers = users.map(({ passwordHash, ...rest }) => ({
      ...rest,
      lockoutStatus: computeLockoutStatus(rest),
    }));
    return { data: safeUsers, error: null };
  });

  // Create carrier user
  server.post('/api/v1/carriers/:carrierId/users', {
    schema: {
      tags: ['Carrier Users'],
      summary: 'Create a user for a carrier (admin)',
      body: {
        type: 'object',
        required: ['email', 'password', 'name'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
          name: { type: 'string', minLength: 1 },
          role: { type: 'string', enum: ['dispatcher', 'admin'] },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { carrierId } = req.params as { carrierId: string };
    const body = z.object({
      email: z.string().email(),
      password: z.string().min(8),
      name: z.string().min(1),
      role: z.enum(['dispatcher', 'admin']).optional(),
    }).parse((req as any).body);

    try {
      const user = await authService.register(carrierId, body.email, body.password, body.name, body.role);
      const { passwordHash, ...safeUser } = user;
      reply.code(201);
      return { data: safeUser, error: null };
    } catch (err: any) {
      reply.code(400);
      return { data: null, error: err.message };
    }
  });

  // Update carrier user
  server.put('/api/v1/carriers/:carrierId/users/:id', {
    schema: {
      tags: ['Carrier Users'],
      summary: 'Update a carrier user',
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          role: { type: 'string', enum: ['dispatcher', 'admin'] },
          active: { type: 'boolean' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { carrierId: string; id: string };
    const body = z.object({
      name: z.string().optional(),
      role: z.enum(['dispatcher', 'admin']).optional(),
      active: z.boolean().optional(),
    }).parse((req as any).body);

    try {
      const user = await carrierUserRepo.update(id, body);
      const { passwordHash, ...safeUser } = user;
      return { data: safeUser, error: null };
    } catch (err: any) {
      reply.code(400);
      return { data: null, error: err.message };
    }
  });

  // Admin reset password for carrier user
  server.post('/api/v1/carriers/:carrierId/users/:id/reset-password', {
    schema: {
      tags: ['Carrier Users'],
      summary: 'Reset password for a carrier user (admin)',
      body: {
        type: 'object',
        required: ['newPassword'],
        properties: {
          newPassword: { type: 'string', minLength: 8 },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { carrierId: string; id: string };
    const { newPassword } = z.object({
      newPassword: z.string().min(8),
    }).parse((req as any).body);

    try {
      await authService.adminResetPassword(id, newPassword);
      return { data: { reset: true }, error: null };
    } catch (err: any) {
      reply.code(400);
      return { data: null, error: err.message };
    }
  });

  // Deactivate carrier user
  server.delete('/api/v1/carriers/:carrierId/users/:id', {
    schema: {
      tags: ['Carrier Users'],
      summary: 'Deactivate a carrier user',
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { carrierId: string; id: string };
    try {
      const user = await carrierUserRepo.update(id, { active: false });
      const { passwordHash, ...safeUser } = user;
      return { data: safeUser, error: null };
    } catch (err: any) {
      reply.code(400);
      return { data: null, error: err.message };
    }
  });

  // Unlock a locked-out account (clears failed-attempt counter)
  server.post('/api/v1/carriers/:carrierId/users/:id/unlock', {
    schema: {
      tags: ['Carrier Users'],
      summary: 'Clear lockout for a carrier user',
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { carrierId: string; id: string };
    const user = await carrierUserRepo.findById(id);
    if (!user) {
      reply.code(404);
      return { data: null, error: 'User not found' };
    }
    await authService.unlockAccount(user.id);
    return { data: { unlocked: true }, error: null };
  });
}
