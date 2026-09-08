import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { container, TOKENS } from '../di/index.js';
import { WAREHOUSE_SCOPE_QUERY, WAREHOUSE_SCOPE_ONE_OF, warehouseScopeFrom } from '../repositories/warehouseScope.js';
import { IWmsDashboardRepository } from '../repositories/WmsDashboardRepository.js';
import { registerWmsGuard } from '../auth/wmsGuard.js';

export async function wmsDashboardRoutes(server: FastifyInstance) {
  // WMS permission guard (#134): wms:read for reads, wms:write for mutations
  await registerWmsGuard(server);

  const repo = container.resolve<IWmsDashboardRepository>(TOKENS.IWmsDashboardRepository);

  // GET /api/v1/wms/dashboard?locationId=xxx
  server.get('/api/v1/wms/dashboard', {
    schema: {
      tags: ['WMS - Dashboard'],
      summary: 'Warehouse operations dashboard stats',
      querystring: {
        type: 'object',
        oneOf: WAREHOUSE_SCOPE_ONE_OF,
        properties: { ...WAREHOUSE_SCOPE_QUERY },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const q = req.query as { facilityId?: string; locationId?: string; };
    const c = await repo.counts(req.orgId!, warehouseScopeFrom(q));

    // The response keeps its shape: the totals are derived here rather than counted twice.
    return {
      data: {
        zones: c.zones,
        bins: c.bins,
        activeBins: c.activeBins,
        totalSkus: c.totalSkus,
        receivingTasks: c.receivingPending + c.receivingInProgress,
        receivingPending: c.receivingPending,
        receivingInProgress: c.receivingInProgress,
        putawayTasks: c.putawayTasks,
        pickTasks: c.pickPending + c.pickInProgress,
        pickPending: c.pickPending,
        pickInProgress: c.pickInProgress,
        packTasks: c.packPending + c.packInProgress,
        packPending: c.packPending,
        packInProgress: c.packInProgress,
        stagedCount: c.stagedCount,
      },
      error: null,
    };
  });
}
