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
  notified: boolean;
}

export interface CutoffMonitorConfig {
  /** Minutes a shipment that has not left yet needs before it can be handed over. Default 30. */
  minutesToReady: number;
  /** Threshold for "warning" severity in minutes. |buffer| < this = warning. Default 30. */
  warningBufferMinutes: number;
  /** Threshold for "critical" severity. |buffer| < this OR already past = critical. Default 10. */
  criticalBufferMinutes: number;
  /** Minutes between re-notifications at the same severity. Default 30. */
  dedupWindowMinutes: number;
}

const DEFAULT_CONFIG: CutoffMonitorConfig = {
  minutesToReady: 30,
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

  /**
   * Scan open, carrier-assigned shipments and evaluate each under its own org. The cron passes no
   * org and scans every tenant; a manual run from a route passes the caller's org and sees only it.
   */
  async runOnce(now: Date = new Date(), orgId?: string): Promise<EvaluationResult[]> {
    const openStatuses = ['draft', 'booked', 'at_pickup'];
    const shipments = await this.prisma.shipment.findMany({
      where: {
        ...(orgId ? { orgId } : {}),
        status: { in: openStatuses },
        archived: false,
        carrierId: { not: null },
      },
    });

    const results: EvaluationResult[] = [];
    for (const s of shipments) {
      const result = await this.evaluateShipment(s, now, s.orgId);
      results.push(result);
    }
    return results;
  }

  async evaluateShipment(
    shipment: Shipment,
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
      notified: false,
    };

    if (!shipment.carrierId) return base;

    const cutoffs = await this.prisma.carrierCutoff.findMany({
      where: { orgId, carrierId: shipment.carrierId, active: true },
    });
    const resolved = resolveCutoffForNow(cutoffs, now);
    if (!resolved) return base; // carrier has no cutoff for today
    base.cutoffAt = resolved.cutoffAt;

    // BUSINESS RULE: a shipment that has not left yet needs a fixed handling allowance before it
    // can be handed to the carrier. It is at risk when that allowance runs past today's cutoff.
    base.projectedReadyAt = new Date(now.getTime() + this.config.minutesToReady * 60_000);

    const bufferMs = resolved.cutoffAt.getTime() - base.projectedReadyAt.getTime();
    const bufferMinutes = Math.round(bufferMs / 60_000);
    base.bufferMinutes = bufferMinutes;
    base.severity = computeSeverity(bufferMinutes, this.config);

    // A safe buffer (minor/no severity) after a prior at-risk state is a recovery.
    if (!base.severity || base.severity === 'minor') {
      await this.maybeEmitCutoffCleared(shipment, now, orgId);
    } else {
      base.notified = await this.notifyIfNeeded(shipment, base, now, orgId);
    }
    return base;
  }

  /**
   * If the shipment was previously flagged at risk, emit shipment.cutoff_cleared
   * and clear the marker so the Issue Engine auto-resolves the open cutoff issue.
   */
  private async maybeEmitCutoffCleared(shipment: Shipment, now: Date, orgId: string): Promise<void> {
    if (!shipment.lastCutoffRiskSeverity) return;
    await this.prisma.shipment.update({
      where: { id: shipment.id, orgId: shipment.orgId },
      data: { lastCutoffRiskSeverity: null, lastCutoffRiskAt: now },
    });
    await this.eventBus.publish(createEvent({
      type: EVENT_TYPES.SHIPMENT_CUTOFF_CLEARED,
      entityType: 'shipment',
      entityId: shipment.id,
      orgId,
      actorId: 'system',
      source: 'cutoff-monitor',
      payload: { shipmentId: shipment.id, shipmentReference: shipment.reference },
    }));
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

    // Issue creation/escalation is owned by the deterministic Issue Engine, which
    // consumes the SHIPMENT_CUTOFF_AT_RISK event emitted below (issue type
    // `shipment_cutoff_risk`). The monitor only records severity for its own
    // event-level dedup so it doesn't re-emit the same severity repeatedly.
    await this.prisma.shipment.update({
      where: { id: shipment.id, orgId: shipment.orgId },
      data: {
        lastCutoffRiskSeverity: result.severity,
        lastCutoffRiskAt: now,
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
      },
    });
    await this.eventBus.publish(event);
    return true;
  }
}
