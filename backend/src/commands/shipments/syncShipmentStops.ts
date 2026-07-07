import type { TransactionClient } from '../BaseCommandHandler.js';

/**
 * Rebuild a shipment's ordered stop list from its route: origin (pickup),
 * intermediate waypoints, then destination (delivery). Only ever called for
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
    shipmentId: string;
    originId?: string | null;
    waypoints?: string[];
    destinationId?: string | null;
  },
): Promise<void> {
  const { shipmentId, originId, waypoints, destinationId } = opts;

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

  await tx.shipmentStop.deleteMany({ where: { shipmentId } });
  if (rows.length > 0) {
    await tx.shipmentStop.createMany({ data: rows });
  }
}
