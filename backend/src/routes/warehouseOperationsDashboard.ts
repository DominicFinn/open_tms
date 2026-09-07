import { FastifyInstance, FastifyRequest } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { container, TOKENS } from '../di/index.js';
import { WarehouseOperationsDashboardService } from '../services/warehouse/WarehouseOperationsDashboardService.js';
import { registerWmsGuard } from '../auth/wmsGuard.js';
import { registerOrgScope } from '../auth/orgScopeMiddleware.js';

export async function warehouseOperationsDashboardRoutes(server: FastifyInstance) {
  // Tenant comes from the caller's token via registerOrgScope, not from whichever
  // Organization row comes back first (#117).
  await registerOrgScope(server);

  // WMS permission guard (#134): wms:read for reads, wms:write for mutations
  await registerWmsGuard(server);

  const prisma = container.resolve<PrismaClient>(TOKENS.PrismaClient);
  const service = new WarehouseOperationsDashboardService(prisma);

  server.get('/api/v1/wms/operations-dashboard', {
    schema: {
      tags: ['WMS - Operations Dashboard'],
      summary: 'Aggregate warehouse operations KPIs (throughput, cycle times, quality, live work, exceptions, capacity)',
    },
  }, async (req: FastifyRequest) => {
    const orgId = (req as any).orgId
;
    const snapshot = await service.buildSnapshot(orgId);
    return { data: snapshot, error: null };
  });
}
