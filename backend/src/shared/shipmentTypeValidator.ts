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
};
