/**
 * MIRROR COPY — source of truth lives at backend/src/shared/shipmentTypeValidator.ts
 * Keep identical so client- and server-side "missing required fields" lists agree.
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

export function validateShipmentAgainstType(
  shipment: ShipmentFields,
  type: Pick<ShipmentTypeConfig, 'requiredFields'> | null | undefined
): ValidationResult {
  const required = type?.requiredFields ?? [];
  const missing = required.filter(field => isEmpty(shipment[field as keyof ShipmentFields]));
  return { missing, isValid: missing.length === 0 };
}

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
