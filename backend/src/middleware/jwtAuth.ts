import { FastifyRequest, FastifyReply } from 'fastify';
import { createHmac } from 'crypto';

/**
 * JWT payload for an internal user session, as minted by AuthService.
 */
export interface JWTPayload {
  sub: string;
  email: string;
  roles: string[];
  permissions: string[];
  organizationId?: string;
  customerId?: string;
  /**
   * A surface restriction carried by sessions the removed warehouse and inventory apps minted.
   * Nothing issues one any more, and verifyJWT refuses a token that has it.
   */
  scope?: string;
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

  // SECURITY: a scoped token was a restricted warehouse or inventory session. The routes it was
  // restricted to are gone, so honouring it now would turn a leaked operative token into a full
  // admin session. Refuse it until it expires.
  if (payload.scope !== undefined) {
    throw new Error('Scoped sessions are no longer accepted');
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

  let payload: JWTPayload;
  try {
    payload = verifyJWT(token);
  } catch {
    reply.code(401).send({ data: null, error: 'Invalid or expired token' });
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

/**
 * Share-link viewer session.
 *
 * Issued by POST /api/v1/share/:token/authenticate once the recipient has supplied the access
 * code. It carries the link it came from and the sections that link grants, and it is scoped to
 * a single shipment. `iss` is `open-tms-share`, which no other guard accepts, so a viewer token
 * cannot reach the admin API or either portal.
 *
 * The granted sections travel in the token for convenience, but the share read path re-checks
 * them against the stored link on every request — a link edited or revoked mid-session takes
 * effect immediately rather than at the end of the session.
 */
export interface ShareViewerJWTPayload {
  /** ShipmentShareLink id. */
  sub: string;
  shipmentId: string;
  orgId: string;
  sections: string[];
  iat?: number;
  exp?: number;
  iss?: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    shareViewer?: ShareViewerJWTPayload;
  }
}

export async function authenticateShareViewerJWT(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    reply.code(401).send({ data: null, error: 'Authorization header required' });
    return;
  }

  try {
    const payload = verifySignatureAndExpiry(authHeader.slice(7)) as ShareViewerJWTPayload;
    if (payload.iss !== 'open-tms-share' || !payload.sub || !payload.shipmentId || !payload.orgId) {
      throw new Error('Invalid share token');
    }
    req.shareViewer = payload;
  } catch {
    reply.code(401).send({ data: null, error: 'Invalid or expired session' });
  }
}
