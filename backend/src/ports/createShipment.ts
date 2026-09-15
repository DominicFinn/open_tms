/**
 * The ability to create a shipment, expressed without reference to how it's
 * written. WMS's warehouse-app "create basic shipment" admin route calls
 * this; TMS implements it over the command bus (CREATE_SHIPMENT). The
 * interface lives in core because tms may not be imported by wms directly —
 * see .claude/rules/module-boundaries.md and IFulfilmentDemandSource for the
 * matching pattern.
 *
 * A standalone FinnWMS with no TMS module registers a different
 * implementation, or none — the route degrades accordingly.
 */

export interface CreateShipmentPortInput {
  readonly orgId: string;
  readonly actorId: string | null;
  readonly reference: string;
  readonly customerId: string;
  readonly originId: string;
  readonly destinationId: string;
  readonly pickupDate?: string;
  readonly deliveryDate?: string;
  readonly carrierId?: string;
}

export interface CreatedShipmentSnapshot {
  readonly id: string;
  readonly reference: string;
  readonly status: string;
  readonly customerId: string;
  readonly customerName: string | null;
  readonly originId: string | null;
  readonly originName: string | null;
  readonly originCity: string | null;
  readonly originState: string | null;
  readonly destinationId: string | null;
  readonly destinationName: string | null;
  readonly destinationCity: string | null;
  readonly destinationState: string | null;
  readonly carrierId: string | null;
  readonly pickupDate: Date | null;
  readonly deliveryDate: Date | null;
}

export interface CreateShipmentPortResult {
  readonly success: boolean;
  readonly error?: string;
  readonly shipment?: CreatedShipmentSnapshot;
}

export interface ICreateShipmentPort {
  createShipment(input: CreateShipmentPortInput): Promise<CreateShipmentPortResult>;
}
