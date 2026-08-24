/**
 * Issue Type registry — the deterministic catalogue of issue types the Issue
 * Engine knows how to raise, escalate, and resolve.
 *
 * v1 is code-defined and built-in. Types span domains (shipment exceptions,
 * WMS pack audits) — each declares its own sourceEntityType. A DB-backed,
 * admin-editable version is a roadmap item ("Admin-editable Issue Types
 * (DB-backed)") — when that lands, this registry becomes the seed/fallback.
 *
 * A type declares:
 *  - identity: stable `key` (stored on Issue.issueType for reporting) + display name
 *  - defaults: `category` + `defaultPriority` stamped onto issues it raises
 *  - `latched`: latched issues never auto-resolve when the condition clears
 *    ("it happened" — must be investigated); unlatched ones auto-resolve on recovery
 *  - `raise`: the accumulator rule — "N signals within the window OR immediately
 *    on a signal at/above `priorityFloor`"
 *  - `triggerEvents` / `recoveryEvents`: the domain events that raise a signal /
 *    clear the condition
 */

export type IssueTypeKey =
  | 'shipment_cutoff_risk'
  | 'shipment_eta_delay'
  | 'shipment_misship'
  | 'shipment_temperature'
  | 'shipment_tamper_light'
  | 'pack_audit_variance';

export interface IssueTypeRaiseRule {
  /** Number of signals within `windowMinutes` needed to raise the issue. */
  thresholdCount: number;
  /** Sliding window, in minutes, over which `thresholdCount` is counted. */
  windowMinutes: number;
  /**
   * If set, a single signal at or above this priority raises the issue
   * immediately, regardless of `thresholdCount` (severity short-circuit).
   */
  priorityFloor?: IssuePriority;
}

export type IssuePriority = 'low' | 'medium' | 'high' | 'critical';

export interface IssueTypeDef {
  key: IssueTypeKey;
  name: string;
  /**
   * What Issue.sourceEntityType the engine stamps on issues of this type
   * ('shipment', 'pack_task', ...). The engine must never assume a domain:
   * WMS types raise against warehouse entities (#133).
   */
  sourceEntityType: string;
  /**
   * Payload key holding the source entity id on trigger/recovery events.
   * Falls back to event.entityId when the key is absent — note the entity
   * that emitted the event is not always the source entity (a pack audit
   * event's entityId is the audit, but issues attach to the pack task).
   */
  entityIdField: string;
  /** Coarse Issue.category bucket for the existing filters. */
  category: 'exception' | 'delay' | 'damage' | 'compliance' | 'other';
  defaultPriority: IssuePriority;
  latched: boolean;
  /**
   * When true, the signal's severity is ignored and the issue always takes
   * `defaultPriority`. Used for inherently-critical safety/compliance types
   * (temperature, tamper) so a "warning" signal can't downgrade them.
   */
  ignoreSignalSeverity?: boolean;
  /**
   * Triage confidence in a *single* signal of this type, 0-100. Detectors
   * differ wildly in how often they cry wolf: a cargo mis-drop is almost never
   * spurious, whereas one temperature reading can just be an open door. The
   * score is boosted as corroborating signals arrive (see computeSignalScore),
   * so a low base is "prove it", not "ignore it".
   */
  baseConfidence: number;
  /**
   * Target time to resolution, in minutes, used to stamp Issue.slaDeadline
   * when the engine raises the issue. Omit for types with no SLA.
   */
  slaMinutes?: number;
  raise: IssueTypeRaiseRule;
  triggerEvents: string[];
  recoveryEvents: string[];
}

/** Score at or below which an issue is treated as noise. */
export const NOISE_THRESHOLD = 40;
/** Added to the score for each corroborating signal beyond the first. */
export const CORROBORATION_BOOST = 15;
/** Ceiling — corroboration can never make a signal a certainty. */
export const MAX_SIGNAL_SCORE = 95;

/** Ordinal ranking so priorities can be compared / escalated. */
export const PRIORITY_RANK: Record<IssuePriority, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export function priorityRank(p: string | null | undefined): number {
  return PRIORITY_RANK[(p as IssuePriority)] ?? 0;
}

/** Returns whichever priority is more severe. */
export function maxPriority(a: string, b: string): string {
  return priorityRank(a) >= priorityRank(b) ? a : b;
}

export const ISSUE_TYPES: Record<IssueTypeKey, IssueTypeDef> = {
  shipment_cutoff_risk: {
    key: 'shipment_cutoff_risk',
    sourceEntityType: 'shipment',
    entityIdField: 'shipmentId',
    name: 'Cutoff at risk',
    category: 'delay',
    defaultPriority: 'high',
    latched: false, // recovers when the shipment is no longer at risk / has departed
    baseConfidence: 75, // derived from a booked cutoff time — rarely spurious
    slaMinutes: 120,
    raise: { thresholdCount: 1, windowMinutes: 120 },
    triggerEvents: ['shipment.cutoff_at_risk'],
    recoveryEvents: ['shipment.cutoff_cleared'],
  },
  shipment_eta_delay: {
    key: 'shipment_eta_delay',
    sourceEntityType: 'shipment',
    entityIdField: 'shipmentId',
    name: 'ETA delay',
    category: 'delay',
    defaultPriority: 'medium',
    latched: false, // recovers when the ETA returns within threshold
    baseConfidence: 55, // traffic-derived ETAs fluctuate; one reading proves little
    slaMinutes: 240,
    raise: { thresholdCount: 1, windowMinutes: 120 },
    triggerEvents: ['tracking.eta_updated'],
    recoveryEvents: ['tracking.eta_recovered'],
  },
  shipment_misship: {
    key: 'shipment_misship',
    sourceEntityType: 'shipment',
    entityIdField: 'shipmentId',
    name: 'Mis-ship / cargo discrepancy',
    category: 'exception',
    defaultPriority: 'high',
    latched: true, // it happened — must be investigated
    baseConfidence: 70, // scan-derived cargo discrepancies are seldom false
    slaMinutes: 120,
    raise: { thresholdCount: 1, windowMinutes: 60 },
    triggerEvents: ['cargo.misdrop_detected', 'cargo.missing_at_stop', 'cargo.left_on_vehicle'],
    recoveryEvents: [],
  },
  shipment_temperature: {
    key: 'shipment_temperature',
    sourceEntityType: 'shipment',
    entityIdField: 'shipmentId',
    name: 'Temperature excursion',
    category: 'compliance',
    defaultPriority: 'critical',
    latched: true, // excursion happened — must be investigated (CAPA)
    ignoreSignalSeverity: true, // always critical, regardless of excursion severity band
    baseConfidence: 30, // a single reading may just be a door-open spike
    slaMinutes: 60,
    raise: { thresholdCount: 1, windowMinutes: 60 },
    triggerEvents: ['cold_chain.excursion_detected'],
    recoveryEvents: [],
  },
  pack_audit_variance: {
    key: 'pack_audit_variance',
    name: 'Pack audit variance',
    sourceEntityType: 'pack_task',
    entityIdField: 'packTaskId',
    category: 'exception',
    defaultPriority: 'medium',
    latched: true, // the variance happened — investigated and closed by a person, never auto-resolved
    baseConfidence: 70, // scale-derived weight variance is seldom spurious
    slaMinutes: 240,
    raise: { thresholdCount: 1, windowMinutes: 60 },
    triggerEvents: ['pack.audit_variance_detected'],
    recoveryEvents: [],
  },
  shipment_tamper_light: {
    key: 'shipment_tamper_light',
    sourceEntityType: 'shipment',
    entityIdField: 'shipmentId',
    name: 'Light exposure before arrival (tamper)',
    category: 'compliance',
    defaultPriority: 'critical',
    latched: true, // possible tamper/theft — must be investigated
    ignoreSignalSeverity: true, // always critical
    baseConfidence: 40, // light sensors trip on legitimate door opens
    slaMinutes: 60,
    raise: { thresholdCount: 1, windowMinutes: 60 },
    triggerEvents: ['shipment.tamper_light'],
    recoveryEvents: [],
  },
};

export function getIssueType(key: string): IssueTypeDef | undefined {
  return ISSUE_TYPES[key as IssueTypeKey];
}

export function allIssueTypes(): IssueTypeDef[] {
  return Object.values(ISSUE_TYPES);
}

/** Types whose trigger list contains `eventType`. */
export function issueTypesForTriggerEvent(eventType: string): IssueTypeDef[] {
  return allIssueTypes().filter(t => t.triggerEvents.includes(eventType));
}

/** Types whose recovery list contains `eventType`. */
export function issueTypesForRecoveryEvent(eventType: string): IssueTypeDef[] {
  return allIssueTypes().filter(t => t.recoveryEvents.includes(eventType));
}

/** All distinct trigger event types across the registry (for subscriptions). */
export function allTriggerEvents(): string[] {
  return [...new Set(allIssueTypes().flatMap(t => t.triggerEvents))];
}

/** All distinct recovery event types across the registry (for subscriptions). */
export function allRecoveryEvents(): string[] {
  return [...new Set(allIssueTypes().flatMap(t => t.recoveryEvents))];
}

/* ── Triage: signal scoring ───────────────────────────────────────────── */

/**
 * Confidence that an issue is real, 0-100.
 *
 * Starts at the type's `baseConfidence` and adds `CORROBORATION_BOOST` for
 * every signal beyond the first, capped at `MAX_SIGNAL_SCORE`. One temperature
 * blip scores 30 (probably a door); four in an hour scores 75 (probably a
 * failing reefer).
 */
export function computeSignalScore(type: IssueTypeDef, signalCount: number): number {
  const corroborations = Math.max(0, signalCount - 1);
  return Math.min(MAX_SIGNAL_SCORE, type.baseConfidence + corroborations * CORROBORATION_BOOST);
}

/**
 * Whether an issue should be suppressed as noise.
 *
 * Latched types are NEVER noise. A temperature excursion or a possible tamper
 * has a deliberately low base confidence so it can be corroborated, but it is a
 * safety/compliance event that has already happened — hiding it from the
 * working queue because one sensor reading looked marginal is exactly the
 * failure mode this system exists to prevent.
 */
export function isNoise(type: IssueTypeDef, score: number): boolean {
  if (type.latched) return false;
  return score <= NOISE_THRESHOLD;
}

/** Human-readable reason stamped on Issue.noiseReason when suppressed. */
export function noiseReasonFor(type: IssueTypeDef, score: number, signalCount: number): string {
  return `Low confidence: ${type.name} scored ${score}/100 from ${signalCount} signal${signalCount === 1 ? '' : 's'} (threshold ${NOISE_THRESHOLD}).`;
}

/** SLA deadline for a newly-raised issue, or null when the type has no SLA. */
export function slaDeadlineFor(type: IssueTypeDef, from: Date): Date | null {
  if (!type.slaMinutes) return null;
  return new Date(from.getTime() + type.slaMinutes * 60_000);
}

/* ── Manual issues ───────────────────────────────────────────────────── */

/**
 * Signal score stamped on a manually-raised issue.
 *
 * BUSINESS RULE: a person deliberately filed this, which is stronger evidence
 * than any single detector reading — it sits above the highest base confidence
 * in the registry (cutoff risk, 75) but below the corroboration ceiling, so a
 * corroborated automatic issue can still outrank it. Comfortably above
 * NOISE_THRESHOLD, so a human report is never auto-suppressed as noise.
 */
export const MANUAL_SIGNAL_SCORE = 80;

/**
 * Target time to resolution for a manual issue, by priority.
 *
 * BUSINESS RULE: manual issues have no Issue Type to inherit an SLA from, but
 * excluding them from SLA tracking would let hand-raised work age invisibly.
 * The bands mirror the registry's spread — 60 minutes for the safety-grade
 * types up to 240 for ETA drift.
 */
const MANUAL_SLA_MINUTES: Record<IssuePriority, number> = {
  critical: 60,
  high: 120,
  medium: 240,
  low: 480,
};

export function manualSlaDeadline(priority: string, from: Date): Date {
  const mins = MANUAL_SLA_MINUTES[(priority as IssuePriority)] ?? MANUAL_SLA_MINUTES.medium;
  return new Date(from.getTime() + mins * 60_000);
}
