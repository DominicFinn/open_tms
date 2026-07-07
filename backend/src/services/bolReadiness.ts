import { PrismaClient } from '@prisma/client';

export interface BolReadiness {
  /** True when the shipment carries enough detail to produce a valid BOL. */
  ready: boolean;
  /** Human-readable reasons the BOL cannot be generated yet (empty when ready). */
  missing: string[];
  orderCount: number;
  lineItemCount: number;
}

/**
 * A Bill of Lading is a legal shipping document: it must name the shipper and
 * consignee and describe the goods (description, piece count, weight) for every
 * line. Open TMS treats all of that cargo detail as OPTIONAL data throughout the
 * shipment/order lifecycle - a shipment can exist with no orders, and an order
 * can exist with no line-item weights - so a shipment can easily lack enough
 * information to produce a legally-sufficient BOL.
 *
 * This is the single source of truth for "can this shipment produce a valid
 * BOL". It gates both the generate endpoints (sync + async) and the frontend
 * button, so the button greys out for exactly the shipments the backend would
 * reject.
 *
 * Returns null if the shipment does not exist.
 */
export async function evaluateBolReadiness(
  prisma: PrismaClient,
  shipmentId: string,
): Promise<BolReadiness | null> {
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    select: {
      id: true,
      originId: true,
      destinationId: true,
      orderShipments: {
        select: {
          order: {
            select: {
              lineItems: {
                select: { description: true, quantity: true, weight: true },
              },
            },
          },
        },
      },
    },
  });

  if (!shipment) return null;

  const missing: string[] = [];

  // Shipper / consignee — the addressed parties on the BOL.
  if (!shipment.originId) missing.push('Shipment origin (shipper) is not set');
  if (!shipment.destinationId) missing.push('Shipment destination (consignee) is not set');

  const orders = shipment.orderShipments.map(os => os.order);
  const orderCount = orders.length;
  const lineItems = orders.flatMap(o => o.lineItems);
  const lineItemCount = lineItems.length;

  if (orderCount === 0) {
    missing.push('No orders are attached to the shipment');
  } else if (lineItemCount === 0) {
    missing.push('The attached orders have no line items (no goods to describe)');
  } else {
    // Per-line legal minimums for a BOL: a goods description, a piece count,
    // and a weight. Any line missing one of these makes the BOL incomplete.
    const noDescription = lineItems.filter(li => !li.description || li.description.trim() === '').length;
    const noQuantity = lineItems.filter(li => !li.quantity || li.quantity <= 0).length;
    const noWeight = lineItems.filter(li => li.weight == null || li.weight <= 0).length;
    if (noDescription > 0) missing.push(`${noDescription} line item(s) missing a goods description`);
    if (noQuantity > 0) missing.push(`${noQuantity} line item(s) missing a quantity`);
    if (noWeight > 0) missing.push(`${noWeight} line item(s) missing a weight`);
  }

  return { ready: missing.length === 0, missing, orderCount, lineItemCount };
}
