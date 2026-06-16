/**
 * Metrics endpoint — exposes key system metrics in a simple JSON format.
 *
 * GET /metrics — returns queue depths, event counts, projection status,
 * and command execution stats. Can be scraped by monitoring tools or
 * adapted to Prometheus format later.
 *
 * Multi-tenancy: all counts are scoped to the caller's `req.orgId`. The
 * endpoint was previously returning platform-wide totals, which leaked
 * cross-tenant volume to anyone with a valid JWT. The lag indicator
 * (writeModel - readModel) still works per tenant — a stuck projection in
 * one tenant shows up there. Projection checkpoints stay platform-level
 * because they're a single per-projection cursor, not per-tenant state.
 */

import { FastifyInstance, FastifyRequest } from 'fastify';
import { container } from '../di/container.js';
import { TOKENS } from '../di/tokens.js';
import { IQueueAdapter } from '../queue/IQueueAdapter.js';
import { registerOrgScope } from '../auth/orgScopeMiddleware.js';

export async function metricsRoutes(server: FastifyInstance) {
  await registerOrgScope(server);

  server.get('/metrics', async (req: FastifyRequest) => {
    const prisma = server.prisma;
    const orgId = req.orgId!;
    const lastHourCutoff = new Date(Date.now() - 3600000);

    // Event store metrics (tenant-scoped — DomainEventLog carries orgId)
    const totalEvents = await prisma.domainEventLog.count({ where: { orgId } });
    const recentEvents = await prisma.domainEventLog.count({
      where: { orgId, createdAt: { gte: lastHourCutoff } },
    });

    const eventsByType = await prisma.domainEventLog.groupBy({
      by: ['type'],
      where: { orgId, createdAt: { gte: lastHourCutoff } },
      _count: { id: true },
    });

    // Read model counts (all carry orgId)
    const [orderReadCount, shipmentReadCount, carrierReadCount, customerReadCount, laneReadCount, issueReadCount] =
      await Promise.all([
        prisma.orderReadModel.count({ where: { orgId } }),
        prisma.shipmentReadModel.count({ where: { orgId } }),
        prisma.carrierReadModel.count({ where: { orgId } }),
        prisma.customerReadModel.count({ where: { orgId } }),
        prisma.laneReadModel.count({ where: { orgId } }),
        prisma.issueReadModel.count({ where: { orgId } }),
      ]);

    // Write model counts (for lag comparison) — all tenant-scoped
    const [orderCount, shipmentCount, carrierCount, customerCount, laneCount, issueCount, agentDecisionCount, agentDecisionReadCount] =
      await Promise.all([
        prisma.order.count({ where: { orgId, archived: false } }),
        prisma.shipment.count({ where: { orgId, archived: false } }),
        prisma.carrier.count({ where: { orgId, archived: false } }),
        prisma.customer.count({ where: { orgId, archived: false } }),
        prisma.lane.count({ where: { orgId, archived: false } }),
        prisma.issue.count({ where: { orgId } }),
        prisma.agentDecision.count({ where: { orgId } }),
        prisma.agentDecisionReadModel.count({ where: { orgId } }),
      ]);

    // Agent usage (last hour, tenant-scoped)
    const agentLastHour = await prisma.agentDecision.aggregate({
      where: { orgId, createdAt: { gte: lastHourCutoff } },
      _count: true,
      _sum: { inputTokens: true, outputTokens: true },
    });

    // Queue stats (platform-level — pg-boss queues aren't tenant-partitioned)
    let queueStats: any[] = [];
    try {
      const queue = container.resolve<IQueueAdapter>(TOKENS.IQueueAdapter);
      queueStats = await queue.getAllQueueStats();
    } catch {
      // Queue may not be available in API-only mode
    }

    // Projection checkpoints — one per projection, NOT per tenant by design.
    // These reflect platform-level projection health. If you need a stronger
    // boundary here, gate the /metrics endpoint behind an admin role.
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
        agentDecision: { readModel: agentDecisionReadCount, writeModel: agentDecisionCount, lag: agentDecisionCount - agentDecisionReadCount },
      },
      agents: {
        totalDecisions: agentDecisionCount,
        lastHour: {
          invocations: agentLastHour._count,
          inputTokens: agentLastHour._sum.inputTokens || 0,
          outputTokens: agentLastHour._sum.outputTokens || 0,
        },
      },
      projectionCheckpoints: checkpoints,
      queues: queueStats,
    };
  });
}
