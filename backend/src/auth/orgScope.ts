/**
 * Multi-tenancy: shared helpers for resolving the requesting tenant.
 *
 * Phase 2 of the multi-tenancy remediation plan extracted this from the
 * per-route copies. Every authed route now reads the orgId the same way:
 * prefer the JWT, fall back to the first Organization only when no JWT is
 * attached (dev / seed / unauthed scripts that share the Fastify instance).
 *
 * Routes never use `prisma.organization.findFirst()` directly anymore — if
 * they did, multiple Organizations would silently leak across tenants.
 */

import type { FastifyRequest } from 'fastify';
import type { PrismaClient } from '@prisma/client';

let fallbackCache: { orgId: string; cachedAt: number } | null = null;
const FALLBACK_TTL_MS = 60_000;

/**
 * Resolve the requesting tenant's orgId. Prefers `req.user.organizationId`
 * from the JWT; falls back to the first Organization in the database only
 * if the request has no JWT attached.
 *
 * The fallback is cached for 60 seconds so the dev/seed path doesn't issue
 * a database round-trip on every request.
 */
export async function resolveOrgId(
  req: FastifyRequest,
  prisma: PrismaClient,
): Promise<string> {
  const fromJwt = req.user?.organizationId;
  if (fromJwt) return fromJwt;

  if (fallbackCache && Date.now() - fallbackCache.cachedAt < FALLBACK_TTL_MS) {
    return fallbackCache.orgId;
  }

  const org = await prisma.organization.findFirst({ select: { id: true } });
  const orgId = org?.id || 'default-org';
  fallbackCache = { orgId, cachedAt: Date.now() };
  return orgId;
}

/**
 * Resolve the requesting actor's user id. Returns `null` when the request
 * has no JWT — callers can decide whether to treat that as `'system'` for
 * audit purposes or refuse the operation.
 */
export function resolveActorId(req: FastifyRequest): string | null {
  return req.user?.sub ?? null;
}

/** Test-only: drop the cached fallback so a unit test can re-prime it. */
export function resetOrgScopeCache(): void {
  fallbackCache = null;
}
