import type { TransactionClient } from '../BaseCommandHandler.js';

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
    waypoints?: string[];
    destinationId?: string | null;
  },
): Promise<void> {
  const { orgId, shipmentId, originId, waypoints, destinationId } = opts;

  const rows: Array<{
    shipmentId: string;
    locationId: string;
    sequenceNumber: number;
    stopType: string;
    status: string;
  }> = [];
  let seq = 1;
  if (originId) {
    rows.push({ shipmentId, locationId: originId, sequenceNumber: seq++, stopType: 'pickup', status: 'pending' });
  }
  for (const wp of waypoints ?? []) {
    if (wp) rows.push({ shipmentId, locationId: wp, sequenceNumber: seq++, stopType: 'delivery', status: 'pending' });
  }
  if (destinationId) {
    rows.push({ shipmentId, locationId: destinationId, sequenceNumber: seq++, stopType: 'delivery', status: 'pending' });
  }

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
  rows: Array<{ shipmentId: string; locationId: string; sequenceNumber: number; stopType: string; status: string }>,
): Promise<void> {
  const existing = await tx.shipmentStop.findMany({
    where: { shipmentId, shipment: { orgId } },
    orderBy: { sequenceNumber: 'asc' },
    select: { id: true, locationId: true, _count: { select: { orders: true } } },
  });

  const unmatched = [...existing];
  const matches = rows.map((row) => {
    const i = unmatched.findIndex((st) => st.locationId === row.locationId);
    return { row, stop: i >= 0 ? unmatched.splice(i, 1)[0] : null };
  });

  const stranded = unmatched.filter((st) => st._count.orders > 0);
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
        data: { sequenceNumber: row.sequenceNumber, stopType: row.stopType },
      });
    } else {
      await tx.shipmentStop.create({ data: row });
    }
  }
}

