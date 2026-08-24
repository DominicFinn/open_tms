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

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export async function registerWmsGuard(server: FastifyInstance): Promise<void> {
  server.addHook('preHandler', async (req: FastifyRequest, reply: FastifyReply) => {
    const permission = READ_METHODS.has(req.method) ? 'wms:read' : 'wms:write';
    await requirePermission(permission)(req, reply);
  });
}
