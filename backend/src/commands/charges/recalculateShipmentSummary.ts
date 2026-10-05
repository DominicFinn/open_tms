import { TransactionClient } from '../BaseCommandHandler.js';

/**
 * Rebuilds a shipment's ShipmentFinancialSummary from its charges, inside the caller's
 * transaction. Every charge write must end with this so the summary never goes stale.
 */
export async function recalculateShipmentSummary(tx: TransactionClient, shipmentId: string, orgId: string): Promise<void> {
  const charges = await tx.charge.findMany({
    where: { shipmentId, orgId, status: { not: 'written_off' } },
  });

  const revenueCents = charges
    .filter(c => c.chargeCategory === 'revenue')
    .reduce((sum, c) => sum + c.amountCents, 0);

  const costCents = charges
    .filter(c => c.chargeCategory === 'cost')
    .reduce((sum, c) => sum + c.amountCents, 0);

  const approvedRevenue = charges
    .filter(c => c.chargeCategory === 'revenue' && ['approved', 'invoiced'].includes(c.status))
    .reduce((sum, c) => sum + c.amountCents, 0);

  const approvedCost = charges
    .filter(c => c.chargeCategory === 'cost' && ['approved', 'invoiced'].includes(c.status))
    .reduce((sum, c) => sum + c.amountCents, 0);

  const currency = charges.length > 0 ? charges[0].currency : 'USD';

  await tx.shipmentFinancialSummary.upsert({
    where: { shipmentId, orgId },
    create: {
      shipmentId,
      orgId,
      expectedRevenueCents: revenueCents,
      expectedCostCents: costCents,
      expectedMarginCents: revenueCents - costCents,
      actualRevenueCents: approvedRevenue,
      actualCostCents: approvedCost,
      actualMarginCents: approvedRevenue - approvedCost,
      currency,
    },
    update: {
      expectedRevenueCents: revenueCents,
      expectedCostCents: costCents,
      expectedMarginCents: revenueCents - costCents,
      actualRevenueCents: approvedRevenue,
      actualCostCents: approvedCost,
      actualMarginCents: approvedRevenue - approvedCost,
      currency,
    },
  });
}
