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
  /** 'warehouse' = PWA session, accepted only on warehouse/WMS task routes. */
  scope?: 'warehouse';
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

export interface CarrierJWTPayload {
  sub: string;
  email: string;
  carrierId: string;
  carrierName: string;
  role: string;
  iat?: number;
  exp?: number;
  iss?: string;
}

export interface CustomerJWTPayload {
  sub: string;
  email: string;
  customerId: string;
  customerName: string;
  role: string;
  iat?: number;
  exp?: number;
  iss?: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: JWTPayload;
    carrierUser?: CarrierJWTPayload;
    customerUser?: CustomerJWTPayload;
  }
}

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required in production');
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
 * Routes a warehouse-scoped session may reach: the PWA surface itself plus
 * the WMS task routes its screens call (pick/pack/putaway/receiving/returns,
 * pack audits, carton catalogue). Read-only carriers/customers lookups are
 * allowed for the create-shipment screen. Everything else on the admin API
 * is off-limits to a scoped token — a magic link can hang on a printed QR
 * code, so a leaked one must not open the whole system.
 */
const WAREHOUSE_SCOPE_PREFIXES = [
  '/api/v1/warehouse/',
  '/api/v1/pick-tasks',
  '/api/v1/pick-lines/',
  '/api/v1/pack-tasks',
  '/api/v1/pack-lines/',
  '/api/v1/pack-audits',
  '/api/v1/putaway/',
  '/api/v1/receiving/',
  '/api/v1/rmas',
  '/api/v1/rma-lines/',
  '/api/v1/carton-catalogue',
];
const WAREHOUSE_SCOPE_READONLY_PREFIXES = [
  '/api/v1/carriers',
  '/api/v1/customers',
];

function warehouseScopeAllows(method: string, url: string): boolean {
  const path = url.split('?')[0];
  if (WAREHOUSE_SCOPE_PREFIXES.some(p => path.startsWith(p))) return true;
  if (method === 'GET' && WAREHOUSE_SCOPE_READONLY_PREFIXES.some(p => path.startsWith(p))) return true;
  return false;
}

/**
 * Fastify preHandler hook: extracts and validates JWT from Authorization header.
 * Sets req.user if valid. Sends 401 if missing or invalid, 403 when a
 * warehouse-scoped session tries to reach a non-warehouse route.
 */
export async function authenticateJWT(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    reply.code(401).send({ data: null, error: 'Authorization header required' });
    return;
  }

  const token = authHeader.slice(7);

  let payload: JWTPayload;
  try {
    payload = verifyJWT(token);
  } catch {
    reply.code(401).send({ data: null, error: 'Invalid or expired token' });
    return;
  }

  if (payload.scope === 'warehouse' && !warehouseScopeAllows(req.method, req.url)) {
    reply.code(403).send({ data: null, error: 'Warehouse session cannot access this resource' });
    return;
  }

  req.user = payload;
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
 * Fastify preHandler hook: extracts and validates carrier JWT from Authorization header.
 * Sets req.carrierUser if valid. Sends 401 if missing or invalid.
 */
export async function authenticateCarrierJWT(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    reply.code(401).send({ data: null, error: 'Authorization header required' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    // Verify signature and expiry directly (verifyJWT rejects non-'open-tms-auth' issuers)
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Invalid token format');

    const [headerB64, payloadB64, signatureB64] = parts;
    const expectedSig = createHmac('sha256', JWT_SECRET)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64url');

    if (signatureB64 !== expectedSig) throw new Error('Invalid signature');

    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString()) as CarrierJWTPayload;
    if (payload.exp && payload.exp * 1000 < Date.now()) throw new Error('Token expired');
    if (payload.iss !== 'open-tms-carrier' || !payload.carrierId) throw new Error('Invalid carrier token');

    req.carrierUser = payload;
  } catch {
    reply.code(401).send({ data: null, error: 'Invalid or expired token' });
  }
}

/**
 * Fastify preHandler hook: extracts and validates customer JWT from Authorization header.
 * Sets req.customerUser if valid. Sends 401 if missing or invalid.
 */
export async function authenticateCustomerJWT(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    reply.code(401).send({ data: null, error: 'Authorization header required' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    // Verify signature and expiry manually (shared verifyJWT checks for 'open-tms-auth' issuer)
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Invalid token format');

    const [headerB64, payloadB64, signatureB64] = parts;
    const { createHmac } = await import('crypto');
    const expectedSig = createHmac('sha256', JWT_SECRET)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64url');

    if (signatureB64 !== expectedSig) throw new Error('Invalid signature');

    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString()) as CustomerJWTPayload;
    if (payload.exp && payload.exp * 1000 < Date.now()) throw new Error('Token expired');
    if (payload.iss !== 'open-tms-customer' || !payload.customerId) throw new Error('Invalid customer token');

    req.customerUser = payload;
  } catch {
    reply.code(401).send({ data: null, error: 'Invalid or expired token' });
  }
}

/**
 * Verify HS256 signature + expiry without asserting an issuer.
 * Callers are responsible for checking `iss` themselves.
 */
function verifySignatureAndExpiry(token: string): Record<string, any> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token format');

  const [headerB64, payloadB64, signatureB64] = parts;
  const expectedSig = createHmac('sha256', JWT_SECRET)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64url');

  if (signatureB64 !== expectedSig) throw new Error('Invalid signature');

  const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
  if (payload.exp && payload.exp * 1000 < Date.now()) throw new Error('Token expired');

  return payload;
}

/**
 * Fastify preHandler hook for endpoints shared by the main TMS app and the
 * customer portal — currently the pure-compute order line item helpers
 * (mode rules, cartonization preview), which perform no writes and expose
 * no tenant data, so serving both audiences is safe.
 *
 * Sets `req.user` for an internal token or `req.customerUser` for a
 * customer-portal token. Sends 401 if the token is missing, malformed,
 * expired, or carries any other issuer.
 *
 * Note: routes using this must NOT sit inside the global `authenticatedRoutes`
 * block in index.ts — that block's onRequest hook rejects customer tokens
 * before this ever runs.
 */
export async function authenticateMainOrCustomerJWT(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    reply.code(401).send({ data: null, error: 'Authorization header required' });
    return;
  }

  try {
    const payload = verifySignatureAndExpiry(authHeader.slice(7));

    if (payload.iss === 'open-tms-customer') {
      if (!payload.customerId) throw new Error('Invalid customer token');
      req.customerUser = payload as CustomerJWTPayload;
      return;
    }

    // Internal tokens carry 'open-tms-auth' or omit iss entirely (matches verifyJWT).
    if (!payload.iss || payload.iss === 'open-tms-auth') {
      req.user = payload as JWTPayload;
      return;
    }

    throw new Error('Invalid issuer');
  } catch {
    reply.code(401).send({ data: null, error: 'Invalid or expired token' });
  }
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
