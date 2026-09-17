/**
 * WMS route guard (#134).
 *
 * Until this existed, every WMS surface (/api/v1/wms*, waves, picking,
 * inventory, receiving, putaway, packing, ...) was gated only on "is
 * authenticated" — no WMS permission family existed at all.
 *
 * One plugin-level hook rather than per-route preHandlers: the WMS
 * permission model is deliberately coarse for now (read vs write by HTTP
 * method). Finer-grained permissions (config vs task execution) can layer
 * on top when a real need appears; see the wms.* grants in permissions.ts.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requirePermission } from '../middleware/jwtAuth.js';
import { registerOrgScope, requireOrgScope } from './orgScopeMiddleware.js';

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Tenancy lives here rather than in each WMS route plugin (#238).
 *
 * No WMS route registered the org scope, so `req.orgId` was undefined on every WMS request, and
 * Prisma reads `where: { orgId: undefined }` as no filter at all. Every list returned every
 * tenant's rows, which made the whole tenancy sweep (#220, #225, #227, #229, #231) inert at
 * runtime while looking correct in the source.
 *
 * Putting it in the guard every WMS plugin already calls means a new WMS route cannot forget it.
 *
 * `requireOrgScope` then refuses a request that resolved no tenant at all, so a WMS handler never
 * runs with a null scope.
 *
 * Since #239 a token without `organizationId` only resolves when exactly one Organization exists,
 * and since #303 index.ts applies the same strict scope to every authenticated route. The guard
 * keeps its own registration so a WMS plugin stays scoped wherever it is mounted, and so the
 * permission check below always runs after the tenant is known.
 */
export async function registerWmsGuard(server: FastifyInstance): Promise<void> {
  await registerOrgScope(server);

  server.addHook('preHandler', requireOrgScope);

  server.addHook('preHandler', async (req: FastifyRequest, reply: FastifyReply) => {
    const permission = READ_METHODS.has(req.method) ? 'wms:read' : 'wms:write';
    await requirePermission(permission)(req, reply);
  });
}
