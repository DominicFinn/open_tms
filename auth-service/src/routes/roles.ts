import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { container } from '../di/container.js';
import { TOKENS } from '../di/tokens.js';
import { IRoleRepository } from '../repositories/RoleRepository.js';
import { authenticate, requirePermission } from '../middleware/authenticate.js';

const createRoleSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().optional(),
  permissions: z.array(z.string().min(1)),
});

const updateRoleSchema = z.object({
  description: z.string().optional(),
  permissions: z.array(z.string().min(1)).optional(),
});

export async function roleRoutes(server: FastifyInstance) {
  const roleRepo = container.resolve<IRoleRepository>(TOKENS.IRoleRepository);

  // GET /api/v1/roles
  server.get('/api/v1/roles', {
    preHandler: [authenticate, requirePermission('roles:read')],
  }, async () => {
    const roles = await roleRepo.all();
    return { data: roles, error: null };
  });

  // GET /api/v1/roles/:id
  server.get('/api/v1/roles/:id', {
    preHandler: [authenticate, requirePermission('roles:read')],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const role = await roleRepo.findById(id);
    if (!role) {
      reply.code(404);
      return { data: null, error: 'Role not found' };
    }
    return { data: role, error: null };
  });

  // POST /api/v1/roles
  server.post('/api/v1/roles', {
    preHandler: [authenticate, requirePermission('roles:write')],
  }, async (req, reply) => {
    const parsed = createRoleSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { data: null, error: parsed.error.issues.map(i => i.message).join('. ') };
    }

    const existing = await roleRepo.findByName(parsed.data.name);
    if (existing) {
      reply.code(409);
      return { data: null, error: 'Role name already exists' };
    }

    const role = await roleRepo.create(parsed.data);
    reply.code(201);
    return { data: role, error: null };
  });

  // PUT /api/v1/roles/:id
  server.put('/api/v1/roles/:id', {
    preHandler: [authenticate, requirePermission('roles:write')],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = updateRoleSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { data: null, error: parsed.error.issues.map(i => i.message).join('. ') };
    }

    const role = await roleRepo.findById(id);
    if (!role) {
      reply.code(404);
      return { data: null, error: 'Role not found' };
    }

    if (role.isSystem) {
      reply.code(403);
      return { data: null, error: 'System roles cannot be modified' };
    }

    const updated = await roleRepo.update(id, parsed.data);
    return { data: updated, error: null };
  });

  // DELETE /api/v1/roles/:id
  server.delete('/api/v1/roles/:id', {
    preHandler: [authenticate, requirePermission('roles:write')],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const role = await roleRepo.findById(id);
    if (!role) {
      reply.code(404);
      return { data: null, error: 'Role not found' };
    }

    if (role.isSystem) {
      reply.code(403);
      return { data: null, error: 'System roles cannot be deleted' };
    }

    await roleRepo.delete(id);
    return { data: { message: 'Role deleted' }, error: null };
  });
}
