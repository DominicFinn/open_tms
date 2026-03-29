import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { container } from '../di/container.js';
import { TOKENS } from '../di/tokens.js';
import { IUserRepository } from '../repositories/UserRepository.js';
import { IRoleRepository } from '../repositories/RoleRepository.js';
import { IPasswordService } from '../services/PasswordService.js';
import { authenticate, requirePermission } from '../middleware/authenticate.js';

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  organizationId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  phone: z.string().optional(),
  timezone: z.string().optional(),
  roleIds: z.array(z.string().uuid()).optional(),
});

const updateUserSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional(),
  timezone: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  active: z.boolean().optional(),
});

export async function userRoutes(server: FastifyInstance) {
  const userRepo = container.resolve<IUserRepository>(TOKENS.IUserRepository);
  const roleRepo = container.resolve<IRoleRepository>(TOKENS.IRoleRepository);
  const passwordService = container.resolve<IPasswordService>(TOKENS.IPasswordService);

  // GET /api/v1/users
  server.get('/api/v1/users', {
    preHandler: [authenticate, requirePermission('users:read')],
  }, async () => {
    const users = await userRepo.all();
    return { data: users, error: null };
  });

  // GET /api/v1/users/:id
  server.get('/api/v1/users/:id', {
    preHandler: [authenticate, requirePermission('users:read')],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const user = await userRepo.findByIdWithRoles(id);
    if (!user) {
      reply.code(404);
      return { data: null, error: 'User not found' };
    }
    return { data: user, error: null };
  });

  // POST /api/v1/users (admin creates user)
  server.post('/api/v1/users', {
    preHandler: [authenticate, requirePermission('users:write')],
  }, async (req, reply) => {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { data: null, error: parsed.error.issues.map(i => i.message).join('. ') };
    }

    const existing = await userRepo.findByEmail(parsed.data.email);
    if (existing) {
      reply.code(409);
      return { data: null, error: 'Email already registered' };
    }

    const validation = passwordService.validate(parsed.data.password);
    if (!validation.valid) {
      reply.code(400);
      return { data: null, error: validation.errors.join('. ') };
    }

    const passwordHash = await passwordService.hash(parsed.data.password);
    const user = await userRepo.create({
      email: parsed.data.email,
      passwordHash,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      organizationId: parsed.data.organizationId,
      customerId: parsed.data.customerId,
      phone: parsed.data.phone,
      timezone: parsed.data.timezone,
    });

    // Assign roles if provided
    if (parsed.data.roleIds) {
      for (const roleId of parsed.data.roleIds) {
        await roleRepo.assignToUser(user.id, roleId);
      }
    }

    const created = await userRepo.findByIdWithRoles(user.id);
    reply.code(201);
    return { data: created, error: null };
  });

  // PUT /api/v1/users/:id
  server.put('/api/v1/users/:id', {
    preHandler: [authenticate, requirePermission('users:write')],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { data: null, error: parsed.error.issues.map(i => i.message).join('. ') };
    }

    const user = await userRepo.findById(id);
    if (!user) {
      reply.code(404);
      return { data: null, error: 'User not found' };
    }

    const updated = await userRepo.update(id, parsed.data);
    return { data: updated, error: null };
  });

  // PUT /api/v1/users/:id/roles
  server.put('/api/v1/users/:id/roles', {
    preHandler: [authenticate, requirePermission('users:write')],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = z.object({ roleIds: z.array(z.string().uuid()) }).safeParse(req.body);
    if (!body.success) {
      reply.code(400);
      return { data: null, error: 'roleIds array required' };
    }

    const user = await userRepo.findByIdWithRoles(id);
    if (!user) {
      reply.code(404);
      return { data: null, error: 'User not found' };
    }

    // Remove existing roles and assign new ones
    for (const ur of user.roles) {
      await roleRepo.removeFromUser(id, ur.role.id);
    }
    for (const roleId of body.data.roleIds) {
      await roleRepo.assignToUser(id, roleId);
    }

    const updated = await userRepo.findByIdWithRoles(id);
    return { data: updated, error: null };
  });

  // DELETE /api/v1/users/:id (archive)
  server.delete('/api/v1/users/:id', {
    preHandler: [authenticate, requirePermission('users:write')],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };

    // Prevent self-deletion
    if (id === req.user!.sub) {
      reply.code(400);
      return { data: null, error: 'Cannot deactivate your own account' };
    }

    const user = await userRepo.findById(id);
    if (!user) {
      reply.code(404);
      return { data: null, error: 'User not found' };
    }

    const archived = await userRepo.archive(id);
    return { data: archived, error: null };
  });
}
