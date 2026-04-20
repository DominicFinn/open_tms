import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { IAuthService } from '../services/AuthService.js';
import { authenticateJWT } from '../middleware/jwtAuth.js';
import { container, TOKENS } from '../di/index.js';

export async function authRoutes(server: FastifyInstance) {
  const authService = container.resolve<IAuthService>(TOKENS.IAuthService);

  // ── Public ──

  server.post('/api/v1/auth/login', {
    schema: {
      tags: ['Auth'],
      summary: 'Internal user login',
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 1 },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = z.object({
      email: z.string().email(),
      password: z.string().min(1),
    }).safeParse((req as any).body);

    if (!parsed.success) {
      reply.code(400);
      return { data: null, error: 'Invalid request' };
    }

    try {
      const result = await authService.login(parsed.data.email, parsed.data.password);
      return { data: result, error: null };
    } catch (err: any) {
      reply.code(401);
      return { data: null, error: err.message };
    }
  });

  server.post('/api/v1/auth/forgot-password', {
    schema: {
      tags: ['Auth'],
      summary: 'Self-service password reset request (stub)',
      description: 'Currently a stub. Self-service password reset via email is on the roadmap. For now, ask an administrator to reset your password.',
      body: {
        type: 'object',
        required: ['email'],
        properties: { email: { type: 'string', format: 'email' } },
      },
    },
  }, async (req: FastifyRequest, _reply: FastifyReply) => {
    const parsed = z.object({ email: z.string().email() }).safeParse((req as any).body);
    if (parsed.success) {
      // Intentionally no-op. Logged for audit only — never reveal whether the email exists.
      server.log.info({ email: parsed.data.email }, 'Password reset requested (stub — email delivery not yet implemented)');
    }
    return {
      data: {
        message: 'If an account exists for that email, a password reset instruction has been logged. Self-service reset is not yet available — please contact your administrator to reset your password.',
      },
      error: null,
    };
  });

  // ── Authenticated ──

  server.get('/api/v1/auth/me', {
    schema: { tags: ['Auth'], summary: 'Get current authenticated user' },
    preHandler: [authenticateJWT],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const jwtPayload = (req as any).user;
    const user = await authService.getUserWithAuthContext(jwtPayload.sub);
    if (!user) {
      reply.code(401);
      return { data: null, error: 'User not found or inactive' };
    }
    return { data: user, error: null };
  });

  server.post('/api/v1/auth/change-password', {
    schema: {
      tags: ['Auth'],
      summary: 'Change own password',
      body: {
        type: 'object',
        required: ['currentPassword', 'newPassword'],
        properties: {
          currentPassword: { type: 'string' },
          newPassword: { type: 'string', minLength: 8 },
        },
      },
    },
    preHandler: [authenticateJWT],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).user.sub;
    const parsed = z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8),
    }).safeParse((req as any).body);

    if (!parsed.success) {
      reply.code(400);
      return { data: null, error: 'Invalid request' };
    }

    try {
      await authService.changePassword(userId, parsed.data.currentPassword, parsed.data.newPassword);
      return { data: { success: true }, error: null };
    } catch (err: any) {
      reply.code(400);
      return { data: null, error: err.message };
    }
  });

  server.post('/api/v1/auth/logout', {
    schema: { tags: ['Auth'], summary: 'Logout (client clears token; stateless JWT)' },
    preHandler: [authenticateJWT],
  }, async (_req: FastifyRequest, _reply: FastifyReply) => {
    // JWTs are stateless. Real revocation is on the roadmap (token blocklist / session records).
    return { data: { success: true }, error: null };
  });
}
