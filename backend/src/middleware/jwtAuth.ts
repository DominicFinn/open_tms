import { FastifyRequest, FastifyReply } from 'fastify';
import { createHmac } from 'crypto';

/**
 * JWT payload structure from the auth service.
 * Shared with auth-service/src/services/TokenService.ts
 */
export interface JWTPayload {
  sub: string;
  email: string;
  roles: string[];
  permissions: string[];
  organizationId?: string;
  customerId?: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: JWTPayload;
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'open-tms-dev-secret-change-in-production';

/**
 * Decode and verify a JWT token (HS256).
 * Lightweight implementation — no external dependency needed in the backend.
 */
function verifyJWT(token: string): JWTPayload {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token format');

  const [headerB64, payloadB64, signatureB64] = parts;

  // Verify HMAC SHA-256 signature
  const expectedSig = createHmac('sha256', JWT_SECRET)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64url');

  if (signatureB64 !== expectedSig) {
    throw new Error('Invalid signature');
  }

  // Decode payload
  const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString()) as JWTPayload;

  // Check expiration
  if (payload.exp && payload.exp * 1000 < Date.now()) {
    throw new Error('Token expired');
  }

  // Check issuer
  if (payload.iss && payload.iss !== 'open-tms-auth') {
    throw new Error('Invalid issuer');
  }

  return payload;
}

/**
 * Fastify preHandler hook: extracts and validates JWT from Authorization header.
 * Sets req.user if valid. Sends 401 if missing or invalid.
 */
export async function authenticateJWT(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    reply.code(401).send({ data: null, error: 'Authorization header required' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    req.user = verifyJWT(token);
  } catch {
    reply.code(401).send({ data: null, error: 'Invalid or expired token' });
  }
}

/**
 * Fastify preHandler hook: checks if the authenticated user has the required permissions.
 */
export function requirePermission(...requiredPermissions: string[]) {
  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!req.user) {
      reply.code(401).send({ data: null, error: 'Not authenticated' });
      return;
    }

    const userPermissions = req.user.permissions;
    if (userPermissions.includes('*')) return;

    const hasPermission = requiredPermissions.every(required => {
      if (userPermissions.includes(required)) return true;
      const [resource] = required.split(':');
      return userPermissions.includes(`${resource}:*`);
    });

    if (!hasPermission) {
      reply.code(403).send({ data: null, error: 'Insufficient permissions' });
    }
  };
}

/**
 * Optional auth: sets req.user if a valid token is present, but doesn't reject unauthenticated requests.
 */
export async function optionalAuth(req: FastifyRequest): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return;

  const token = authHeader.slice(7);
  try {
    req.user = verifyJWT(token);
  } catch {
    // Silently ignore invalid tokens for optional auth
  }
}
