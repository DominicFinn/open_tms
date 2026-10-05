// Building a shipment from orders on the create page (#328).
//
// Orders fill the form in, but every field stays editable: adding an order only fills empty fields,
// widens the dates, adds its drop as a stop and turns on handling it needs. Nothing it fills is
// locked, so `orderConflicts` checks the form against the orders before saving. Its rules are the
// same ones the backend enforces when the orders are attached (#325).

export interface OrderForShipment {
  id: string;
  orderNumber: string;
  customerId: string;
  originId: string | null;
  destinationId: string | null;
  serviceLevel: string;
  temperatureControl?: string | null;
  requiresHazmat?: boolean | null;
  requestedPickupDate?: string | null;
  requestedDeliveryDate?: string | null;
}

export interface OtherStopDetail {
  purpose: string;
  label: string;
}

export interface RouteForm {
  customerId: string;
  mode: string;
  useCustomRoute: boolean;
  originId: string;
  destinationId: string;
  /** Further pickups after the origin, in order (#329). Only on a custom route. */
  pickupWaypoints: string[];
  /** Intermediate drops, in order. With a lane: the lane's stops plus any extra drops. */
  waypoints: string[];
  /**
   * Waypoints that are neither pickups nor drops (fuel, rest, customs…, #345), by location id.
   * Orders are never collected or dropped at these.
   */
  otherStops?: Record<string, OtherStopDetail>;
  /** The selected lane's endpoints, when not on a custom route. */
  laneOriginId?: string | null;
  laneDestinationId?: string | null;
  pickupDate: string;
  deliveryDate: string;
  tempControlled: boolean;
  hazmat: boolean;
}

/** The orders' drops, in the order the orders were added, without repeats. */
export function orderDrops(orders: OrderForShipment[]): string[] {
  return [...new Set(orders.map((o) => o.destinationId).filter((d): d is string => Boolean(d)))];
}

/** The orders' pickup locations, in the order the orders were added, without repeats. */
export function orderPickups(orders: OrderForShipment[]): string[] {
  return [...new Set(orders.map((o) => o.originId).filter((d): d is string => Boolean(d)))];
}

/** The stops the form's route collects at, origin first. */
export function pickupStops(form: RouteForm): string[] {
  const origin = form.useCustomRoute ? form.originId : form.laneOriginId ?? '';
  const others = form.otherStops ?? {};
  return [origin, ...(form.useCustomRoute ? form.pickupWaypoints.filter((id) => !others[id]) : [])].filter(Boolean);
}

/** The stops the form's route drops at, destination last. */
export function dropStops(form: RouteForm): string[] {
  const destination = form.useCustomRoute ? form.destinationId : form.laneDestinationId ?? '';
  const others = form.otherStops ?? {};
  return [...form.waypoints.filter((id) => !others[id]), destination].filter(Boolean);
}

/** Every stop the form's route visits: the pickups, then the drops. */
export function routeStops(form: RouteForm): string[] {
  return [...pickupStops(form), ...dropStops(form)];
}

const day = (iso?: string | null) => (iso ? iso.slice(0, 10) : '');

/** The form after adding `orders` to it. */
export function applyOrders(form: RouteForm, orders: OrderForShipment[]): RouteForm {
  if (orders.length === 0) return form;
  const first = orders[0];
  const next: RouteForm = { ...form, waypoints: [...form.waypoints], pickupWaypoints: [...form.pickupWaypoints] };

  next.customerId ||= first.customerId;
  next.mode ||= first.serviceLevel;
  if (next.useCustomRoute) {
    next.originId ||= first.originId ?? '';
    // Each further origin becomes a pickup after the first (#329).
    const collected = new Set(pickupStops(next));
    next.pickupWaypoints.push(...orderPickups(orders).filter((p) => !collected.has(p)));
  }

  const covered = new Set(dropStops(next));
  const newDrops = orderDrops(orders).filter((d) => !covered.has(d));
  if (next.useCustomRoute && !next.destinationId && newDrops.length > 0) {
    next.destinationId = newDrops[newDrops.length - 1];
    newDrops.pop();
  }
  next.waypoints.push(...newDrops.filter((d) => !next.waypoints.includes(d)));

  for (const o of orders) {
    const pickup = day(o.requestedPickupDate);
    const delivery = day(o.requestedDeliveryDate);
    if (pickup && (!next.pickupDate || pickup < next.pickupDate)) next.pickupDate = pickup;
    if (delivery && (!next.deliveryDate || delivery > next.deliveryDate)) next.deliveryDate = delivery;
    if (o.temperatureControl && o.temperatureControl !== 'ambient') next.tempControlled = true;
    if (o.requiresHazmat) next.hazmat = true;
  }
  return next;
}

/** Why the form can't be saved with these orders attached; empty when it can. */
export function orderConflicts(form: RouteForm, orders: OrderForShipment[]): string[] {
  if (orders.length === 0) return [];
  const problems: string[] = [];

  const customers = new Set(orders.map((o) => o.customerId));
  if (customers.size > 1) problems.push("The orders belong to different customers, and a shipment has one customer.");
  else if (form.customerId && !customers.has(form.customerId)) problems.push("The shipment's customer isn't the orders' customer.");

  const levels = new Set(orders.map((o) => o.serviceLevel));
  if (levels.size > 1) problems.push("FTL and LTL orders can't share a shipment.");
  else if (form.mode && !levels.has(form.mode)) problems.push(`The orders are ${[...levels][0]}, but the shipment's mode is ${form.mode}.`);
  if (levels.has('FTL') && orders.length > 1) problems.push('An FTL shipment carries one order.');

  // Orders from different origins are fine: each origin is a pickup on the route (#329).
  const pickups = pickupStops(form);
  const drops = dropStops(form);
  if (pickups.length + drops.length > 0) {
    for (const o of orders) {
      if (o.originId && !pickups.includes(o.originId)) problems.push(`${o.orderNumber}'s pickup isn't a stop on this route.`);
      if (o.destinationId && !drops.includes(o.destinationId)) problems.push(`${o.orderNumber}'s drop isn't a stop on this route.`);
    }
  }
  return problems;
}

/** Whether `candidate` could join `orders` on one shipment. */
export function canJoin(candidate: OrderForShipment, orders: OrderForShipment[]): boolean {
  if (orders.some((o) => o.id === candidate.id)) return false;
  if (orders.length === 0) return true;
  const first = orders[0];
  return candidate.customerId === first.customerId
    && candidate.serviceLevel === first.serviceLevel
    && candidate.serviceLevel !== 'FTL';
}

type ShippableOrder = { status?: string | null; serviceLevel?: string | null; customerId?: string | null };

/**
 * Why the selected orders can't be shipped together, or null when they can. "Ship together" on the
 * orders list stays disabled until this is null. Different origins are fine: each becomes a pickup;
 * different customers are fine too: each gets its own shipment on one consolidation (#329).
 */
export function shipTogetherProblem(orders: ShippableOrder[]): string | null {
  if (orders.length < 2) return 'Select two or more orders to ship together.';
  if (orders.some((o) => o.status?.toLowerCase() !== 'verified')) return 'Only available orders can be shipped.';
  if (orders.some((o) => o.serviceLevel === 'FTL')) return 'FTL orders ship on their own shipment.';
  return null;
}

/**
 * One customer's orders make one shipment, built on the create page. Several customers' orders make
 * one shipment per customer on a new consolidation, built in one step (#329).
 */
export function shipTogetherMode(orders: ShippableOrder[]): { kind: 'shipment' } | { kind: 'consolidation'; customers: number } {
  const customers = new Set(orders.map((o) => o.customerId)).size;
  return customers > 1 ? { kind: 'consolidation', customers } : { kind: 'shipment' };
}

/**
 * A waypoint list as the API takes it: a plain location id for a pickup or drop, or an object for
 * an other stop with its purpose and name (#345).
 */
export function waypointsForApi(ids: string[], otherStops: Record<string, OtherStopDetail> = {}) {
  return ids.filter(Boolean).map((id) => {
    const other = otherStops[id];
    return other ? { locationId: id, stopType: 'other' as const, purpose: other.purpose, label: other.label.trim() || null } : id;
  });
}

// ─── The ordered stop list on the create page (#345) ─────────────────────

export type RouteStopKind = 'pickup' | 'drop' | 'other';

export interface RouteStopRow {
  locationId: string;
  kind: RouteStopKind;
}

export interface RouteStops {
  pickupWaypoints: string[];
  waypoints: string[];
  otherStops: Record<string, OtherStopDetail>;
}

/** The stops between origin and destination as one list, in visiting order (#345). */
export function toRows({ pickupWaypoints, waypoints, otherStops }: RouteStops): RouteStopRow[] {
  return [
    ...pickupWaypoints.map((locationId) => ({ locationId, kind: (otherStops[locationId] ? 'other' : 'pickup') as RouteStopKind })),
    ...waypoints.map((locationId) => ({ locationId, kind: (otherStops[locationId] ? 'other' : 'drop') as RouteStopKind })),
  ];
}

/**
 * Back to the pickup and drop lists the rest of the page works with. Every stop up to the last
 * pickup is in the pickup list and the rest in the drop list, so other stops keep their place.
 * The list never has a pickup after a drop (see canBe / canSwap), so the split is exact.
 */
export function fromRows(rows: RouteStopRow[], otherStops: Record<string, OtherStopDetail>): RouteStops {
  const lastPickup = rows.map((r) => r.kind).lastIndexOf('pickup');
  const keptOthers = Object.fromEntries(rows.filter((r) => r.kind === 'other' && otherStops[r.locationId])
    .map((r) => [r.locationId, otherStops[r.locationId]]));
  return {
    pickupWaypoints: rows.slice(0, lastPickup + 1).map((r) => r.locationId),
    waypoints: rows.slice(lastPickup + 1).map((r) => r.locationId),
    otherStops: keptOthers,
  };
}

/** Whether the stop at `index` can take `kind` without a pickup ending up after a drop. */
export function canBe(rows: RouteStopRow[], index: number, kind: RouteStopKind): boolean {
  if (kind === 'pickup') return !rows.slice(0, index).some((r) => r.kind === 'drop');
  if (kind === 'drop') return !rows.slice(index + 1).some((r) => r.kind === 'pickup');
  return true;
}

/** Whether neighbouring stops can trade places: anything but a pickup and a drop. */
export function canSwap(a?: RouteStopRow, b?: RouteStopRow): boolean {
  if (!a || !b) return false;
  return !(new Set([a.kind, b.kind]).has('pickup') && new Set([a.kind, b.kind]).has('drop'));
}

