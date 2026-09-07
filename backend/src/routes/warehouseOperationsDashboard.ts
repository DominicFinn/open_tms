import { FastifyInstance, FastifyRequest } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { container, TOKENS } from '../di/index.js';
import { WarehouseOperationsDashboardService } from '../services/warehouse/WarehouseOperationsDashboardService.js';
import { registerWmsGuard } from '../auth/wmsGuard.js';

export async function warehouseOperationsDashboardRoutes(server: FastifyInstance) {
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
    // Was resolving the org with organization.findFirst(), which the security rule forbids
    // outright: it silently returns the first organization for every caller, so every tenant saw
    // whichever one happens to sort first. Scope comes from the token (#220).
    const snapshot = await service.buildSnapshot(req.orgId!);
    return { data: snapshot, error: null };
  });
}
