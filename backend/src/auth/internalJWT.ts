/**
 * Shared JWT signing for the internal / "open-tms-auth" token family.
 *
 * The existing `AuthService.generateToken` and the new
 * `WarehouseService` login paths both need to mint tokens that
 * `authenticateJWT` (middleware/jwtAuth.ts) accepts. This helper exists
 * so both flows produce identical-shape tokens without each duplicating
 * the HMAC plumbing.
 */

import { createHmac } from 'crypto';

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required in production');
}
const JWT_SECRET = process.env.JWT_SECRET || 'open-tms-dev-secret-change-in-production';

export const INTERNAL_JWT_ISSUER = 'open-tms-auth';
export const INTERNAL_JWT_DEFAULT_TTL_HOURS = 12;

export interface InternalJWTClaims {
  sub: string;
  email: string;
  firstName?: string;
  lastName?: string;
  roles: string[];
  permissions: string[];
  organizationId?: string;
}

/**
 * Sign a JWT with the same shape as the rest of the internal auth
 * family (HS256, `open-tms-auth` issuer, configurable TTL). The token
 * is accepted by `authenticateJWT` and decorates `req.user` exactly the
 * same way as an `AuthService` login.
 */
export function signInternalJWT(
  claims: InternalJWTClaims,
  ttlHours: number = INTERNAL_JWT_DEFAULT_TTL_HOURS,
): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    ...claims,
    iat: now,
    exp: now + ttlHours * 3600,
    iss: INTERNAL_JWT_ISSUER,
  };

  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');

  return `${header}.${body}.${signature}`;
}
