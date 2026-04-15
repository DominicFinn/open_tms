/**
 * Customer User Admin Routes - manage customer portal users.
 * Used by internal TMS admins on the customer edit page.
 */

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { container, TOKENS } from '../di/index.js';
import { ICustomerAuthService } from '../services/CustomerAuthService.js';
import { ICustomerUserRepository } from '../repositories/CustomerUserRepository.js';

export async function customerUserRoutes(server: FastifyInstance) {
  const authService = container.resolve<ICustomerAuthService>(TOKENS.ICustomerAuthService);
  const userRepo = container.resolve<ICustomerUserRepository>(TOKENS.ICustomerUserRepository);

  // List customer portal users
  server.get('/api/v1/customers/:customerId/users', {
    schema: {
      tags: ['Customer Users'],
      summary: 'List portal users for a customer',
    },
  }, async (req: FastifyRequest) => {
    const { customerId } = req.params as { customerId: string };
    const users = await userRepo.findByCustomerId(customerId);
    return { data: users, error: null };
  });

  // Create customer portal user
  server.post('/api/v1/customers/:customerId/users', {
    schema: {
      tags: ['Customer Users'],
      summary: 'Create a customer portal user',
      body: {
        type: 'object',
        required: ['email', 'password', 'name'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
          name: { type: 'string', minLength: 1 },
          role: { type: 'string', enum: ['viewer', 'admin'] },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { customerId } = req.params as { customerId: string };
    const body = z.object({
      email: z.string().email(),
      password: z.string().min(8),
      name: z.string().min(1),
      role: z.enum(['viewer', 'admin']).optional(),
    }).parse((req as any).body);

    try {
      const user = await authService.register(customerId, body.email, body.password, body.name, body.role);
      reply.code(201);
      return { data: user, error: null };
    } catch (err: any) {
      reply.code(400);
      return { data: null, error: err.message };
    }
  });

  // Update customer portal user
  server.put('/api/v1/customers/:customerId/users/:id', {
    schema: {
      tags: ['Customer Users'],
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          role: { type: 'string', enum: ['viewer', 'admin'] },
          active: { type: 'boolean' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = (req as any).body || {};

    try {
      const updated = await userRepo.update(id, body);
      return { data: updated, error: null };
    } catch (err: any) {
      reply.code(400);
      return { data: null, error: err.message };
    }
  });

  // Admin reset password
  server.post('/api/v1/customers/:customerId/users/:id/reset-password', {
    schema: {
      tags: ['Customer Users'],
      body: {
        type: 'object',
        required: ['newPassword'],
        properties: { newPassword: { type: 'string', minLength: 8 } },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const { newPassword } = (req as any).body;

    try {
      await authService.adminResetPassword(id, newPassword);
      return { data: { success: true }, error: null };
    } catch (err: any) {
      reply.code(400);
      return { data: null, error: err.message };
    }
  });

  // Deactivate customer portal user
  server.delete('/api/v1/customers/:customerId/users/:id', {
    schema: { tags: ['Customer Users'] },
  }, async (req: FastifyRequest) => {
    const { id } = req.params as { id: string };
    await userRepo.update(id, { active: false });
    return { data: { deactivated: true }, error: null };
  });
}
