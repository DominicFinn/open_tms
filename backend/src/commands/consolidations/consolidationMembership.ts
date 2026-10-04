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
 * Rebuilds the consolidation's stops from its shipments' stops and links each shipment stop to
 * the consolidation stop that serves it.
 *
 * BUSINESS RULE: every pickup comes before every drop, so the truck has all the freight before
 * it starts dropping. Pickups, then drops, each in the order the shipments were added and then
 * each shipment's own stop order. Shipments sharing a location share its stop. Stops still
 * needed keep their row, so their status and links survive the rebuild.
 */
export async function rebuildConsolidationStops(
  tx: TransactionClient,
  orgId: string,
  consolidationId: string,
): Promise<number> {
  const members = await tx.consolidationShipment.findMany({
    where: { consolidationId, shipment: { orgId } },
    orderBy: { addedAt: 'asc' },
    select: { shipment: { select: { stops: { orderBy: { sequenceNumber: 'asc' }, select: { id: true, locationId: true, stopType: true, sequenceNumber: true } } } } },
  });
  const shipmentStops = members.flatMap((m) => m.shipment.stops.map((s) => ({ ...s, kind: kindOf(s) })));
  const key = (kind: string, locationId: string) => `${kind}:${locationId}`;

  const wanted: Array<{ kind: StopKind; locationId: string }> = [];
  const seen = new Set<string>();
  for (const kind of ['pickup', 'delivery'] as const) {
    for (const s of shipmentStops.filter((st) => st.kind === kind)) {
      if (seen.has(key(kind, s.locationId))) continue;
      seen.add(key(kind, s.locationId));
      wanted.push({ kind, locationId: s.locationId });
    }
  }

  const existing = await tx.consolidationStop.findMany({ where: { consolidationId, consolidation: { orgId } }, select: { id: true, locationId: true, stopType: true } });
  const byKey = new Map(existing.map((s) => [key(s.stopType, s.locationId), s.id]));
  const unused = existing.filter((s) => !seen.has(key(s.stopType, s.locationId))).map((s) => s.id);
  if (unused.length > 0) await tx.consolidationStop.deleteMany({ where: { id: { in: unused }, consolidationId, consolidation: { orgId } } });

  for (const [i, w] of wanted.entries()) {
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
  return wanted.length;
}
