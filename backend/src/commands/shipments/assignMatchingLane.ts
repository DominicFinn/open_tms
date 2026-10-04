/**
 * Puts a shipment built from orders on a lane when one fits (#328), so it rides that lane's route.
 *
 * BUSINESS RULE: a lane fits when it runs from the shipment's first stop to its last, supports its
 * service level (or Both), and its own stops are exactly the shipment's stops in between, in order.
 * Anything looser would measure the shipment against a route that skips some of its stops; with no
 * fitting lane the shipment stays on a custom route and gets its own route planned.
 */

import { TransactionClient } from '../BaseCommandHandler.js';

export async function assignMatchingLane(
  tx: TransactionClient,
  orgId: string,
  shipment: { id: string; serviceLevel: string | null },
): Promise<string | null> {
  const stops = await tx.shipmentStop.findMany({
    where: { shipmentId: shipment.id, shipment: { orgId } },
    orderBy: { sequenceNumber: 'asc' },
    select: { locationId: true },
  });
  if (stops.length < 2) return null;
  const middle = stops.slice(1, -1).map((s) => s.locationId).join(',');

  const lanes = await tx.lane.findMany({
    where: { orgId, archived: false, originId: stops[0].locationId, destinationId: stops[stops.length - 1].locationId },
    select: { id: true, serviceLevel: true, stops: { select: { locationId: true }, orderBy: { order: 'asc' } } },
    orderBy: { name: 'asc' },
  });
  const lane = lanes.find((l) =>
    (!shipment.serviceLevel || l.serviceLevel === shipment.serviceLevel || l.serviceLevel === 'Both')
    && l.stops.map((s) => s.locationId).join(',') === middle);
  if (!lane) return null;

  await tx.shipment.update({ where: { id: shipment.id, orgId }, data: { laneId: lane.id } });
  return lane.id;
}
