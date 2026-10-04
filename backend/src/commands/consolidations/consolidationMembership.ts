import { EVENT_TYPES } from '../../events/eventTypes.js';
import { TransactionClient } from '../BaseCommandHandler.js';

/** A consolidation rule refused the change. The message is safe to show the user. */
export class ConsolidationRuleError extends Error {}

/** Shipments may join or leave only while the run is still being planned. */
const OPEN_SHIPMENT_STATUSES = ['draft', 'ready'];

interface Candidate {
  id: string;
  reference: string;
  status: string;
  archived: boolean;
  consolidationShipment: { consolidationId: string } | null;
}

/** Why `shipment` can't join consolidation `consolidationId`, or null when it can. */
export function joinProblem(shipment: Candidate, consolidationId: string): string | null {
  if (shipment.archived) return `${shipment.reference} is archived.`;
  if (!OPEN_SHIPMENT_STATUSES.includes(shipment.status)) return `${shipment.reference} has already started.`;
  const current = shipment.consolidationShipment?.consolidationId;
  if (current === consolidationId) return `${shipment.reference} is already on this consolidation.`;
  if (current) return `${shipment.reference} is already on another consolidation.`;
  return null;
}

/** Throws unless the consolidation exists in the org and is still a draft. */
export async function loadDraftConsolidation(tx: TransactionClient, orgId: string, id: string) {
  const consolidation = await tx.consolidation.findFirst({ where: { id, orgId } });
  if (!consolidation) throw new Error('Consolidation not found');
  if (consolidation.archived || consolidation.status !== 'draft') {
    throw new ConsolidationRuleError('Shipments can only be changed on a draft consolidation.');
  }
  return consolidation;
}

/** Adds the shipments to the consolidation, in the given order. */
export async function attachShipments(
  tx: TransactionClient,
  orgId: string,
  consolidationId: string,
  shipmentIds: string[],
): Promise<void> {
  const ids = [...new Set(shipmentIds)];
  const shipments = await tx.shipment.findMany({
    where: { id: { in: ids }, orgId },
    select: { id: true, reference: true, status: true, archived: true, consolidationShipment: { select: { consolidationId: true } } },
  });
  if (shipments.length !== ids.length) throw new Error('Shipment not found');

  const problems = shipments.map((s) => joinProblem(s, consolidationId)).filter((p): p is string => p !== null);
  if (problems.length > 0) throw new ConsolidationRuleError(problems.join(' '));

  // Explicit, increasing addedAt keeps the shipments in the order given, which orders the stops.
  const last = await tx.consolidationShipment.findFirst({ where: { consolidationId, consolidation: { orgId } }, orderBy: { addedAt: 'desc' }, select: { addedAt: true } });
  const base = Math.max(Date.now(), (last?.addedAt.getTime() ?? 0) + 1);
  await tx.consolidationShipment.createMany({
    data: ids.map((shipmentId, i) => ({ consolidationId, shipmentId, addedAt: new Date(base + i) })),
  });
}

/** Takes the shipment off the consolidation and unlinks its stops. */
export async function releaseShipment(
  tx: TransactionClient,
  orgId: string,
  consolidationId: string,
  shipmentId: string,
): Promise<void> {
  const { count } = await tx.consolidationShipment.deleteMany({
    where: { consolidationId, shipmentId, shipment: { orgId } },
  });
  if (count === 0) throw new Error('Shipment not found on this consolidation');
  await tx.shipmentStop.updateMany({
    where: { shipmentId, shipment: { orgId }, consolidationStop: { consolidationId } },
    data: { consolidationStopId: null },
  });
}

type StopKind = 'pickup' | 'delivery';

/** A shipment's first stop is always where it is collected, whatever its type says. */
function kindOf(stop: { stopType: string; sequenceNumber: number }): StopKind {
  return stop.sequenceNumber === 1 || stop.stopType === 'pickup' || stop.stopType === 'both' ? 'pickup' : 'delivery';
}

/**
 * Rebuilds the consolidation's stops from its shipments' stops, links each shipment stop to the
 * consolidation stop that serves it, and puts each shipment's stops in the run's order.
 *
 * BUSINESS RULE: every pickup comes before every drop, so the truck has all the freight before
 * it starts dropping. Stops still needed keep their row, status and place in the order (which may
 * have been set by hand); a new stop goes at the end of its section, pickups or drops, in the
 * order its shipment was added. Shipments sharing a location share its stop.
 */
export async function rebuildConsolidationStops(
  tx: TransactionClient,
  orgId: string,
  consolidationId: string,
): Promise<{ stopCount: number; changedShipmentIds: string[] }> {
  const members = await tx.consolidationShipment.findMany({
    where: { consolidationId, shipment: { orgId } },
    orderBy: { addedAt: 'asc' },
    select: { shipment: { select: { stops: { orderBy: { sequenceNumber: 'asc' }, select: { id: true, locationId: true, stopType: true, sequenceNumber: true } } } } },
  });
  const shipmentStops = members.flatMap((m) => m.shipment.stops.map((s) => ({ ...s, kind: kindOf(s) })));
  const key = (kind: string, locationId: string) => `${kind}:${locationId}`;

  const needed = new Map<string, { kind: StopKind; locationId: string }>();
  for (const kind of ['pickup', 'delivery'] as const) {
    for (const s of shipmentStops.filter((st) => st.kind === kind)) {
      if (!needed.has(key(kind, s.locationId))) needed.set(key(kind, s.locationId), { kind, locationId: s.locationId });
    }
  }

  const existing = await tx.consolidationStop.findMany({
    where: { consolidationId, consolidation: { orgId } },
    orderBy: { sequenceNumber: 'asc' },
    select: { id: true, locationId: true, stopType: true },
  });
  const byKey = new Map(existing.map((s) => [key(s.stopType, s.locationId), s.id]));
  const unused = existing.filter((s) => !needed.has(key(s.stopType, s.locationId))).map((s) => s.id);
  if (unused.length > 0) await tx.consolidationStop.deleteMany({ where: { id: { in: unused }, consolidationId, consolidation: { orgId } } });

  const kept = existing.filter((s) => needed.has(key(s.stopType, s.locationId)));
  const order: Array<{ kind: StopKind; locationId: string }> = [];
  for (const kind of ['pickup', 'delivery'] as const) {
    order.push(...kept.filter((s) => s.stopType === kind).map((s) => ({ kind, locationId: s.locationId })));
    order.push(...[...needed.values()].filter((w) => w.kind === kind && !byKey.has(key(kind, w.locationId))));
  }

  for (const [i, w] of order.entries()) {
    const id = byKey.get(key(w.kind, w.locationId));
    if (id) {
      await tx.consolidationStop.update({ where: { id, consolidationId, consolidation: { orgId } }, data: { sequenceNumber: i + 1 } });
    } else {
      const created = await tx.consolidationStop.create({
        data: { consolidationId, locationId: w.locationId, stopType: w.kind, sequenceNumber: i + 1 },
      });
      byKey.set(key(w.kind, w.locationId), created.id);
    }
  }

  const linkTargets = new Map<string, string[]>();
  for (const s of shipmentStops) {
    const target = byKey.get(key(s.kind, s.locationId))!;
    linkTargets.set(target, [...(linkTargets.get(target) ?? []), s.id]);
  }
  for (const [consolidationStopId, ids] of linkTargets) {
    await tx.shipmentStop.updateMany({ where: { id: { in: ids }, shipment: { orgId } }, data: { consolidationStopId } });
  }
  return { stopCount: order.length, changedShipmentIds: await alignShipmentStops(tx, orgId, consolidationId) };
}

/**
 * Puts each shipment's stops in the order the run visits them, and makes its origin and
 * destination the first and last of them. Tracking runs per shipment (#329), so a shipment whose
 * own order disagreed with the run would infer departures from stops the truck hasn't left.
 * Returns the shipments that changed.
 */
export async function alignShipmentStops(tx: TransactionClient, orgId: string, consolidationId: string): Promise<string[]> {
  const members = await tx.consolidationShipment.findMany({
    where: { consolidationId, shipment: { orgId } },
    select: {
      shipment: {
        select: {
          id: true,
          originId: true,
          destinationId: true,
          stops: { select: { id: true, sequenceNumber: true, locationId: true, consolidationStop: { select: { sequenceNumber: true } } } },
        },
      },
    },
  });

  const changed: string[] = [];
  for (const { shipment } of members) {
    const current = [...shipment.stops].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
    const runPlace = (s: (typeof current)[number]) => s.consolidationStop?.sequenceNumber ?? Number.MAX_SAFE_INTEGER;
    const target = [...current].sort((a, b) => runPlace(a) - runPlace(b) || a.sequenceNumber - b.sequenceNumber);
    if (target.length === 0) continue;

    const reordered = target.some((s, i) => s.id !== current[i].id);
    const originId = target[0].locationId;
    const destinationId = target[target.length - 1].locationId;
    if (!reordered && originId === shipment.originId && destinationId === shipment.destinationId) continue;

    if (reordered) {
      // Two passes: (shipmentId, sequenceNumber) is unique, so move every row clear first.
      await tx.shipmentStop.updateMany({ where: { shipmentId: shipment.id, shipment: { orgId } }, data: { sequenceNumber: { increment: 100000 } } });
      for (const [i, s] of target.entries()) {
        await tx.shipmentStop.update({ where: { id: s.id, shipment: { orgId } }, data: { sequenceNumber: i + 1 } });
      }
    }
    await tx.shipment.update({ where: { id: shipment.id, orgId }, data: { originId, destinationId } });
    changed.push(shipment.id);
  }
  return changed;
}

/**
 * BUSINESS RULE: the run's carrier hauls every shipment on it, so it is set on each of them, which
 * also lets them pass their readiness gate. Clearing the run's carrier leaves the shipments alone.
 * Returns the shipments that changed.
 */
export async function pushCarrierToShipments(
  tx: TransactionClient,
  orgId: string,
  carrierId: string | null | undefined,
  shipmentIds: string[],
): Promise<string[]> {
  if (!carrierId || shipmentIds.length === 0) return [];
  const stale = await tx.shipment.findMany({
    where: { id: { in: shipmentIds }, orgId, OR: [{ carrierId: null }, { carrierId: { not: carrierId } }] },
    select: { id: true },
  });
  const ids = stale.map((s) => s.id);
  if (ids.length > 0) await tx.shipment.updateMany({ where: { id: { in: ids }, orgId }, data: { carrierId } });
  return ids;
}

/** shipment.updated for each shipment a consolidation change rewrote, so its read model refreshes. */
export function shipmentUpdatedEvents(shipmentIds: string[], changes: string[], consolidationId: string) {
  return [...new Set(shipmentIds)].map((shipmentId) => ({
    type: EVENT_TYPES.SHIPMENT_UPDATED,
    entityType: 'shipment',
    entityId: shipmentId,
    payload: { changes, consolidationId },
  }));
}
