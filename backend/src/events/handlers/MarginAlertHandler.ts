/**
 * MarginAlertHandler - monitors charge events and creates issues
 * when shipment margin drops below the configured threshold.
 *
 * Only active when Organization.marginAlertEnabled is true.
 */

import { PrismaClient } from '@prisma/client';
import { DomainEvent } from '../DomainEvent.js';
import { IEventHandler } from '../IEventHandler.js';
import { SubscribeOptions } from '../IEventBus.js';
import { EVENT_TYPES } from '../eventTypes.js';

export class MarginAlertHandler implements IEventHandler {
  readonly name = 'handler.margin_alert';
  readonly eventPatterns = ['charge.*'];
  readonly options: SubscribeOptions = {
    concurrency: 2,
    priority: 8,
    retryLimit: 3,
    expireInSeconds: 300,
  };

  constructor(private prisma: PrismaClient) {}

  async handle(event: DomainEvent): Promise<void> {
    if (event.type !== EVENT_TYPES.CHARGE_CREATED && event.type !== EVENT_TYPES.CHARGE_APPROVED) {
      return;
    }

    const payload = event.payload as { shipmentId?: string };
    if (!payload.shipmentId) return;

    // Check if margin alerts are enabled
    const org = await this.prisma.organization.findFirst({
      select: {
        id: true,
        marginAlertEnabled: true,
        minMarginPercent: true,
      },
    });

    if (!org?.marginAlertEnabled || org.minMarginPercent == null) return;

    const threshold = Number(org.minMarginPercent);
    if (threshold <= 0) return;

    // Get the financial summary for this shipment
    const summary = await this.prisma.shipmentFinancialSummary.findUnique({
      where: { shipmentId: payload.shipmentId },
    });

    if (!summary) return;

    // Use actual values if available, else expected
    const revenue = summary.actualRevenueCents || summary.expectedRevenueCents;
    const cost = summary.actualCostCents || summary.expectedCostCents;

    if (revenue <= 0) return;

    const margin = revenue - cost;
    const marginPct = (margin / revenue) * 100;

    if (marginPct >= threshold) return;

    // Margin is below threshold - check if we already have an open issue for this
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: payload.shipmentId },
      select: { id: true, reference: true },
    });

    if (!shipment) return;

    const existingIssue = await this.prisma.issue.findFirst({
      where: {
        sourceEntityType: 'shipment',
        sourceEntityId: payload.shipmentId,
        category: 'margin_alert',
        status: { in: ['open', 'in_progress'] },
      },
    });

    if (existingIssue) {
      // Already have an open margin alert for this shipment
      return;
    }

    // Create a margin alert issue
    await this.prisma.issue.create({
      data: {
        orgId: org.id,
        title: `Low margin on ${shipment.reference}: ${marginPct.toFixed(1)}% (threshold: ${threshold}%)`,
        description: `Shipment ${shipment.reference} margin has dropped below the configured threshold.\n\nRevenue: $${(revenue / 100).toFixed(2)}\nCost: $${(cost / 100).toFixed(2)}\nMargin: $${(margin / 100).toFixed(2)} (${marginPct.toFixed(1)}%)\nThreshold: ${threshold}%`,
        category: 'margin_alert',
        priority: marginPct < 0 ? 'critical' : 'high',
        status: 'open',
        sourceEntityType: 'shipment',
        sourceEntityId: payload.shipmentId,
      },
    });

    console.log(`[MarginAlertHandler] Created margin alert for ${shipment.reference}: ${marginPct.toFixed(1)}% < ${threshold}%`);
  }
}
