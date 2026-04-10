/**
 * TriageHandler — auto-creates Issue records from exception and sensor alert events.
 *
 * Listens for shipment/order exceptions, sensor alerts, tracking anomalies, and
 * integration failures. Creates issues with enriched metadata (priority, region,
 * carrier, customer, tags, signal scoring) and supports deduplication to prevent
 * noise from repeated alerts on the same entity.
 *
 * Signal scoring logic:
 * - Exceptions (shipment/order): score 75 (high confidence)
 * - Sensor alerts: score varies by corroboration (single spike = 20, sustained = 85)
 * - Integration failures: score 60
 * - Geofence events: score 40 (often false positives from GPS jitter)
 */

import { PrismaClient } from '@prisma/client';
import { DomainEvent } from '../DomainEvent.js';
import { IEventHandler } from '../IEventHandler.js';
import { SubscribeOptions } from '../IEventBus.js';

interface IssueFromEvent {
  title: string;
  description: string;
  category: string;
  severity: string;
  priority: number;
  signalScore: number;
  source: string;
  tags: string[];
  shipmentId?: string;
  orderId?: string;
}

/**
 * Map event types to issue data with signal scoring.
 */
function buildIssueFromEvent(event: DomainEvent): IssueFromEvent | null {
  const p = event.payload as any;

  switch (event.type) {
    case 'shipment.exception':
      return {
        title: `Shipment ${p.shipmentReference || event.entityId} — ${p.exceptionType || 'exception'}`,
        description: p.description || `Exception on shipment: ${p.exceptionType}`,
        category: mapExceptionCategory(p.exceptionType),
        severity: 'high',
        priority: mapExceptionPriority(p.exceptionType),
        signalScore: 75,
        source: 'auto_exception',
        tags: ['shipment-exception'],
        shipmentId: event.entityId,
      };

    case 'order.exception':
      return {
        title: `Order ${p.orderReference || event.entityId} — ${p.exceptionType || 'exception'}`,
        description: p.description || `Exception on order: ${p.exceptionType}`,
        category: mapExceptionCategory(p.exceptionType),
        severity: 'high',
        priority: mapExceptionPriority(p.exceptionType),
        signalScore: 75,
        source: 'auto_exception',
        tags: ['order-exception'],
        orderId: event.entityId,
      };

    case 'sensor.alert_temperature':
      return {
        title: `Temperature alert — ${p.deviceName || event.entityId}`,
        description: `Temperature ${p.temperature}° (threshold: ${p.tempMin}–${p.tempMax}°)`,
        category: 'Equipment',
        severity: 'high',
        priority: 2,
        signalScore: 30, // Single reading — low confidence, may be door-open false positive
        source: 'auto_sensor',
        tags: ['sensor-alert', 'temperature'],
        shipmentId: p.shipmentId,
        orderId: p.orderId,
      };

    case 'sensor.alert_impact':
      return {
        title: `Impact alert — ${p.deviceName || event.entityId}`,
        description: `Impact detected: ${p.impactG}G`,
        category: 'Freight Damage',
        severity: 'high',
        priority: 1,
        signalScore: 70, // Impacts are rarely false positives
        source: 'auto_sensor',
        tags: ['sensor-alert', 'impact'],
        shipmentId: p.shipmentId,
        orderId: p.orderId,
      };

    case 'sensor.alert_battery':
      return {
        title: `Battery critical — ${p.deviceName || event.entityId}`,
        description: `Battery level: ${p.batteryLevel}%`,
        category: 'Equipment',
        severity: 'medium',
        priority: 4,
        signalScore: 60,
        source: 'auto_sensor',
        tags: ['sensor-alert', 'battery'],
        shipmentId: p.shipmentId,
      };

    case 'sensor.alert_light':
      return {
        title: `Light alert — ${p.deviceName || event.entityId}`,
        description: `Unexpected light exposure detected`,
        category: 'Equipment',
        severity: 'medium',
        priority: 3,
        signalScore: 45,
        source: 'auto_sensor',
        tags: ['sensor-alert', 'light'],
        shipmentId: p.shipmentId,
      };

    case 'tracking.geofence_entered':
      return {
        title: `Unexpected geofence event — ${p.shipmentReference || event.entityId}`,
        description: p.description || 'Shipment entered an unexpected geofence zone',
        category: 'Delivery',
        severity: 'medium',
        priority: 3,
        signalScore: 40, // GPS jitter can cause false positives
        source: 'auto_tracking',
        tags: ['geofence'],
        shipmentId: event.entityId,
      };

    case 'integration.outbound_failed':
      return {
        title: `Integration failure — ${p.integrationName || event.entityId}`,
        description: p.errorMessage || 'Outbound integration failed',
        category: 'Communication',
        severity: 'medium',
        priority: 3,
        signalScore: 60,
        source: 'auto_exception',
        tags: ['integration-failure'],
        shipmentId: p.shipmentId,
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

function mapExceptionPriority(exceptionType?: string): number {
  if (!exceptionType) return 3;
  const map: Record<string, number> = {
    damage: 1,     // Critical — cargo is damaged
    refused: 2,    // Urgent — delivery rejected
    temperature: 2, // Urgent — perishable at risk
    delay: 3,      // Normal
    address_issue: 3,
    weather: 4,    // Low — often can't be helped
    other: 3,
  };
  return map[exceptionType] || 3;
}

export class TriageHandler implements IEventHandler {
  readonly name = 'triage.auto_create';
  readonly eventPatterns = [
    'shipment.exception',
    'order.exception',
    'sensor.alert_temperature',
    'sensor.alert_impact',
    'sensor.alert_battery',
    'sensor.alert_light',
    'tracking.geofence_entered',
    'integration.outbound_failed',
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

    // ── Deduplication ──────────────────────────────────────────────────
    // For sensor alerts: check if an open issue already exists for this
    // entity+category combo. If so, increment correlatedEvents and boost
    // signalScore instead of creating a duplicate.
    const entityId = issueData.shipmentId || issueData.orderId;
    if (entityId && issueData.source === 'auto_sensor') {
      const existing = await this.prisma.issue.findFirst({
        where: {
          OR: [
            { shipmentId: issueData.shipmentId || undefined },
            { orderId: issueData.orderId || undefined },
          ],
          category: issueData.category,
          status: { in: ['new', 'investigating', 'escalated'] },
          isNoise: false,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (existing) {
        const newCorrelated = existing.correlatedEvents + 1;
        // More corroborating events = higher signal score
        // 1 event: initial score, 3+ events: boosted significantly, 5+ events: very high
        const boostedScore = Math.min(95, issueData.signalScore + (newCorrelated - 1) * 15);

        await this.prisma.issue.update({
          where: { id: existing.id },
          data: {
            correlatedEvents: newCorrelated,
            signalScore: boostedScore,
            lastActivityAt: new Date(),
          },
        });

        // Log the corroboration as an activity
        await this.prisma.issueActivity.create({
          data: {
            issueId: existing.id,
            actorName: 'System',
            action: 'signal_updated',
            details: {
              reason: 'Corroborating sensor alert received',
              newScore: boostedScore,
              correlatedEvents: newCorrelated,
              eventType: event.type,
            },
          },
        });

        console.log(`[TriageHandler] Corroborated ${existing.issueNumber} (score: ${boostedScore}, events: ${newCorrelated})`);
        return;
      }
    }

    // Check for exact duplicate by sourceEventId
    if (event.id) {
      const exactDup = await this.prisma.issue.findFirst({
        where: { sourceEventId: event.id },
      });
      if (exactDup) {
        console.log(`[TriageHandler] Issue already exists for event ${event.id}, skipping`);
        return;
      }
    }

    // ── Enrichment ─────────────────────────────────────────────────────
    // Load related entity data to populate region, carrier, customer, lane, tags
    let carrierId: string | undefined;
    let customerId: string | undefined;
    let laneId: string | undefined;
    let region: string | undefined;
    const tags = [...issueData.tags];

    if (issueData.shipmentId) {
      const shipment = await this.prisma.shipment.findUnique({
        where: { id: issueData.shipmentId },
        select: {
          carrierId: true,
          customerId: true,
          laneId: true,
          destination: { select: { country: true } },
          customer: { select: { name: true } },
        },
      });
      if (shipment) {
        carrierId = shipment.carrierId || undefined;
        customerId = shipment.customerId;
        laneId = shipment.laneId || undefined;
        region = shipment.destination?.country;
      }
    }

    if (issueData.orderId && !customerId) {
      const order = await this.prisma.order.findUnique({
        where: { id: issueData.orderId },
        select: {
          customerId: true,
          temperatureControl: true,
          requiresHazmat: true,
          destination: { select: { country: true } },
        },
      });
      if (order) {
        customerId = order.customerId;
        region = region || order.destination?.country;
        if (order.temperatureControl !== 'ambient') tags.push('temperature-controlled');
        if (order.requiresHazmat) tags.push('hazmat');
      }
    }

    // ── Generate issue number ──────────────────────────────────────────
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

    // ── Create the issue ───────────────────────────────────────────────
    const issue = await this.prisma.issue.create({
      data: {
        issueNumber,
        title: issueData.title,
        description: issueData.description,
        orgId: event.orgId,
        status: 'new',
        severity: issueData.severity,
        priority: issueData.priority,
        category: issueData.category,
        tags,
        shipmentId: issueData.shipmentId,
        orderId: issueData.orderId,
        carrierId,
        customerId,
        laneId,
        region,
        source: issueData.source,
        sourceEventId: event.id,
        signalScore: issueData.signalScore,
        correlatedEvents: 1,
        lastActivityAt: new Date(),
        activityCount: 1,
      },
    });

    // Create initial activity record
    await this.prisma.issueActivity.create({
      data: {
        issueId: issue.id,
        actorName: 'System',
        action: 'created',
        details: {
          source: issueData.source,
          eventType: event.type,
          signalScore: issueData.signalScore,
        },
      },
    });

    console.log(
      `[TriageHandler] Auto-created ${issue.issueNumber} from ${event.type}` +
      ` (score: ${issueData.signalScore}, priority: ${issueData.priority}, entity: ${event.entityId})`
    );
  }
}
