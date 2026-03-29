import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { container } from '../di/container.js';
import { TOKENS } from '../di/tokens.js';
import { IRoleRepository } from '../repositories/RoleRepository.js';
import { IAuthService } from '../services/AuthService.js';
import { IUserRepository } from '../repositories/UserRepository.js';

const setupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  organizationName: z.string().min(1).optional(),
});

export async function setupRoutes(server: FastifyInstance) {
  const roleRepo = container.resolve<IRoleRepository>(TOKENS.IRoleRepository);
  const authService = container.resolve<IAuthService>(TOKENS.IAuthService);
  const userRepo = container.resolve<IUserRepository>(TOKENS.IUserRepository);

  // POST /api/v1/auth/setup — First-run setup: seed roles and create admin user
  // Only works when no users exist in the system
  server.post('/api/v1/auth/setup', async (req, reply) => {
    // Check if any users already exist
    const existingUsers = await userRepo.all();
    if (existingUsers.length > 0) {
      reply.code(409);
      return { data: null, error: 'Setup already completed. Users already exist in the system.' };
    }

    const parsed = setupSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { data: null, error: parsed.error.issues.map(i => i.message).join('. ') };
    }

    // Seed default roles
    await roleRepo.seedDefaults();
    server.log.info('Default roles seeded');

    // Create organization if name provided
    let organizationId: string | undefined;
    if (parsed.data.organizationName) {
      const org = await server.prisma.organization.create({
        data: { name: parsed.data.organizationName },
      });
      organizationId = org.id;
    } else {
      // Use existing organization or create default
      const existing = await server.prisma.organization.findFirst();
      organizationId = existing?.id;
    }

    // Register admin user
    const result = await authService.register({
      email: parsed.data.email,
      password: parsed.data.password,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      organizationId,
      roleName: 'admin',
    });

    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error };
    }

    reply.code(201);
    return {
      data: {
        message: 'Setup complete. Admin user created with default roles seeded.',
        user: result.user,
      },
      error: null,
    };
  });

  // GET /api/v1/auth/setup/status — Check if setup is needed
  server.get('/api/v1/auth/setup/status', async () => {
    const existingUsers = await userRepo.all();
    return {
      data: {
        setupRequired: existingUsers.length === 0,
        userCount: existingUsers.length,
      },
      error: null,
    };
  });
}
