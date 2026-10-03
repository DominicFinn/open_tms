/**
 * What a customer portal user may see of a shipment (#325).
 *
 * A mixed-customer LTL shipment also carries other customers' freight. Their drop stops are those
 * customers' consignee names and addresses, and their items are their goods and order numbers, so
 * a customer sees only: the pickup, their own drops, stops with no orders on them, and their own
 * items. If the shipment's final destination is someone else's drop, the customer sees their own
 * last drop as the destination instead.
 */

interface StopWithOrders {
  stopType: string;
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

  const visibleStops = stops
    .filter((s) => s.stopType === 'pickup' || s.orders.length === 0 || s.orders.some((o) => o.customerId === customerId))
    .map(({ orders: _orders, ...stop }) => stop);

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
