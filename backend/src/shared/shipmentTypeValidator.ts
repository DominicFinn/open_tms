/**
 * Canonical shipment-type validator. Used by the backend for enforcement.
 * A byte-for-byte mirror lives at frontend/src/shared/shipmentTypeValidator.ts
 * so the UI produces the same missing-field list without an API round trip.
 * If you change this file, update the mirror.
 */

export interface ShipmentTypeConfig {
  name: string;
  icon: string;
  color: string;
  defaults: Record<string, unknown>;
  requiredFields: string[];
}

export interface ShipmentFields {
  reference?: string | null;
  customerId?: string | null;
  originId?: string | null;
  destinationId?: string | null;
  pickupDate?: string | Date | null;
  deliveryDate?: string | Date | null;
  pickupWindowStart?: string | Date | null;
  pickupWindowEnd?: string | Date | null;
  deliveryWindowStart?: string | Date | null;
  deliveryWindowEnd?: string | Date | null;
  proNumber?: string | null;
  shipmentTypeId?: string | null;
  items?: unknown[] | null;
  [key: string]: unknown;
}

export interface ValidationResult {
  missing: string[];
  isValid: boolean;
}

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

/**
 * Returns the list of required fields that are missing or empty on `shipment`.
 * Passing null for the type means no required-field enforcement (plain draft).
 */
export function validateShipmentAgainstType(
  shipment: ShipmentFields,
  type: Pick<ShipmentTypeConfig, 'requiredFields'> | null | undefined
): ValidationResult {
  const required = type?.requiredFields ?? [];
  const missing = required.filter(field => isEmpty(shipment[field as keyof ShipmentFields]));
  return { missing, isValid: missing.length === 0 };
}

/**
 * Shallow-merge a shipment type's defaults onto a shipment payload. Non-empty
 * user-supplied values always win over the template defaults.
 */
export function applyShipmentTypeDefaults<T extends ShipmentFields>(
  shipment: T,
  type: Pick<ShipmentTypeConfig, 'defaults'> | null | undefined
): T {
  const defaults = type?.defaults ?? {};
  const result: Record<string, unknown> = { ...shipment };
  for (const [key, value] of Object.entries(defaults)) {
    if (isEmpty(result[key]) && !isEmpty(value)) {
      result[key] = value;
    }
  }
  return result as T;
}

export const SHIPMENT_FIELD_LABELS: Record<string, string> = {
  reference: 'Reference',
  customerId: 'Customer',
  originId: 'Origin',
  destinationId: 'Destination',
  pickupDate: 'Pickup date',
  deliveryDate: 'Delivery date',
  pickupWindowStart: 'Pickup window start',
  pickupWindowEnd: 'Pickup window end',
  deliveryWindowStart: 'Delivery window start',
  deliveryWindowEnd: 'Delivery window end',
  proNumber: 'PRO number',
  items: 'Items',
  carrierId: 'Carrier',
  laneId: 'Lane',
  route: 'Origin & destination (or a lane)',
};

/**
 * Canonical shipment lifecycle. A shipment moves forward one step at a time
 * (draft -> ready -> in_progress -> complete) and may step back one at a time.
 * No skipping. Entering any state beyond `draft` requires the readiness gate.
 */
export const SHIPMENT_LIFECYCLE = ['draft', 'ready', 'in_progress', 'complete'] as const;
export type ShipmentLifecycleStatus = (typeof SHIPMENT_LIFECYCLE)[number];

export const SHIPMENT_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  ready: 'Ready',
  in_progress: 'In Progress',
  complete: 'Complete',
};

/**
 * True when `to` is exactly one step forward or one step back from `from`
 * on the canonical lifecycle. Unknown statuses never transition.
 */
export function canTransition(from: string, to: string): boolean {
  const fromIdx = SHIPMENT_LIFECYCLE.indexOf(from as ShipmentLifecycleStatus);
  const toIdx = SHIPMENT_LIFECYCLE.indexOf(to as ShipmentLifecycleStatus);
  if (fromIdx === -1 || toIdx === -1) return false;
  return Math.abs(toIdx - fromIdx) === 1;
}

/**
 * The set of statuses a shipment may legally move to from `from`
 * (the adjacent steps on the lifecycle).
 */
export function allowedTransitions(from: string): string[] {
  return SHIPMENT_LIFECYCLE.filter(s => canTransition(from, s));
}

/**
 * Fields required before a shipment may leave Draft. The customer, a route
 * (origin+destination OR a lane), a carrier, both dates and a reference are
 * mandatory, plus any requiredFields declared by the assigned ShipmentType.
 */
export function validateShipmentReadiness(
  shipment: ShipmentFields,
  type: Pick<ShipmentTypeConfig, 'requiredFields'> | null | undefined
): ValidationResult {
  const missing: string[] = [];

  if (isEmpty(shipment.reference)) missing.push('reference');
  if (isEmpty(shipment.customerId)) missing.push('customerId');

  const hasLane = !isEmpty(shipment.laneId);
  const hasOriginDest = !isEmpty(shipment.originId) && !isEmpty(shipment.destinationId);
  if (!hasLane && !hasOriginDest) missing.push('route');

  if (isEmpty(shipment.carrierId)) missing.push('carrierId');
  if (isEmpty(shipment.pickupDate)) missing.push('pickupDate');
  if (isEmpty(shipment.deliveryDate)) missing.push('deliveryDate');

  // Merge in shipment-type required fields (de-duplicated, route already covered).
  for (const field of validateShipmentAgainstType(shipment, type).missing) {
    if (!missing.includes(field)) missing.push(field);
  }

  return { missing, isValid: missing.length === 0 };
}
