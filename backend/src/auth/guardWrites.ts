import { FastifyRequest, FastifyReply } from 'fastify';
import { requirePermission } from '../middleware/jwtAuth.js';

/**
 * Plugin-level preHandler that enforces write authorization for a resource.
 *
 * Reads stay open (GET/HEAD/OPTIONS pass through), matching our "gate writes +
 * destructive actions only" policy. Every other method requires the resource's
 * write permission — DELETE requires `<resource>:delete`, everything else
 * `<resource>:write`. Admin (`*`) and `<resource>:*` holders satisfy both via
 * the wildcard matching in requirePermission.
 *
 * Some POST endpoints are really reads (calculate / preview / search / test).
 * Pass their path fragments in `readPaths` to let them through.
 *
 * Usage (after registerOrgScope):
 *   server.addHook('preHandler', guardWrites('carriers'));
 *   server.addHook('preHandler', guardWrites('quotes', { readPaths: ['/rate', '/preview'] }));
 */
export function guardWrites(resource: string, opts?: { readPaths?: (string | RegExp)[] }) {
  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const method = req.method;
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return;

    if (opts?.readPaths?.some((p) => (typeof p === 'string' ? req.url.includes(p) : p.test(req.url)))) {
      return;
    }

    const permission = method === 'DELETE' ? `${resource}:delete` : `${resource}:write`;
    await requirePermission(permission)(req, reply);
  };
}
