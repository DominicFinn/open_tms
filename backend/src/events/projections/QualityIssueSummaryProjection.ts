/**
 * QualityIssueSummaryProjection - maintains aggregated quality metrics
 * by carrier, lane, location, and customer.
 *
 * On every issue.created, issue.updated, issue.status_changed, issue.closed,
 * and issue.needs_capa_marked event, it resolves the source entity (shipment)
 * to find the linked carrier, lane, origin/destination locations, and customer,
 * then upserts the QualityIssueSummary rows.
 */

import { PrismaClient } from '@prisma/client';
import { DomainEvent } from '../DomainEvent.js';
import { IEventHandler } from '../IEventHandler.js';
import { SubscribeOptions } from '../IEventBus.js';

export class QualityIssueSummaryProjection implements IEventHandler {
  readonly name = 'projection.quality_issue_summary';
  readonly eventPatterns = ['issue.*'];
  readonly options: SubscribeOptions = {
    concurrency: 2,
    priority: 3,
    retryLimit: 3,
    expireInSeconds: 600,
  };

  constructor(private prisma: PrismaClient) {}

  async handle(event: DomainEvent): Promise<void> {
    // Only rebuild on events that affect counts
    const relevantEvents = [
      'issue.created',
      'issue.updated',
      'issue.status_changed',
      'issue.closed',
      'issue.reopened',
      'issue.resolved',
      'issue.needs_capa_marked',
    ];
    if (!relevantEvents.includes(event.type)) return;

    try {
      await this.rebuildForIssue(event.entityId, event.orgId);
    } catch (err: any) {
      console.error(`[QualityIssueSummaryProjection] Failed for issue ${event.entityId}: ${err.message}`);
    }
  }

  /**
   * Full rebuild of all quality summaries for an org.
   * Used by the backfill script and on-demand.
   */
  async rebuildAll(orgId: string): Promise<void> {
    // Get all issues for the org
    const issues = await this.prisma.issue.findMany({
      where: { orgId },
      select: {
        id: true,
        category: true,
        priority: true,
        status: true,
        needsCapa: true,
        sourceEntityType: true,
        sourceEntityId: true,
        createdAt: true,
        resolvedAt: true,
      },
    });

    // Build dimension maps
    const dimensionMap = new Map<string, {
      dimensionType: string;
      dimensionId: string;
      dimensionName: string;
      issues: typeof issues;
    }>();

    for (const issue of issues) {
      const dimensions = await this.resolveDimensions(issue.sourceEntityType, issue.sourceEntityId);
      for (const dim of dimensions) {
        const key = `${dim.type}:${dim.id}`;
        if (!dimensionMap.has(key)) {
          dimensionMap.set(key, {
            dimensionType: dim.type,
            dimensionId: dim.id,
            dimensionName: dim.name,
            issues: [],
          });
        }
        dimensionMap.get(key)!.issues.push(issue);
      }
    }

    // Delete existing summaries and recreate
    await this.prisma.qualityIssueSummary.deleteMany({ where: { orgId } });

    for (const [, dim] of dimensionMap) {
      const stats = this.computeStats(dim.issues);
      await this.prisma.qualityIssueSummary.create({
        data: {
          orgId,
          dimensionType: dim.dimensionType,
          dimensionId: dim.dimensionId,
          dimensionName: dim.dimensionName,
          ...stats,
        },
      });
    }
  }

  private async rebuildForIssue(issueId: string, orgId: string): Promise<void> {
    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
      select: {
        sourceEntityType: true,
        sourceEntityId: true,
      },
    });
    if (!issue) return;

    const dimensions = await this.resolveDimensions(issue.sourceEntityType, issue.sourceEntityId);

    for (const dim of dimensions) {
      await this.rebuildDimension(orgId, dim.type, dim.id, dim.name);
    }
  }

  private async rebuildDimension(
    orgId: string,
    dimensionType: string,
    dimensionId: string,
    dimensionName: string,
  ): Promise<void> {
    // Find all issues linked to this dimension
    const issueIds = await this.findIssueIdsForDimension(orgId, dimensionType, dimensionId);

    if (issueIds.length === 0) {
      // Remove the summary if no issues left
      await this.prisma.qualityIssueSummary.deleteMany({
        where: { orgId, dimensionType, dimensionId },
      });
      return;
    }

    const issues = await this.prisma.issue.findMany({
      where: { id: { in: issueIds } },
      select: {
        category: true,
        priority: true,
        status: true,
        needsCapa: true,
        createdAt: true,
        resolvedAt: true,
      },
    });

    const stats = this.computeStats(issues);

    await this.prisma.qualityIssueSummary.upsert({
      where: {
        orgId_dimensionType_dimensionId: { orgId, dimensionType, dimensionId },
      },
      create: {
        orgId,
        dimensionType,
        dimensionId,
        dimensionName,
        ...stats,
      },
      update: {
        dimensionName,
        ...stats,
      },
    });
  }

  private async findIssueIdsForDimension(
    orgId: string,
    dimensionType: string,
    dimensionId: string,
  ): Promise<string[]> {
    if (dimensionType === 'carrier') {
      const shipments = await this.prisma.shipment.findMany({
        where: { carrierId: dimensionId },
        select: { id: true },
      });
      const shipmentIds = shipments.map(s => s.id);
      if (shipmentIds.length === 0) return [];
      const issues = await this.prisma.issue.findMany({
        where: { orgId, sourceEntityType: 'shipment', sourceEntityId: { in: shipmentIds } },
        select: { id: true },
      });
      return issues.map(i => i.id);
    }

    if (dimensionType === 'customer') {
      // Shipments are linked to customers directly
      const shipments = await this.prisma.shipment.findMany({
        where: { customerId: dimensionId },
        select: { id: true },
      });
      const shipmentIds = shipments.map(s => s.id);
      if (shipmentIds.length === 0) return [];
      const issues = await this.prisma.issue.findMany({
        where: { orgId, sourceEntityType: 'shipment', sourceEntityId: { in: shipmentIds } },
        select: { id: true },
      });
      return issues.map(i => i.id);
    }

    if (dimensionType === 'lane') {
      const shipments = await this.prisma.shipment.findMany({
        where: { laneId: dimensionId },
        select: { id: true },
      });
      const shipmentIds = shipments.map(s => s.id);
      if (shipmentIds.length === 0) return [];
      const issues = await this.prisma.issue.findMany({
        where: { orgId, sourceEntityType: 'shipment', sourceEntityId: { in: shipmentIds } },
        select: { id: true },
      });
      return issues.map(i => i.id);
    }

    if (dimensionType === 'location') {
      const shipments = await this.prisma.shipment.findMany({
        where: {
          OR: [
            { originId: dimensionId },
            { destinationId: dimensionId },
          ],
        },
        select: { id: true },
      });
      const shipmentIds = shipments.map(s => s.id);
      if (shipmentIds.length === 0) return [];
      const issues = await this.prisma.issue.findMany({
        where: { orgId, sourceEntityType: 'shipment', sourceEntityId: { in: shipmentIds } },
        select: { id: true },
      });
      return issues.map(i => i.id);
    }

    return [];
  }

  private async resolveDimensions(
    sourceEntityType: string | null,
    sourceEntityId: string | null,
  ): Promise<{ type: string; id: string; name: string }[]> {
    if (!sourceEntityType || !sourceEntityId) return [];

    const dimensions: { type: string; id: string; name: string }[] = [];

    if (sourceEntityType === 'shipment') {
      const shipment = await this.prisma.shipment.findUnique({
        where: { id: sourceEntityId },
        select: {
          customerId: true,
          carrierId: true,
          laneId: true,
          originId: true,
          destinationId: true,
        },
      });
      if (!shipment) return [];

      // Carrier dimension
      if (shipment.carrierId) {
        const carrier = await this.prisma.carrier.findUnique({
          where: { id: shipment.carrierId },
          select: { name: true },
        });
        if (carrier) {
          dimensions.push({ type: 'carrier', id: shipment.carrierId, name: carrier.name });
        }
      }

      // Lane dimension
      if (shipment.laneId) {
        const lane = await this.prisma.lane.findUnique({
          where: { id: shipment.laneId },
          select: { name: true },
        });
        if (lane) {
          dimensions.push({ type: 'lane', id: shipment.laneId, name: lane.name });
        }
      }

      // Origin location dimension
      if (shipment.originId) {
        const origin = await this.prisma.location.findUnique({
          where: { id: shipment.originId },
          select: { name: true },
        });
        if (origin) {
          dimensions.push({ type: 'location', id: shipment.originId, name: origin.name });
        }
      }

      // Destination location dimension
      if (shipment.destinationId) {
        const dest = await this.prisma.location.findUnique({
          where: { id: shipment.destinationId },
          select: { name: true },
        });
        if (dest) {
          dimensions.push({ type: 'location', id: shipment.destinationId, name: dest.name });
        }
      }

      // Customer dimension (directly from shipment)
      if (shipment.customerId) {
        const customer = await this.prisma.customer.findUnique({
          where: { id: shipment.customerId },
          select: { name: true },
        });
        if (customer) {
          dimensions.push({ type: 'customer', id: shipment.customerId, name: customer.name });
        }
      }
    }

    return dimensions;
  }

  private computeStats(issues: {
    category: string;
    priority: string;
    status: string;
    needsCapa: boolean;
    createdAt: Date;
    resolvedAt: Date | null;
  }[]): Record<string, any> {
    const stats = {
      totalIssues: issues.length,
      exceptionCount: 0,
      delayCount: 0,
      damageCount: 0,
      complianceCount: 0,
      otherCount: 0,
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
      openCount: 0,
      inProgressCount: 0,
      resolvedCount: 0,
      closedCount: 0,
      capaCount: 0,
      avgResolutionHours: null as number | null,
      lastIssueAt: null as Date | null,
    };

    let totalResolutionMs = 0;
    let resolvedCount = 0;

    for (const issue of issues) {
      // Category counts
      switch (issue.category) {
        case 'exception': stats.exceptionCount++; break;
        case 'delay': stats.delayCount++; break;
        case 'damage': stats.damageCount++; break;
        case 'compliance': stats.complianceCount++; break;
        default: stats.otherCount++; break;
      }

      // Priority counts
      switch (issue.priority) {
        case 'critical': stats.criticalCount++; break;
        case 'high': stats.highCount++; break;
        case 'medium': stats.mediumCount++; break;
        case 'low': stats.lowCount++; break;
      }

      // Status counts
      switch (issue.status) {
        case 'open': stats.openCount++; break;
        case 'in_progress': stats.inProgressCount++; break;
        case 'resolved': stats.resolvedCount++; break;
        case 'closed': stats.closedCount++; break;
      }

      if (issue.needsCapa) stats.capaCount++;

      // Resolution time
      if (issue.resolvedAt) {
        totalResolutionMs += issue.resolvedAt.getTime() - issue.createdAt.getTime();
        resolvedCount++;
      }

      // Most recent issue
      if (!stats.lastIssueAt || issue.createdAt > stats.lastIssueAt) {
        stats.lastIssueAt = issue.createdAt;
      }
    }

    if (resolvedCount > 0) {
      stats.avgResolutionHours = (totalResolutionMs / resolvedCount) / (1000 * 60 * 60);
    }

    return stats;
  }
}
