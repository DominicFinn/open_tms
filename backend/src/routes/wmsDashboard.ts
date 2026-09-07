import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { container, TOKENS } from '../di/index.js';
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
        required: ['locationId'],
        properties: { locationId: { type: 'string', format: 'uuid' } },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { locationId } = req.query as { locationId: string };
    const c = await repo.countsForLocation(req.orgId!, locationId);

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
