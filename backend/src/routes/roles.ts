import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { PERMISSIONS, SYSTEM_ROLES } from '../auth/permissions.js';
import { seedSystemRoles } from '../auth/seedRoles.js';

export async function roleRoutes(server: FastifyInstance) {
  const getOrgId = async () => {
    const org = await server.prisma.organization.findFirst({ select: { id: true } });
    return org?.id || 'default';
  };

  // List all roles
  server.get('/api/v1/roles', {
    schema: {
      tags: ['Roles & Permissions'],
      summary: 'List all roles with their permissions',
    },
  }, async () => {
    const roles = await server.prisma.role.findMany({
      include: {
        _count: { select: { users: true } },
      },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
    return { data: roles, error: null };
  });

  // Get available permissions catalog
  server.get('/api/v1/roles/permissions', {
    schema: {
      tags: ['Roles & Permissions'],
      summary: 'Get the full catalog of available permissions',
    },
  }, async () => {
    return { data: PERMISSIONS, error: null };
  });

  // Get a single role
  server.get('/api/v1/roles/:id', {
    schema: {
      tags: ['Roles & Permissions'],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const role = await server.prisma.role.findUnique({
      where: { id },
      include: {
        users: {
          include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
        },
      },
    });
    if (!role) { reply.code(404); return { data: null, error: 'Role not found' }; }
    return { data: role, error: null };
  });

  // Create a custom role
  server.post('/api/v1/roles', {
    schema: {
      tags: ['Roles & Permissions'],
      summary: 'Create a custom role',
      body: {
        type: 'object',
        required: ['name', 'permissions'],
        properties: {
          name: { type: 'string', minLength: 1 },
          description: { type: 'string' },
          permissions: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      name: z.string().min(1).max(50),
      description: z.string().optional(),
      permissions: z.array(z.string()),
    }).parse((req as any).body);

    const existing = await server.prisma.role.findUnique({ where: { name: body.name } });
    if (existing) {
      reply.code(409);
      return { data: null, error: `Role "${body.name}" already exists` };
    }

    const role = await server.prisma.role.create({
      data: {
        name: body.name,
        description: body.description,
        permissions: body.permissions,
        isSystem: false,
      },
    });

    reply.code(201);
    return { data: role, error: null };
  });

  // Update a role's permissions
  server.put('/api/v1/roles/:id', {
    schema: {
      tags: ['Roles & Permissions'],
      body: {
        type: 'object',
        properties: {
          description: { type: 'string' },
          permissions: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = (req as any).body || {};

    const role = await server.prisma.role.findUnique({ where: { id } });
    if (!role) { reply.code(404); return { data: null, error: 'Role not found' }; }

    const data: any = {};
    if (body.description !== undefined) data.description = body.description;
    if (body.permissions !== undefined) data.permissions = body.permissions;

    const updated = await server.prisma.role.update({ where: { id }, data });
    return { data: updated, error: null };
  });

  // Delete a custom role (system roles cannot be deleted)
  server.delete('/api/v1/roles/:id', {
    schema: { tags: ['Roles & Permissions'] },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const role = await server.prisma.role.findUnique({ where: { id } });
    if (!role) { reply.code(404); return { data: null, error: 'Role not found' }; }
    if (role.isSystem) { reply.code(400); return { data: null, error: 'System roles cannot be deleted' }; }

    await server.prisma.role.delete({ where: { id } });
    return { data: { deleted: true }, error: null };
  });

  // Assign a role to a user
  server.post('/api/v1/roles/:roleId/users/:userId', {
    schema: {
      tags: ['Roles & Permissions'],
      summary: 'Assign a role to a user',
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { roleId, userId } = req.params as { roleId: string; userId: string };

    const [role, user] = await Promise.all([
      server.prisma.role.findUnique({ where: { id: roleId } }),
      server.prisma.user.findUnique({ where: { id: userId } }),
    ]);

    if (!role) { reply.code(404); return { data: null, error: 'Role not found' }; }
    if (!user) { reply.code(404); return { data: null, error: 'User not found' }; }

    const existing = await server.prisma.userRole.findUnique({
      where: { userId_roleId: { userId, roleId } },
    });
    if (existing) return { data: existing, error: null };

    const userRole = await server.prisma.userRole.create({
      data: { userId, roleId },
    });

    reply.code(201);
    return { data: userRole, error: null };
  });

  // Remove a role from a user
  server.delete('/api/v1/roles/:roleId/users/:userId', {
    schema: { tags: ['Roles & Permissions'] },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { roleId, userId } = req.params as { roleId: string; userId: string };

    const existing = await server.prisma.userRole.findUnique({
      where: { userId_roleId: { userId, roleId } },
    });
    if (!existing) { reply.code(404); return { data: null, error: 'User does not have this role' }; }

    await server.prisma.userRole.delete({ where: { id: existing.id } });
    return { data: { deleted: true }, error: null };
  });

  // Seed system roles (idempotent)
  server.post('/api/v1/roles/seed', {
    schema: {
      tags: ['Roles & Permissions'],
      summary: 'Seed or update system roles (idempotent)',
    },
  }, async () => {
    const result = await seedSystemRoles(server.prisma);
    return { data: result, error: null };
  });
}
