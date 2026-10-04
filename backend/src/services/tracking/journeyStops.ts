/**
 * Which of a shipment's stops a device ping can act on (#324).
 *
 * Stops are matched one by one, not by location, so a route that visits the same location twice
 * (a return leg, a second drop at a hub) treats each visit as its own stop.
 */

export interface JourneyStop {
  id: string;
  locationId: string;
  sequenceNumber: number;
  status: string;
  actualArrival: Date | null;
  actualDeparture: Date | null;
}

const OPEN_STATUSES = new Set(['pending', 'arrived']);

/** The pickup at the shipment's origin: the first stop, by sequence, at the origin location. */
export function findOriginStop<T extends JourneyStop>(stops: T[], originId: string | null): T | null {
  if (!originId) return null;
  return [...stops].sort(bySequence).find((s) => s.locationId === originId) ?? null;
}

/** The last stop, by sequence, at the destination location. */
export function findDestinationStop<T extends JourneyStop>(stops: T[], destinationId: string | null): T | null {
  if (!destinationId) return null;
  return [...stops].sort(bySequence).reverse().find((s) => s.locationId === destinationId) ?? null;
}

/**
 * For each location, the stop a ping there would act on: its lowest-sequence open stop.
 *
 * BUSINESS RULE: a repeat visit only becomes eligible once the vehicle has been somewhere else
 * since the earlier visit to that location completed. Otherwise a truck still parked inside the
 * geofence after its first drop would immediately complete the second visit too.
 */
export function actionableStops<T extends JourneyStop>(stops: T[]): T[] {
  const byLocation = new Map<string, T[]>();
  for (const stop of [...stops].sort(bySequence)) {
    byLocation.set(stop.locationId, [...(byLocation.get(stop.locationId) ?? []), stop]);
  }

  const result: T[] = [];
  for (const atLocation of byLocation.values()) {
    const next = atLocation.find((s) => OPEN_STATUSES.has(s.status));
    if (!next) continue;
    const earlierVisits = atLocation.filter((s) => s.sequenceNumber < next.sequenceNumber && s.status === 'completed');
    if (earlierVisits.every((visit) => visitedElsewhereSince(visit, stops))) result.push(next);
  }
  return result;
}

function visitedElsewhereSince(visit: JourneyStop, stops: JourneyStop[]): boolean {
  const leftAt = completedAt(visit);
  return stops.some((other) => {
    if (other.locationId === visit.locationId || other.status !== 'completed') return false;
    const otherAt = completedAt(other);
    // Without times on both, fall back to route order.
    return leftAt && otherAt ? otherAt > leftAt : other.sequenceNumber > visit.sequenceNumber;
  });
}

function completedAt(stop: JourneyStop): Date | null {
  return stop.actualDeparture ?? stop.actualArrival;
}

function bySequence(a: JourneyStop, b: JourneyStop): number {
  return a.sequenceNumber - b.sequenceNumber;
}
