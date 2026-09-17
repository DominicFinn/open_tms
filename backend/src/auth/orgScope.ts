/**
 * Multi-tenancy: shared helpers for resolving the requesting tenant.
 *
 * Every authed route reads the orgId the same way: from the JWT. There is one fallback, for tokens
 * that carry no `organizationId` (dev users, seed scripts, users created before the claim existed),
 * and it only applies when the database holds exactly one Organization.
 *
 * Routes never use `prisma.organization.findFirst()` directly. If they did, multiple Organizations
 * would silently leak across tenants.
 */

import type { FastifyRequest } from 'fastify';
import type { PrismaClient } from '@prisma/client';

/**
 * Resolve the requesting tenant's orgId, or null when the request has no tenant.
 *
 * BUSINESS RULE (#239): a token without `organizationId` is served the sole Organization only when
 * exactly one exists. With one org there is no other tenant to leak into, so dev, seed and
 * single-tenant deployments keep working. With two or more we cannot know which org the caller
 * belongs to, so we return null and `requireOrgScope` refuses the request. This used to fall back
 * to the first Organization row, which served tenant A's data to anyone whose token lacked a claim.
 *
 * Not cached: a cached "sole org" would keep serving it for the cache lifetime after a second org
 * is created, which is the leak this rule exists to close. The lookup only runs for tokens without
 * the claim, and it reads at most two ids.
 */
export async function resolveOrgId(
  req: FastifyRequest,
  prisma: PrismaClient,
): Promise<string | null> {
  const fromJwt = req.user?.organizationId;
  if (fromJwt) return fromJwt;
  return resolveSoleOrganizationId(prisma);
}

/** The only Organization's id, or null when there are none or several. */
export async function resolveSoleOrganizationId(prisma: PrismaClient): Promise<string | null> {
  const orgs = await prisma.organization.findMany({ select: { id: true }, take: 2 });
  return orgs.length === 1 ? orgs[0].id : null;
}

/**
 * Resolve the requesting actor's user id. Returns `null` when the request
 * has no JWT — callers can decide whether to treat that as `'system'` for
 * audit purposes or refuse the operation.
 */
export function resolveActorId(req: FastifyRequest): string | null {
  return req.user?.sub ?? null;
}
