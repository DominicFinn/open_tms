/**
 * Whether a shipment exists in the org, for warehouse routes that name one before dispatching
 * (#359). TMS implements it. A standalone FinnWMS, with no shipments, answers false.
 */
export interface IShipmentDirectory {
  shipmentExists(orgId: string, shipmentId: string): Promise<boolean>;
}
