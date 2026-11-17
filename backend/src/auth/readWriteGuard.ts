/**
 * Read/write permission guard for a route plugin (#134).
 *
 * One plugin-level hook rather than per-route preHandlers, for surfaces whose permission model is
 * deliberately coarse: `<resource>:read` for reads and `<resource>:write` for everything else,
 * decided by HTTP method. Finer-grained permissions can layer on top when a real need appears.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requirePermission } from '../middleware/jwtAuth.js';
import { registerOrgScope, requireOrgScope } from './orgScopeMiddleware.js';

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Tenancy lives here as well as in index.ts (#238, #303), so a plugin that calls the guard stays
 * scoped wherever it is mounted, and the permission check always runs after the tenant is known.
 * `requireOrgScope` refuses a request that resolved no tenant at all, so a handler never runs
 * with a null scope.
 */
export async function registerReadWriteGuard(server: FastifyInstance, resource: string): Promise<void> {
  await registerOrgScope(server);

  server.addHook('preHandler', requireOrgScope);

  server.addHook('preHandler', async (req: FastifyRequest, reply: FastifyReply) => {
    const permission = READ_METHODS.has(req.method) ? `${resource}:read` : `${resource}:write`;
    await requirePermission(permission)(req, reply);
  });
}
