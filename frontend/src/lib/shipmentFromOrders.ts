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

export interface RouteForm {
  customerId: string;
  mode: string;
  useCustomRoute: boolean;
  originId: string;
  destinationId: string;
  /** Intermediate stops, in order. With a lane: the lane's stops plus any extra drops. */
  waypoints: string[];
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

/** Every stop the form's route visits, origin first. */
export function routeStops(form: RouteForm): string[] {
  const origin = form.useCustomRoute ? form.originId : form.laneOriginId ?? '';
  const destination = form.useCustomRoute ? form.destinationId : form.laneDestinationId ?? '';
  return [origin, ...form.waypoints, destination].filter(Boolean);
}

const day = (iso?: string | null) => (iso ? iso.slice(0, 10) : '');

/** The form after adding `orders` to it. */
export function applyOrders(form: RouteForm, orders: OrderForShipment[]): RouteForm {
  if (orders.length === 0) return form;
  const first = orders[0];
  const next: RouteForm = { ...form, waypoints: [...form.waypoints] };

  next.customerId ||= first.customerId;
  next.mode ||= first.serviceLevel;
  if (next.useCustomRoute) next.originId ||= first.originId ?? '';

  const covered = new Set(routeStops(next));
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

  const origins = new Set(orders.map((o) => o.originId).filter(Boolean));
  const stops = routeStops(form);
  if (origins.size > 1) problems.push('The orders are picked up from different origins.');
  else if (stops.length > 0 && origins.size === 1 && !origins.has(stops[0])) problems.push("The route doesn't start at the orders' origin.");

  for (const o of orders) {
    if (o.destinationId && stops.length > 0 && !stops.slice(1).includes(o.destinationId)) {
      problems.push(`${o.orderNumber}'s drop isn't a stop on this route.`);
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
    && candidate.originId === first.originId
    && candidate.serviceLevel === first.serviceLevel
    && candidate.serviceLevel !== 'FTL';
}
