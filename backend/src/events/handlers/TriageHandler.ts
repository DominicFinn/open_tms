/**
 * TriageHandler — auto-creates Issue records from exception events.
 *
 * Listens for shipment.exception, order.exception, and sensor alert events.
 * Creates a new Issue in the "new" column of the Triage Centre kanban board,
 * linked to the source shipment/order. This ensures exceptions are surfaced
 * for manual review and resolution.
 */

import { PrismaClient } from '@prisma/client';
import { DomainEvent } from '../DomainEvent.js';
import { IEventHandler } from '../IEventHandler.js';
import { SubscribeOptions } from '../IEventBus.js';

/**
 * Map event types to issue categories and titles.
 */
function buildIssueFromEvent(event: DomainEvent): {
  title: string;
  description: string;
  category: string;
  severity: string;
  shipmentId?: string;
  orderId?: string;
} | null {
  const p = event.payload as any;

  switch (event.type) {
    case 'shipment.exception':
      return {
        title: `Shipment ${p.shipmentReference || event.entityId} — ${p.exceptionType || 'exception'}`,
        description: p.description || `Exception on shipment: ${p.exceptionType}`,
        category: mapExceptionCategory(p.exceptionType),
        severity: 'high',
        shipmentId: event.entityId,
      };

    case 'order.exception':
      return {
        title: `Order ${p.orderReference || event.entityId} — ${p.exceptionType || 'exception'}`,
        description: p.description || `Exception on order: ${p.exceptionType}`,
        category: mapExceptionCategory(p.exceptionType),
        severity: 'high',
        orderId: event.entityId,
      };

    default:
      return null;
  }
}

function mapExceptionCategory(exceptionType?: string): string {
  if (!exceptionType) return 'General';
  const map: Record<string, string> = {
    delay: 'Delivery Delay',
    damage: 'Freight Damage',
    refused: 'Delivery',
    address_issue: 'Documentation',
    weather: 'Weather',
    temperature: 'Equipment',
    other: 'General',
  };
  return map[exceptionType] || 'General';
}

export class TriageHandler implements IEventHandler {
  readonly name = 'triage.auto_create';
  readonly eventPatterns = [
    'shipment.exception',
    'order.exception',
  ];
  readonly options: SubscribeOptions = {
    concurrency: 2,
    priority: 4,
    retryLimit: 2,
  };

  constructor(private prisma: PrismaClient) {}

  async handle(event: DomainEvent): Promise<void> {
    const issueData = buildIssueFromEvent(event);
    if (!issueData) return;

    // Check for duplicate: don't create another issue if one already exists
    // for this entity+event combo
    const existing = await this.prisma.issue.findFirst({
      where: {
        sourceEventId: event.id,
      },
    });
    if (existing) {
      console.log(`[TriageHandler] Issue already exists for event ${event.id}, skipping`);
      return;
    }

    // Generate next issue number
    const lastIssue = await this.prisma.issue.findFirst({
      where: { orgId: event.orgId },
      orderBy: { createdAt: 'desc' },
      select: { issueNumber: true },
    });
    let nextNum = 1;
    if (lastIssue) {
      const match = lastIssue.issueNumber.match(/ISS-(\d+)/);
      if (match) nextNum = parseInt(match[1], 10) + 1;
    }
    const issueNumber = `ISS-${String(nextNum).padStart(3, '0')}`;

    // Create the issue
    const issue = await this.prisma.issue.create({
      data: {
        issueNumber,
        title: issueData.title,
        description: issueData.description,
        orgId: event.orgId,
        status: 'new',
        severity: issueData.severity,
        category: issueData.category,
        shipmentId: issueData.shipmentId,
        orderId: issueData.orderId,
        source: 'auto_exception',
        sourceEventId: event.id,
      },
    });

    console.log(`[TriageHandler] Auto-created issue ${issue.issueNumber} from ${event.type} (entity: ${event.entityId})`);
  }
}
