import type { TransactionClient } from '../BaseCommandHandler.js';

/**
 * A stop on the route: a location id (a pickup in the pickup list, a drop in the drop list), or a
 * stop that is neither, with its purpose and optional name (#345).
 */
export type WaypointInput = string | { locationId: string; stopType: 'other'; purpose: string; label?: string | null };

interface StopRow {
  shipmentId: string;
  locationId: string;
  sequenceNumber: number;
  stopType: string;
  status: string;
  purpose: string | null;
  label: string | null;
}

function toRow(shipmentId: string, wp: WaypointInput, sequenceNumber: number, listType: 'pickup' | 'delivery'): StopRow | null {
  if (typeof wp === 'string') {
    return wp ? { shipmentId, locationId: wp, sequenceNumber, stopType: listType, status: 'pending', purpose: null, label: null } : null;
  }
  if (!wp.locationId) return null;
  return { shipmentId, locationId: wp.locationId, sequenceNumber, stopType: 'other', status: 'pending', purpose: wp.purpose, label: wp.label?.trim() || null };
}

/**
 * Bring a shipment's ordered stop list in line with its route: origin (pickup),
 * intermediate waypoints, then destination (delivery). Existing stops are kept and
 * renumbered rather than rebuilt (see reconcileStops). Only ever called for
 * DRAFT shipments — in-flight shipments carry stop-level progress (actual
 * arrivals, proof of delivery, geofence state) that must not be wiped.
 *
 * `waypoints` is a list of location ids in visiting order. Passing `undefined`
 * for waypoints means "no change requested" and callers should skip the sync;
 * an empty array collapses the route to just origin + destination.
 */
export async function syncShipmentStops(
  tx: TransactionClient,
  opts: {
    orgId: string;
    shipmentId: string;
    originId?: string | null;
    /** Further pickups after the origin, in order (#329); may include other stops (#345). */
    pickupWaypoints?: WaypointInput[];
    /** Drops before the destination, in order; may include other stops (#345). */
    waypoints?: WaypointInput[];
    destinationId?: string | null;
  },
): Promise<void> {
  const { orgId, shipmentId, originId, pickupWaypoints, waypoints, destinationId } = opts;

  const rows: StopRow[] = [];
  const add = (wp: WaypointInput, listType: 'pickup' | 'delivery') => {
    const row = toRow(shipmentId, wp, rows.length + 1, listType);
    if (row) rows.push(row);
  };
  if (originId) add(originId, 'pickup');
  for (const wp of pickupWaypoints ?? []) add(wp, 'pickup');
  for (const wp of waypoints ?? []) add(wp, 'delivery');
  if (destinationId) add(destinationId, 'delivery');

  await reconcileStops(tx, orgId, shipmentId, rows);
}

export class StopStillHasOrdersError extends Error {
  constructor(locationIds: string[]) {
    super(`A stop being removed still has orders dropping there (${locationIds.length}); move or remove those orders first`);
    this.name = 'StopStillHasOrdersError';
  }
}

/**
 * Brings the stored stops in line with `rows` without rebuilding them (#328). A stop at a location
 * that stays on the route keeps its row, so the orders dropping there keep their link to it (before,
 * every edit deleted and recreated the stops and silently cut that link); it's only renumbered.
 * New locations get new stops. Stops no longer on the route are deleted, unless orders still drop
 * there: then the change is refused rather than leave those orders without a drop.
 */
async function reconcileStops(
  tx: TransactionClient,
  orgId: string,
  shipmentId: string,
  rows: StopRow[],
): Promise<void> {
  const existing = await tx.shipmentStop.findMany({
    where: { shipmentId, shipment: { orgId } },
    orderBy: { sequenceNumber: 'asc' },
    select: { id: true, locationId: true, stopType: true, _count: { select: { orders: true, pickupOrders: true } } },
  });

  // Prefer the stop of the same kind at a location, so a pickup and a drop at one place stay apart.
  const unmatched = [...existing];
  const take = (pred: (st: (typeof existing)[number]) => boolean) => {
    const i = unmatched.findIndex(pred);
    return i >= 0 ? unmatched.splice(i, 1)[0] : null;
  };
  const sameKind = rows.map((row) => take((st) => st.locationId === row.locationId && st.stopType === row.stopType));
  // A pickup may become a drop at the same place, but a stop never turns into or out of an `other`
  // stop: orders linked to a pickup or drop would be left on a stop that moves no orders (#345).
  const convertible = (a: string, b: string) => a !== 'other' && b !== 'other';
  const matches = rows.map((row, i) => ({
    row,
    stop: sameKind[i] ?? take((st) => st.locationId === row.locationId && convertible(st.stopType, row.stopType)),
  }));

  const stranded = unmatched.filter((st) => st._count.orders + st._count.pickupOrders > 0);
  if (stranded.length > 0) throw new StopStillHasOrdersError(stranded.map((st) => st.locationId));

  if (unmatched.length > 0) {
    await tx.shipmentStop.deleteMany({ where: { id: { in: unmatched.map((st) => st.id) }, shipment: { orgId } } });
  }
  // Move the kept stops out of the way first: sequence numbers are unique per shipment.
  await tx.shipmentStop.updateMany({ where: { shipmentId, shipment: { orgId } }, data: { sequenceNumber: { increment: 100000 } } });
  for (const { row, stop } of matches) {
    if (stop) {
      await tx.shipmentStop.update({
        where: { id: stop.id, shipment: { orgId } },
        data: { sequenceNumber: row.sequenceNumber, stopType: row.stopType, purpose: row.purpose, label: row.label },
      });
    } else {
      await tx.shipmentStop.create({ data: row });
    }
  }
}

