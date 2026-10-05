import { TransactionClient } from '../BaseCommandHandler.js';
import { EVENT_TYPES, EventType } from '../../events/eventTypes.js';
import { recalculateShipmentSummary } from '../charges/recalculateShipmentSummary.js';
import { loadShipmentWeightsKg } from '../../repositories/ConsolidationRepository.js';
import { ConsolidationRuleError } from './consolidationMembership.js';

/** Charges written by allocation carry this source, with the consolidation as their sourceId. */
export const CONSOLIDATION_CHARGE_SOURCE = 'consolidation';

/**
 * Splits `totalCents` in proportion to `weights`, in whole cents that add up to exactly the total.
 * Largest remainder: everyone gets the floor of their share, and the cents left over go to the
 * largest fractional parts. With no weight at all, the split is even.
 */
export function splitByWeight(totalCents: number, weights: number[]): number[] {
  if (weights.length === 0) return [];
  const total = weights.reduce((a, b) => a + b, 0);
  const basis = total > 0 ? weights : weights.map(() => 1);
  const basisTotal = basis.reduce((a, b) => a + b, 0);
  const exact = basis.map((w) => (totalCents * w) / basisTotal);
  const parts = exact.map(Math.floor);
  let left = totalCents - parts.reduce((a, b) => a + b, 0);
  const byRemainder = exact.map((e, i) => ({ i, r: e - Math.floor(e) })).sort((a, b) => b.r - a.r || a.i - b.i);
  for (const { i } of byRemainder) {
    if (left <= 0) break;
    parts[i] += 1;
    left -= 1;
  }
  return parts;
}

export interface CostShare {
  shipmentId: string;
  weightKg: number;
  amountCents: number;
}

export interface AllocationResult {
  basis: 'weight' | 'even' | 'none';
  shares: CostShare[];
  /** Charges created for shipments that had none: emit charge.created for each. */
  createdCharges: Array<{ id: string; shipmentId: string; amountCents: number; currency: string }>;
}

/**
 * BUSINESS RULE: the carrier bills the run once; each shipment carries a share of that cost in
 * proportion to its freight weight (evenly when nothing is weighed), so each customer's shipment
 * shows a real margin. The share is a pending `cost` charge on the shipment, sourced from the
 * consolidation, kept in step whenever the rate or the shipments change. Once a share has been
 * approved or invoiced it is fixed, and the run's cost can no longer be re-split.
 *
 * `formerShipmentIds` are shipments just taken off the run, whose shares must go.
 */
export async function allocateConsolidationCost(
  tx: TransactionClient,
  orgId: string,
  consolidationId: string,
  formerShipmentIds: string[] = [],
): Promise<AllocationResult> {
  const run = await tx.consolidation.findFirst({
    where: { id: consolidationId, orgId },
    select: { carrierRateCents: true, currency: true, archived: true, shipments: { orderBy: { addedAt: 'asc' }, select: { shipmentId: true } } },
  });
  if (!run) throw new Error('Consolidation not found');

  const members = run.archived ? [] : run.shipments.map((s) => s.shipmentId);
  const touched = [...new Set([...members, ...formerShipmentIds])];
  const existing = touched.length === 0 ? [] : await tx.charge.findMany({
    where: { orgId, shipmentId: { in: touched }, source: CONSOLIDATION_CHARGE_SOURCE, sourceId: consolidationId },
    select: { id: true, shipmentId: true, status: true, amountCents: true },
  });
  const locked = existing.filter((c) => c.status !== 'pending');
  if (locked.length > 0) {
    throw new ConsolidationRuleError('The run\'s cost has already been approved on one of its shipments, so it can\'t be re-split.');
  }

  const rate = run.carrierRateCents;
  const weights = await loadShipmentWeightsKg(tx, orgId, members);
  const amounts = rate == null ? [] : splitByWeight(rate, members.map((id) => weights.get(id) ?? 0));
  const shares: CostShare[] = rate == null ? [] : members.map((shipmentId, i) => ({ shipmentId, weightKg: weights.get(shipmentId) ?? 0, amountCents: amounts[i] }));

  const stale = existing.filter((c) => !shares.some((s) => s.shipmentId === c.shipmentId)).map((c) => c.id);
  if (stale.length > 0) await tx.charge.deleteMany({ where: { id: { in: stale }, orgId, status: 'pending' } });

  const createdCharges: AllocationResult['createdCharges'] = [];
  for (const share of shares) {
    const current = existing.find((c) => c.shipmentId === share.shipmentId);
    if (current) {
      if (current.amountCents !== share.amountCents) {
        await tx.charge.update({ where: { id: current.id, orgId }, data: { amountCents: share.amountCents, currency: run.currency } });
      }
      continue;
    }
    await assertCurrencyMatches(tx, orgId, share.shipmentId, run.currency);
    const charge = await tx.charge.create({
      data: {
        orgId,
        shipmentId: share.shipmentId,
        chargeType: 'linehaul',
        chargeCategory: 'cost',
        description: 'Share of consolidated carrier rate',
        amountCents: share.amountCents,
        currency: run.currency,
        source: CONSOLIDATION_CHARGE_SOURCE,
        sourceId: consolidationId,
        status: 'pending',
      },
    });
    createdCharges.push({ id: charge.id, shipmentId: share.shipmentId, amountCents: share.amountCents, currency: run.currency });
  }

  for (const shipmentId of touched) await recalculateShipmentSummary(tx, shipmentId, orgId);

  const totalWeight = shares.reduce((sum, s) => sum + s.weightKg, 0);
  return { basis: shares.length === 0 ? 'none' : totalWeight > 0 ? 'weight' : 'even', shares, createdCharges };
}

/** All charges on a shipment share one currency, the same rule CreateChargeCommand enforces. */
async function assertCurrencyMatches(tx: TransactionClient, orgId: string, shipmentId: string, currency: string): Promise<void> {
  const other = await tx.charge.findFirst({ where: { orgId, shipmentId, currency: { not: currency } }, select: { currency: true } });
  if (other) {
    throw new ConsolidationRuleError(`A shipment on the run already has charges in ${other.currency}; the run's rate is in ${currency}.`);
  }
}

/** The events an allocation emits: charge.created for each new share, then the allocation itself. */
export function allocationEvents(consolidationId: string, result: AllocationResult): Array<{ type: EventType; entityType: string; entityId: string; payload: Record<string, unknown> }> {
  return [
    ...result.createdCharges.map((c) => ({
      type: EVENT_TYPES.CHARGE_CREATED,
      entityType: 'charge',
      entityId: c.id,
      payload: {
        chargeId: c.id,
        shipmentId: c.shipmentId,
        chargeType: 'linehaul',
        chargeCategory: 'cost',
        amountCents: c.amountCents,
        currency: c.currency,
        source: CONSOLIDATION_CHARGE_SOURCE,
      },
    })),
    {
      type: EVENT_TYPES.CONSOLIDATION_COST_ALLOCATED,
      entityType: 'consolidation',
      entityId: consolidationId,
      payload: { basis: result.basis, shares: result.shares },
    },
  ];
}
