import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { container } from '../di/container.js';
import { TOKENS } from '../di/tokens.js';
import { IAuthService } from '../services/AuthService.js';
import { IPasswordService } from '../services/PasswordService.js';
import { IUserRepository } from '../repositories/UserRepository.js';
import { authenticate } from '../middleware/authenticate.js';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  organizationId: z.string().uuid().optional(),
  roleName: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export async function authRoutes(server: FastifyInstance) {
  const authService = container.resolve<IAuthService>(TOKENS.IAuthService);
  const passwordService = container.resolve<IPasswordService>(TOKENS.IPasswordService);
  const userRepo = container.resolve<IUserRepository>(TOKENS.IUserRepository);

  // POST /api/v1/auth/register
  server.post('/api/v1/auth/register', async (req, reply) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { data: null, error: parsed.error.issues.map(i => i.message).join('. ') };
    }

    const result = await authService.register(parsed.data);
    if (!result.success) {
      reply.code(409);
      return { data: null, error: result.error };
    }

    reply.code(201);
    return { data: result.user, error: null };
  });

  // POST /api/v1/auth/login
  server.post('/api/v1/auth/login', async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { data: null, error: 'Email and password are required' };
    }

    const result = await authService.login({
      ...parsed.data,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });

    if (!result.success) {
      reply.code(401);
      return { data: null, error: result.error };
    }

    return {
      data: {
        user: result.user,
        accessToken: result.tokens!.accessToken,
        refreshToken: result.tokens!.refreshToken,
        expiresIn: result.tokens!.expiresIn,
      },
      error: null,
    };
  });

  // POST /api/v1/auth/refresh
  server.post('/api/v1/auth/refresh', async (req, reply) => {
    const body = req.body as any;
    const refreshToken = body?.refreshToken;

    if (!refreshToken) {
      reply.code(400);
      return { data: null, error: 'refreshToken is required' };
    }

    const result = await authService.refresh(
      refreshToken,
      req.headers['user-agent'],
      req.ip,
    );

    if (!result.success) {
      reply.code(401);
      return { data: null, error: result.error };
    }

    return {
      data: {
        user: result.user,
        accessToken: result.tokens!.accessToken,
        refreshToken: result.tokens!.refreshToken,
        expiresIn: result.tokens!.expiresIn,
      },
      error: null,
    };
  });

  // POST /api/v1/auth/logout
  server.post('/api/v1/auth/logout', async (req, reply) => {
    const body = req.body as any;
    const refreshToken = body?.refreshToken;

    if (refreshToken) {
      await authService.logout(refreshToken);
    }

    return { data: { message: 'Logged out' }, error: null };
  });

  // POST /api/v1/auth/logout-all (requires auth)
  server.post('/api/v1/auth/logout-all', { preHandler: [authenticate] }, async (req) => {
    await authService.logoutAll(req.user!.sub);
    return { data: { message: 'All sessions revoked' }, error: null };
  });

  // GET /api/v1/auth/me (requires auth)
  server.get('/api/v1/auth/me', { preHandler: [authenticate] }, async (req, reply) => {
    const result = await authService.getProfile(req.user!.sub);
    if (!result.success) {
      reply.code(404);
      return { data: null, error: result.error };
    }

    return { data: result.user, error: null };
  });

  // PUT /api/v1/auth/change-password (requires auth)
  server.put('/api/v1/auth/change-password', { preHandler: [authenticate] }, async (req, reply) => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { data: null, error: parsed.error.issues.map(i => i.message).join('. ') };
    }

    const user = await userRepo.findById(req.user!.sub);
    if (!user) {
      reply.code(404);
      return { data: null, error: 'User not found' };
    }

    // Verify current password
    const valid = await passwordService.verify(parsed.data.currentPassword, user.passwordHash);
    if (!valid) {
      reply.code(401);
      return { data: null, error: 'Current password is incorrect' };
    }

    // Validate new password
    const validation = passwordService.validate(parsed.data.newPassword);
    if (!validation.valid) {
      reply.code(400);
      return { data: null, error: validation.errors.join('. ') };
    }

    const newHash = await passwordService.hash(parsed.data.newPassword);
    await userRepo.updatePassword(user.id, newHash);

    return { data: { message: 'Password changed successfully' }, error: null };
  });
}
