/**
 * EDI 214 Status Code Mapping
 *
 * Maps X12 214 AT7 status codes to internal Open TMS shipment
 * and stop statuses. Used by ProcessInbound214Command to
 * translate carrier status updates into domain state changes.
 */

export interface StatusMapping {
  /** Maps to Shipment.status */
  shipmentStatus: string;
  /** Maps to ShipmentStop.status (null = no stop update) */
  stopStatus: string | null;
  /** What to do with the matched stop */
  stopAction: 'arrive' | 'depart' | 'complete' | null;
  /** Human-readable description for ShipmentEvent */
  eventDescription: string;
  /** Whether this status represents an exception */
  isException: boolean;
  /** Exception type if isException is true */
  exceptionType?: string;
}

/**
 * AT7 status code to internal status mapping.
 *
 * Reference: X12 214 Shipment Status Message, AT7 element 01.
 */
export const EDI214_STATUS_MAP: Record<string, StatusMapping> = {
  // Pickup & origin
  'AF': { shipmentStatus: 'in_transit', stopStatus: null,        stopAction: null,      eventDescription: 'Carrier picked up shipment',         isException: false },
  'CD': { shipmentStatus: 'in_transit', stopStatus: null,        stopAction: null,      eventDescription: 'Carrier departed origin',             isException: false },
  'CP': { shipmentStatus: 'in_transit', stopStatus: 'completed', stopAction: 'complete', eventDescription: 'Completed loading at pickup',        isException: false },

  // In-transit
  'X6': { shipmentStatus: 'in_transit', stopStatus: null,        stopAction: null,      eventDescription: 'En route to delivery',                isException: false },
  'BA': { shipmentStatus: 'in_transit', stopStatus: null,        stopAction: null,      eventDescription: 'Interline transfer',                  isException: false },
  'P1': { shipmentStatus: 'in_transit', stopStatus: null,        stopAction: null,      eventDescription: 'Departed terminal',                   isException: false },
  'OA': { shipmentStatus: 'in_transit', stopStatus: null,        stopAction: null,      eventDescription: 'Out for delivery',                    isException: false },
  'AG': { shipmentStatus: 'in_transit', stopStatus: null,        stopAction: null,      eventDescription: 'Estimated delivery',                  isException: false },

  // Arrival at facility / intermediate stop
  'X1': { shipmentStatus: 'in_transit', stopStatus: 'arrived',   stopAction: 'arrive',  eventDescription: 'Arrived at facility',                 isException: false },
  'X2': { shipmentStatus: 'in_transit', stopStatus: 'completed', stopAction: 'depart',  eventDescription: 'Departed facility',                   isException: false },
  'X4': { shipmentStatus: 'in_transit', stopStatus: 'completed', stopAction: 'depart',  eventDescription: 'Departed terminal',                   isException: false },

  // Arrival at destination
  'X3': { shipmentStatus: 'in_transit', stopStatus: 'arrived',   stopAction: 'arrive',  eventDescription: 'Arrived at destination',              isException: false },

  // Delivered
  'D1': { shipmentStatus: 'delivered',  stopStatus: 'completed', stopAction: 'complete', eventDescription: 'Delivered',                          isException: false },

  // Customs / hold
  'AV': { shipmentStatus: 'in_transit', stopStatus: null,        stopAction: null,      eventDescription: 'Available for delivery (customs hold)', isException: false },

  // Exceptions
  'A7': { shipmentStatus: 'exception',  stopStatus: null,        stopAction: null,      eventDescription: 'Refused by consignee',                isException: true, exceptionType: 'refused' },
  'A9': { shipmentStatus: 'exception',  stopStatus: null,        stopAction: null,      eventDescription: 'Shipment damaged',                    isException: true, exceptionType: 'damage' },
  'AH': { shipmentStatus: 'exception',  stopStatus: null,        stopAction: null,      eventDescription: 'Attempted delivery, unable to complete', isException: true, exceptionType: 'delay' },
  'AM': { shipmentStatus: 'exception',  stopStatus: null,        stopAction: null,      eventDescription: 'Carrier delay',                       isException: true, exceptionType: 'delay' },
};

/**
 * Look up status mapping for an AT7 code.
 * Returns null if the code is not recognized.
 */
export function mapEdi214Status(statusCode: string): StatusMapping | null {
  return EDI214_STATUS_MAP[statusCode.toUpperCase()] || null;
}

/**
 * Returns a safe default mapping for unrecognized status codes.
 * Keeps the shipment in its current flow without triggering exceptions.
 */
export function getDefaultStatusMapping(statusCode: string): StatusMapping {
  return {
    shipmentStatus: 'in_transit',
    stopStatus: null,
    stopAction: null,
    eventDescription: `EDI 214 status: ${statusCode}`,
    isException: false,
  };
}
