import { PrismaClient } from '@prisma/client';
import type { IOperationsSignals, OperationsSignals } from '../../ports/operationsSignals.js';

const OPEN_ISSUE = { in: ['open', 'in_progress'] };
const DISPATCHED = { in: ['in_transit', 'delivered'] };
const RMA_IN_PROGRESS = { in: ['authorized', 'in_transit', 'received', 'inspecting'] };

/** The full product's answer to the warehouse dashboard's outside signals (#359). */
export class OperationsSignalsSource implements IOperationsSignals {
  constructor(private prisma: PrismaClient) {}

  async current(orgId: string): Promise<OperationsSignals> {
    const [openIssues, criticalIssues, cutoffCritical, cutoffWarning, pendingRmas] = await Promise.all([
      this.prisma.issue.count({ where: { orgId, status: OPEN_ISSUE } }),
      this.prisma.issue.count({ where: { orgId, status: OPEN_ISSUE, priority: 'critical' } }),
      this.prisma.shipment.count({ where: { orgId, lastCutoffRiskSeverity: 'critical' } }),
      this.prisma.shipment.count({ where: { orgId, lastCutoffRiskSeverity: 'warning' } }),
      this.prisma.rma.count({ where: { orgId, status: RMA_IN_PROGRESS } }),
    ]);
    return { openIssues, criticalIssues, cutoffCritical, cutoffWarning, pendingRmas };
  }

  shipmentsDispatchedSince(orgId: string, since: Date): Promise<number> {
    return this.prisma.shipment.count({ where: { orgId, status: DISPATCHED, updatedAt: { gte: since } } });
  }

  async orderToShip(orgId: string, since: Date): Promise<{ averageHours: number | null; samples: number }> {
    // A sample of dispatched shipments, each joined back to its orders' creation times.
    const recentDispatched = await this.prisma.shipment.findMany({
      where: { orgId, status: DISPATCHED, updatedAt: { gte: since } },
      select: { updatedAt: true, orderShipments: { select: { order: { select: { createdAt: true } } } } },
      take: 500,
    });
    const spans: number[] = [];
    for (const s of recentDispatched) {
      for (const os of s.orderShipments) {
        if (os.order) spans.push(s.updatedAt.getTime() - os.order.createdAt.getTime());
      }
    }
    const averageHours = spans.length === 0
      ? null
      : Math.round((spans.reduce((a, b) => a + b, 0) / spans.length / 3_600_000) * 10) / 10;
    return { averageHours, samples: spans.length };
  }
}
