/**
 * What a customer portal user may see of a shipment (#325).
 *
 * A shipment belongs to one customer (#325), but shipments created before that rule may still carry
 * other customers' freight, so this stays as a safeguard. Their drop stops are those
 * customers' consignee names and addresses, and their items are their goods and order numbers, so
 * a customer sees only: the pickup, their own drops, stops with no orders on them, and their own
 * items. If the shipment's final destination is someone else's drop, the customer sees their own
 * last drop as the destination instead.
 */

interface StopWithOrders {
  stopType: string;
  consolidationStopId?: string | null;
  locationId: string;
  location?: unknown;
  orders: Array<{ customerId: string }>;
}

interface PortalShipmentSource {
  destinationId: string | null;
  destination?: unknown;
  items: unknown;
  stops: StopWithOrders[];
  orderShipments: Array<{ order: { id: string; customerId: string } }>;
}

export function scopeShipmentToCustomer<T extends PortalShipmentSource>(shipment: T, customerId: string) {
  const { orderShipments, stops, ...rest } = shipment;
  const ownOrderIds = new Set(orderShipments.filter((os) => os.order.customerId === customerId).map((os) => os.order.id));

  // Other stops (fuel, rest, customs…) are operational detail, not part of the customer's view (#345).
  const visibleStops = stops
    .filter((s) => s.stopType !== 'other')
    .filter((s) => s.stopType === 'pickup' || s.orders.length === 0 || s.orders.some((o) => o.customerId === customerId))
    // The run's stop id would point a customer at the consolidation, which they never see (#329).
    .map(({ orders: _orders, consolidationStopId: _run, ...stop }) => stop);

  const items = Array.isArray(shipment.items)
    ? shipment.items.filter((item: any) => !item?.orderId || ownOrderIds.has(item.orderId))
    : shipment.items;

  const destinationVisible = visibleStops.some((s) => s.locationId === shipment.destinationId);
  const ownLastDrop = [...visibleStops].reverse().find((s) => s.stopType !== 'pickup');
  const destination = destinationVisible || !ownLastDrop
    ? { destinationId: shipment.destinationId, destination: shipment.destination }
    : { destinationId: ownLastDrop.locationId, destination: ownLastDrop.location };

  return { ...rest, ...destination, items, stops: visibleStops };
}
