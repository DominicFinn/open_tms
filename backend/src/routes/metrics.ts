/**
 * Metrics endpoint — exposes key system metrics in a simple JSON format.
 *
 * GET /metrics — returns queue depths, event counts, projection status,
 * and command execution stats. Can be scraped by monitoring tools or
 * adapted to Prometheus format later.
 */

import { FastifyInstance } from 'fastify';
import { container } from '../di/container.js';
import { TOKENS } from '../di/tokens.js';
import { IQueueAdapter } from '../queue/IQueueAdapter.js';

export async function metricsRoutes(server: FastifyInstance) {
  server.get('/metrics', async () => {
    const prisma = server.prisma;

    // Event store metrics
    const totalEvents = await prisma.domainEventLog.count();
    const recentEvents = await prisma.domainEventLog.count({
      where: { createdAt: { gte: new Date(Date.now() - 3600000) } }, // last hour
    });

    // Event counts by type (last hour)
    const eventsByType = await prisma.domainEventLog.groupBy({
      by: ['type'],
      where: { createdAt: { gte: new Date(Date.now() - 3600000) } },
      _count: { id: true },
    });

    // Read model counts
    const [orderReadCount, shipmentReadCount, carrierReadCount, customerReadCount, laneReadCount, issueReadCount] =
      await Promise.all([
        prisma.orderReadModel.count(),
        prisma.shipmentReadModel.count(),
        prisma.carrierReadModel.count(),
        prisma.customerReadModel.count(),
        prisma.laneReadModel.count(),
        prisma.issueReadModel.count(),
      ]);

    // Write model counts (for lag comparison)
    const [orderCount, shipmentCount, carrierCount, customerCount, laneCount, issueCount] =
      await Promise.all([
        prisma.order.count({ where: { archived: false } }),
        prisma.shipment.count({ where: { archived: false } }),
        prisma.carrier.count({ where: { archived: false } }),
        prisma.customer.count({ where: { archived: false } }),
        prisma.lane.count({ where: { archived: false } }),
        prisma.issue.count(),
      ]);

    // Queue stats (if available)
    let queueStats: any[] = [];
    try {
      const queue = container.resolve<IQueueAdapter>(TOKENS.IQueueAdapter);
      queueStats = await queue.getAllQueueStats();
    } catch {
      // Queue may not be available in API-only mode
    }

    // Projection checkpoints
    const checkpoints = await prisma.projectionCheckpoint.findMany();

    return {
      timestamp: new Date().toISOString(),
      events: {
        total: totalEvents,
        lastHour: recentEvents,
        byType: eventsByType.map((e) => ({ type: e.type, count: e._count.id })),
      },
      readModels: {
        order: { readModel: orderReadCount, writeModel: orderCount, lag: orderCount - orderReadCount },
        shipment: { readModel: shipmentReadCount, writeModel: shipmentCount, lag: shipmentCount - shipmentReadCount },
        carrier: { readModel: carrierReadCount, writeModel: carrierCount, lag: carrierCount - carrierReadCount },
        customer: { readModel: customerReadCount, writeModel: customerCount, lag: customerCount - customerReadCount },
        lane: { readModel: laneReadCount, writeModel: laneCount, lag: laneCount - laneReadCount },
        issue: { readModel: issueReadCount, writeModel: issueCount, lag: issueCount - issueReadCount },
      },
      projectionCheckpoints: checkpoints,
      queues: queueStats,
    };
  });
}
