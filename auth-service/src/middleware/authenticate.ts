import { FastifyRequest, FastifyReply } from 'fastify';
import { container } from '../di/container.js';
import { TOKENS } from '../di/tokens.js';
import { ITokenService, JWTPayload } from '../services/TokenService.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: JWTPayload;
  }
}

export async function authenticate(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    reply.code(401).send({ data: null, error: 'Authorization header required' });
    return;
  }

  const token = authHeader.slice(7);
  const tokenService = container.resolve<ITokenService>(TOKENS.ITokenService);

  try {
    req.user = tokenService.verifyAccessToken(token);
  } catch {
    reply.code(401).send({ data: null, error: 'Invalid or expired token' });
  }
}

export function requirePermission(...requiredPermissions: string[]) {
  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!req.user) {
      reply.code(401).send({ data: null, error: 'Not authenticated' });
      return;
    }

    const userPermissions = req.user.permissions;

    // Wildcard admin check
    if (userPermissions.includes('*')) return;

    const hasPermission = requiredPermissions.every(required => {
      // Check exact match
      if (userPermissions.includes(required)) return true;

      // Check wildcard: "shipments:*" covers "shipments:read"
      const [resource] = required.split(':');
      if (userPermissions.includes(`${resource}:*`)) return true;

      return false;
    });

    if (!hasPermission) {
      reply.code(403).send({ data: null, error: 'Insufficient permissions' });
    }
  };
}
