import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { container, TOKENS } from '../di/index.js';
import { PrismaClient } from '@prisma/client';

export async function wmsDashboardRoutes(server: FastifyInstance) {
  const prisma = container.resolve<PrismaClient>(TOKENS.PrismaClient);

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

    const [
      zones, bins, activeBins,
      skuCount,
      receivingPending, receivingInProgress,
      putawayPending,
      pickPending, pickInProgress,
      packPending, packInProgress,
      stagedCount,
    ] = await Promise.all([
      prisma.warehouseZone.count({ where: { locationId, active: true } }),
      prisma.warehouseBin.count({ where: { locationId } }),
      prisma.warehouseBin.count({ where: { locationId, active: true } }),
      prisma.inventoryRecord.groupBy({ by: ['sku'], where: { locationId, quantityOnHand: { gt: 0 } } }).then(r => r.length),
      prisma.receivingTask.count({ where: { locationId, status: 'pending' } }),
      prisma.receivingTask.count({ where: { locationId, status: 'in_progress' } }),
      prisma.putawayTask.count({ where: { locationId, status: { in: ['pending', 'assigned'] } } }),
      prisma.pickTask.count({ where: { locationId, status: 'pending' } }),
      prisma.pickTask.count({ where: { locationId, status: { in: ['assigned', 'in_progress'] } } }),
      prisma.packTask.count({ where: { locationId, status: 'pending' } }),
      prisma.packTask.count({ where: { locationId, status: 'in_progress' } }),
      prisma.stagingAssignment.count({ where: { locationId, status: 'staged' } }),
    ]);

    return {
      data: {
        zones,
        bins,
        activeBins,
        totalSkus: skuCount,
        receivingTasks: receivingPending + receivingInProgress,
        receivingPending,
        receivingInProgress,
        putawayTasks: putawayPending,
        pickTasks: pickPending + pickInProgress,
        pickPending,
        pickInProgress,
        packTasks: packPending + packInProgress,
        packPending,
        packInProgress,
        stagedCount,
      },
      error: null,
    };
  });
}
