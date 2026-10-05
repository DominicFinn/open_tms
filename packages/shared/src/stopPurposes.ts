/**
 * Stops a vehicle makes without loading or unloading anything (#345). A shipment stop of type
 * `other` carries one of these purposes and, optionally, its own name.
 */
export const OTHER_STOP_PURPOSES = ['fuel', 'rest', 'customs', 'cross_dock', 'hub', 'inspection', 'other'] as const;
export type OtherStopPurpose = (typeof OTHER_STOP_PURPOSES)[number];

export const OTHER_STOP_PURPOSE_LABELS: Record<OtherStopPurpose, string> = {
  fuel: 'Fuel',
  rest: 'Rest',
  customs: 'Customs',
  cross_dock: 'Cross-dock',
  hub: 'Hub',
  inspection: 'Inspection',
  other: 'Other',
};

export function isOtherStopPurpose(value: unknown): value is OtherStopPurpose {
  return typeof value === 'string' && (OTHER_STOP_PURPOSES as readonly string[]).includes(value);
}

/**
 * The purpose a lane stop gives the shipment stop it becomes. A lane stop tagged as a pass-through
 * (fuel, rest, customs, cross-dock, hub, other) becomes an `other` stop; untagged, pickup or
 * dropoff lane stops stay drops, as before.
 */
export function laneStopOtherPurpose(lanePurpose: string | null | undefined): OtherStopPurpose | null {
  return isOtherStopPurpose(lanePurpose) ? lanePurpose : null;
}

/** How a stop is named on screen: its own name, else its purpose, for `other` stops. */
export function stopTypeLabel(stop: { stopType?: string | null; purpose?: string | null; label?: string | null }): string {
  if (stop.stopType === 'other') {
    const name = stop.label?.trim();
    if (name) return name;
    return isOtherStopPurpose(stop.purpose) ? OTHER_STOP_PURPOSE_LABELS[stop.purpose] : 'Stop';
  }
  if (stop.stopType === 'pickup') return 'Pickup';
  if (stop.stopType === 'both') return 'Pickup and drop';
  return 'Drop';
}
