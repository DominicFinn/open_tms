/**
 * Issue Type registry — the deterministic catalogue of issue types the Issue
 * Engine knows how to raise, escalate, and resolve.
 *
 * v1 is code-defined and built-in (shipment exceptions only). A DB-backed,
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
  | 'shipment_tamper_light';

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
  /** Coarse Issue.category bucket for the existing filters. */
  category: 'exception' | 'delay' | 'damage' | 'compliance' | 'other';
  defaultPriority: IssuePriority;
  latched: boolean;
  raise: IssueTypeRaiseRule;
  triggerEvents: string[];
  recoveryEvents: string[];
}

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
    name: 'Cutoff at risk',
    category: 'delay',
    defaultPriority: 'high',
    latched: false, // recovers when the shipment is no longer at risk / has departed
    raise: { thresholdCount: 1, windowMinutes: 120 },
    triggerEvents: ['shipment.cutoff_at_risk'],
    recoveryEvents: ['shipment.cutoff_cleared'],
  },
  shipment_eta_delay: {
    key: 'shipment_eta_delay',
    name: 'ETA delay',
    category: 'delay',
    defaultPriority: 'medium',
    latched: false, // recovers when the ETA returns within threshold
    raise: { thresholdCount: 1, windowMinutes: 120 },
    triggerEvents: ['tracking.eta_updated'],
    recoveryEvents: ['tracking.eta_recovered'],
  },
  shipment_misship: {
    key: 'shipment_misship',
    name: 'Mis-ship / cargo discrepancy',
    category: 'exception',
    defaultPriority: 'high',
    latched: true, // it happened — must be investigated
    raise: { thresholdCount: 1, windowMinutes: 60 },
    triggerEvents: ['cargo.misdrop_detected', 'cargo.missing_at_stop', 'cargo.left_on_vehicle'],
    recoveryEvents: [],
  },
  shipment_temperature: {
    key: 'shipment_temperature',
    name: 'Temperature excursion',
    category: 'compliance',
    defaultPriority: 'critical',
    latched: true, // excursion happened — must be investigated (CAPA)
    raise: { thresholdCount: 1, windowMinutes: 60 },
    triggerEvents: ['cold_chain.excursion_detected'],
    recoveryEvents: [],
  },
  shipment_tamper_light: {
    key: 'shipment_tamper_light',
    name: 'Light exposure before arrival (tamper)',
    category: 'compliance',
    defaultPriority: 'critical',
    latched: true, // possible tamper/theft — must be investigated
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
