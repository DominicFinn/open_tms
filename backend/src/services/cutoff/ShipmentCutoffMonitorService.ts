import { PrismaClient, Shipment, CarrierCutoff } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { createEvent } from '../../events/createEvent.js';

export type CutoffSeverity = 'minor' | 'warning' | 'critical';

export interface EvaluationResult {
  shipmentId: string;
  carrierId: string | null;
  cutoffAt: Date | null;
  projectedReadyAt: Date | null;
  bufferMinutes: number | null;
  severity: CutoffSeverity | null;
  blockingStage: string | null;
  pendingPickTasks: number;
  pendingPackTasks: number;
  pendingLoadPlan: boolean;
  notified: boolean;
}

export interface CutoffMonitorConfig {
  /** Minutes a pending pick task adds to projected ready time. Default 45. */
  minutesPerPendingPick: number;
  /** Minutes a pending pack task adds. Default 15. */
  minutesPerPendingPack: number;
  /** Minutes added when no load plan is created yet. Default 30. */
  minutesNoLoadPlan: number;
  /** Threshold for "warning" severity in minutes. |buffer| < this = warning. Default 30. */
  warningBufferMinutes: number;
  /** Threshold for "critical" severity. |buffer| < this OR already past = critical. Default 10. */
  criticalBufferMinutes: number;
  /** Minutes between re-notifications at the same severity. Default 30. */
  dedupWindowMinutes: number;
}

const DEFAULT_CONFIG: CutoffMonitorConfig = {
  minutesPerPendingPick: 45,
  minutesPerPendingPack: 15,
  minutesNoLoadPlan: 30,
  warningBufferMinutes: 30,
  criticalBufferMinutes: 10,
  dedupWindowMinutes: 30,
};

/**
 * Resolve today's cutoff for a carrier by day-of-week in the cutoff's timezone.
 * Returns the resolved cutoff as a UTC Date, or null if no active row matches.
 */
export function resolveCutoffForNow(cutoffs: CarrierCutoff[], now: Date): { cutoff: CarrierCutoff; cutoffAt: Date } | null {
  if (cutoffs.length === 0) return null;

  // Prefer service-level-less (null) cutoffs as defaults; service-specific ones
  // are out of scope for v1 matching since Shipment has no service_level field.
  const activeCutoffs = cutoffs.filter(c => c.active);
  if (activeCutoffs.length === 0) return null;

  // Find the row matching the carrier's timezone + today's local day-of-week.
  let best: { cutoff: CarrierCutoff; cutoffAt: Date } | null = null;

  for (const c of activeCutoffs) {
    const localDay = getLocalDayOfWeek(now, c.timezone);
    if (localDay !== c.dayOfWeek) continue;
    const [hh, mm] = c.cutoffLocalTime.split(':').map(Number);
    if (isNaN(hh) || isNaN(mm)) continue;
    const cutoffAt = buildLocalDateTime(now, c.timezone, hh, mm);
    // Prefer the earliest upcoming cutoff (most conservative - soonest warning)
    if (!best || cutoffAt < best.cutoffAt) best = { cutoff: c, cutoffAt };
  }

  return best;
}

/**
 * Return the day-of-week (0-6, Sunday = 0) for `date` interpreted in the given IANA timezone.
 */
export function getLocalDayOfWeek(date: Date, timezone: string): number {
  try {
    const dayStr = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' }).format(date);
    const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return map[dayStr] ?? date.getUTCDay();
  } catch {
    return date.getUTCDay();
  }
}

/**
 * Build a Date that represents `hh:mm` on the calendar day of `now` in the given timezone.
 * Implementation uses Intl to read the local components of `now` and constructs a UTC Date
 * that renders to the target local wall-clock time.
 */
export function buildLocalDateTime(now: Date, timezone: string, hh: number, mm: number): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);

  const get = (t: string) => Number(parts.find(p => p.type === t)?.value ?? '0');
  const y = get('year'), mo = get('month'), d = get('day');
  const lh = get('hour'), lm = get('minute'), ls = get('second');

  // Construct a Date from the local components as if UTC to figure out the tz offset
  const asUtc = Date.UTC(y, mo - 1, d, lh, lm, ls);
  const offsetMinutes = (asUtc - now.getTime()) / 60000;

  // Target local time
  const targetLocalUtc = Date.UTC(y, mo - 1, d, hh, mm, 0);
  return new Date(targetLocalUtc - offsetMinutes * 60000);
}

export function computeSeverity(bufferMinutes: number, config: CutoffMonitorConfig): CutoffSeverity {
  if (bufferMinutes < config.criticalBufferMinutes) return 'critical';
  if (bufferMinutes < config.warningBufferMinutes) return 'warning';
  return 'minor';
}

export class ShipmentCutoffMonitorService {
  private readonly config: CutoffMonitorConfig;

  constructor(
    private prisma: PrismaClient,
    private eventBus: PgBossEventBus,
    config: Partial<CutoffMonitorConfig> = {},
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Scan all open, carrier-assigned shipments and evaluate each. */
  async runOnce(now: Date = new Date()): Promise<EvaluationResult[]> {
    const openStatuses = ['draft', 'booked', 'at_pickup'];
    const shipments = await this.prisma.shipment.findMany({
      where: {
        status: { in: openStatuses },
        archived: false,
        carrierId: { not: null },
      },
      include: {
        orderShipments: { select: { orderId: true } },
      },
    });

    const org = await this.prisma.organization.findFirst({ select: { id: true } });
    const orgId = org?.id ?? 'default-org';

    const results: EvaluationResult[] = [];
    for (const s of shipments) {
      const result = await this.evaluateShipment(s as Shipment & { orderShipments: { orderId: string }[] }, now, orgId);
      results.push(result);
    }
    return results;
  }

  async evaluateShipment(
    shipment: Shipment & { orderShipments: { orderId: string }[] },
    now: Date,
    orgId: string,
  ): Promise<EvaluationResult> {
    const base: EvaluationResult = {
      shipmentId: shipment.id,
      carrierId: shipment.carrierId,
      cutoffAt: null,
      projectedReadyAt: null,
      bufferMinutes: null,
      severity: null,
      blockingStage: null,
      pendingPickTasks: 0,
      pendingPackTasks: 0,
      pendingLoadPlan: false,
      notified: false,
    };

    if (!shipment.carrierId) return base;

    const cutoffs = await this.prisma.carrierCutoff.findMany({
      where: { carrierId: shipment.carrierId, active: true },
    });
    const resolved = resolveCutoffForNow(cutoffs, now);
    if (!resolved) return base; // carrier has no cutoff for today
    base.cutoffAt = resolved.cutoffAt;

    // Already past cutoff: flag critical immediately
    const orderIds = shipment.orderShipments.map(o => o.orderId);
    const [pickCount, packCount, loadPlanCount] = orderIds.length > 0
      ? await Promise.all([
          this.prisma.pickTask.count({
            where: { orderId: { in: orderIds }, status: { notIn: ['completed', 'cancelled'] } },
          }),
          this.prisma.packTask.count({
            where: { orderId: { in: orderIds }, status: { notIn: ['completed', 'cancelled'] } },
          }),
          this.prisma.loadPlan.count({
            where: { shipmentId: shipment.id, status: { notIn: ['completed', 'cancelled'] } },
          }),
        ])
      : [0, 0, 0];

    base.pendingPickTasks = pickCount;
    base.pendingPackTasks = packCount;
    base.pendingLoadPlan = loadPlanCount === 0;

    const extraMinutes =
      pickCount * this.config.minutesPerPendingPick +
      packCount * this.config.minutesPerPendingPack +
      (base.pendingLoadPlan ? this.config.minutesNoLoadPlan : 0);

    base.projectedReadyAt = new Date(now.getTime() + extraMinutes * 60_000);
    base.blockingStage = pickCount > 0 ? 'picking'
                        : packCount > 0 ? 'packing'
                        : base.pendingLoadPlan ? 'load_planning'
                        : 'ready';

    // If everything is already complete, no risk
    if (extraMinutes === 0 && shipment.status === 'booked') {
      return base;
    }

    const bufferMs = resolved.cutoffAt.getTime() - base.projectedReadyAt.getTime();
    const bufferMinutes = Math.round(bufferMs / 60_000);
    base.bufferMinutes = bufferMinutes;
    base.severity = computeSeverity(bufferMinutes, this.config);

    base.notified = await this.notifyIfNeeded(shipment, base, now, orgId);
    return base;
  }

  /**
   * Emits the domain event and optionally creates/updates an Issue. Dedupes so we
   * don't spam: only re-fire when severity escalates or the dedup window has passed.
   */
  private async notifyIfNeeded(
    shipment: Shipment,
    result: EvaluationResult,
    now: Date,
    orgId: string,
  ): Promise<boolean> {
    if (!result.severity) return false;

    // Minor severity is purely informational (dashboard-only); no events or issues
    if (result.severity === 'minor') return false;

    const severityRank: Record<CutoffSeverity, number> = { minor: 1, warning: 2, critical: 3 };
    const prev = shipment.lastCutoffRiskSeverity as CutoffSeverity | null;
    const prevAt = shipment.lastCutoffRiskAt;
    const windowPassed = !prevAt || (now.getTime() - prevAt.getTime()) >= this.config.dedupWindowMinutes * 60_000;
    const escalated = !prev || severityRank[result.severity] > severityRank[prev];

    if (!escalated && !windowPassed) return false;

    let issueId: string | null = shipment.lastCutoffRiskIssueId ?? null;
    if (!issueId) {
      const issue = await this.prisma.issue.create({
        data: {
          orgId,
          title: `Carrier cutoff at risk: shipment ${shipment.reference}`,
          description: this.buildIssueDescription(shipment, result),
          priority: result.severity === 'critical' ? 'high' : 'medium',
          category: 'logistics',
          sourceEntityType: 'shipment',
          sourceEntityId: shipment.id,
          status: 'open',
        },
      });
      issueId = issue.id;
    }

    await this.prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        lastCutoffRiskSeverity: result.severity,
        lastCutoffRiskAt: now,
        lastCutoffRiskIssueId: issueId,
      },
    });

    const event = createEvent({
      type: EVENT_TYPES.SHIPMENT_CUTOFF_AT_RISK,
      entityType: 'shipment',
      entityId: shipment.id,
      orgId,
      actorId: 'system',
      correlationId: undefined,
      source: 'cutoff-monitor',
      payload: {
        shipmentId: shipment.id,
        shipmentReference: shipment.reference,
        carrierId: shipment.carrierId,
        cutoffAt: result.cutoffAt?.toISOString(),
        projectedReadyAt: result.projectedReadyAt?.toISOString(),
        bufferMinutes: result.bufferMinutes,
        severity: result.severity,
        blockingStage: result.blockingStage,
        pendingPickTasks: result.pendingPickTasks,
        pendingPackTasks: result.pendingPackTasks,
        pendingLoadPlan: result.pendingLoadPlan,
        issueId,
      },
    });
    await this.eventBus.publish(event);
    return true;
  }

  private buildIssueDescription(shipment: Shipment, r: EvaluationResult): string {
    const pieces = [
      `Shipment ${shipment.reference} is projected to miss the carrier cutoff.`,
      `Cutoff: ${r.cutoffAt?.toISOString()}`,
      `Projected ready: ${r.projectedReadyAt?.toISOString()} (${r.bufferMinutes} min buffer)`,
      `Blocking stage: ${r.blockingStage}`,
      `Pending work: ${r.pendingPickTasks} pick task(s), ${r.pendingPackTasks} pack task(s)${r.pendingLoadPlan ? ', no load plan yet' : ''}.`,
    ];
    return pieces.join('\n');
  }
}
