import { FastifyInstance, FastifyRequest } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { container, TOKENS } from '../di/index.js';
import { WarehouseOperationsDashboardService } from '../services/warehouse/WarehouseOperationsDashboardService.js';

export async function warehouseOperationsDashboardRoutes(server: FastifyInstance) {
  const prisma = container.resolve<PrismaClient>(TOKENS.PrismaClient);
  const service = new WarehouseOperationsDashboardService(prisma);

  server.get('/api/v1/wms/operations-dashboard', {
    schema: {
      tags: ['WMS - Operations Dashboard'],
      summary: 'Aggregate warehouse operations KPIs (throughput, cycle times, quality, live work, exceptions, capacity)',
    },
  }, async (req: FastifyRequest) => {
    const orgId = (req as any).orgId
      || (await prisma.organization.findFirst({ select: { id: true } }))?.id
      || 'default-org';
    const snapshot = await service.buildSnapshot(orgId);
    return { data: snapshot, error: null };
  });
}
