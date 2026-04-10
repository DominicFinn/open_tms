/**
 * Event type constants — the full catalog of domain events.
 *
 * Naming convention: entity.action (past tense).
 * Wildcards supported for subscriptions: "shipment.*", "*"
 *
 * Schema versions: each event type has a version number. When payload
 * structure changes, bump the version. Consumers should handle all
 * versions they might encounter (backward compatibility).
 */

export const EVENT_TYPES = {
  // Shipments
  SHIPMENT_CREATED: 'shipment.created',
  SHIPMENT_UPDATED: 'shipment.updated',
  SHIPMENT_STATUS_CHANGED: 'shipment.status_changed',
  SHIPMENT_CARRIER_ASSIGNED: 'shipment.carrier_assigned',
  SHIPMENT_DELIVERED: 'shipment.delivered',
  SHIPMENT_EXCEPTION: 'shipment.exception',
  SHIPMENT_STOP_ARRIVED: 'shipment.stop_arrived',
  SHIPMENT_STOP_COMPLETED: 'shipment.stop_completed',
  SHIPMENT_ARCHIVED: 'shipment.archived',

  // Orders
  ORDER_CREATED: 'order.created',
  ORDER_UPDATED: 'order.updated',
  ORDER_STATUS_CHANGED: 'order.status_changed',
  ORDER_DELIVERY_STATUS_CHANGED: 'order.delivery_status_changed',
  ORDER_ASSIGNED_TO_SHIPMENT: 'order.assigned_to_shipment',
  ORDER_EXCEPTION: 'order.exception',
  ORDER_EXCEPTION_RESOLVED: 'order.exception_resolved',
  ORDER_DELIVERED: 'order.delivered',
  ORDER_ARCHIVED: 'order.archived',

  // Carriers
  CARRIER_CREATED: 'carrier.created',
  CARRIER_UPDATED: 'carrier.updated',
  CARRIER_ARCHIVED: 'carrier.archived',

  // Customers
  CUSTOMER_CREATED: 'customer.created',
  CUSTOMER_UPDATED: 'customer.updated',
  CUSTOMER_ARCHIVED: 'customer.archived',

  // Locations
  LOCATION_CREATED: 'location.created',
  LOCATION_UPDATED: 'location.updated',
  LOCATION_ARCHIVED: 'location.archived',
  LOCATION_ARRIVAL_CRITERIA_ADDED: 'location.arrival_criteria_added',
  LOCATION_ARRIVAL_CRITERIA_UPDATED: 'location.arrival_criteria_updated',
  LOCATION_ARRIVAL_CRITERIA_REMOVED: 'location.arrival_criteria_removed',

  // Lanes
  LANE_CREATED: 'lane.created',
  LANE_UPDATED: 'lane.updated',
  LANE_ARCHIVED: 'lane.archived',

  // Tenders
  TENDER_CREATED: 'tender.created',
  TENDER_PUBLISHED: 'tender.published',
  TENDER_AWARDED: 'tender.awarded',
  TENDER_CANCELLED: 'tender.cancelled',
  TENDER_RESPONSE_RECEIVED: 'tender.response_received',

  // Tracking
  TRACKING_LOCATION_RECEIVED: 'tracking.location_received',
  TRACKING_GEOFENCE_ENTERED: 'tracking.geofence_entered',
  TRACKING_ETA_UPDATED: 'tracking.eta_updated',

  // Cargo tracking & misdrop detection
  CARGO_SCAN_RECORDED: 'cargo.scan_recorded',
  CARGO_MISDROP_DETECTED: 'cargo.misdrop_detected',
  CARGO_MISSING_AT_STOP: 'cargo.missing_at_stop',
  CARGO_LEFT_ON_VEHICLE: 'cargo.left_on_vehicle',
  CARGO_DISCREPANCY_RESOLVED: 'cargo.discrepancy_resolved',

  // Issues / Triage
  ISSUE_CREATED: 'issue.created',
  ISSUE_UPDATED: 'issue.updated',
  ISSUE_ASSIGNED: 'issue.assigned',
  ISSUE_STATUS_CHANGED: 'issue.status_changed',
  ISSUE_ESCALATED: 'issue.escalated',
  ISSUE_RESOLVED: 'issue.resolved',

  // Integration
  INTEGRATION_OUTBOUND_SENT: 'integration.outbound_sent',
  INTEGRATION_OUTBOUND_FAILED: 'integration.outbound_failed',
  INTEGRATION_WEBHOOK_RECEIVED: 'integration.webhook_received',
} as const;

export type EventType = typeof EVENT_TYPES[keyof typeof EVENT_TYPES];

/**
 * Schema version registry — tracks the current payload version for each event type.
 * When you change a payload structure, bump the version here.
 * Consumers should handle all versions they encounter.
 */
export const EVENT_SCHEMA_VERSIONS: Record<string, number> = {
  [EVENT_TYPES.SHIPMENT_CREATED]: 1,
  [EVENT_TYPES.SHIPMENT_UPDATED]: 1,
  [EVENT_TYPES.SHIPMENT_STATUS_CHANGED]: 1,
  [EVENT_TYPES.SHIPMENT_CARRIER_ASSIGNED]: 1,
  [EVENT_TYPES.SHIPMENT_DELIVERED]: 1,
  [EVENT_TYPES.SHIPMENT_EXCEPTION]: 1,
  [EVENT_TYPES.SHIPMENT_STOP_ARRIVED]: 1,
  [EVENT_TYPES.SHIPMENT_STOP_COMPLETED]: 1,
  [EVENT_TYPES.SHIPMENT_ARCHIVED]: 1,
  [EVENT_TYPES.ORDER_CREATED]: 1,
  [EVENT_TYPES.ORDER_UPDATED]: 1,
  [EVENT_TYPES.ORDER_STATUS_CHANGED]: 1,
  [EVENT_TYPES.ORDER_DELIVERY_STATUS_CHANGED]: 1,
  [EVENT_TYPES.ORDER_ASSIGNED_TO_SHIPMENT]: 1,
  [EVENT_TYPES.ORDER_EXCEPTION]: 1,
  [EVENT_TYPES.ORDER_EXCEPTION_RESOLVED]: 1,
  [EVENT_TYPES.ORDER_DELIVERED]: 1,
  [EVENT_TYPES.ORDER_ARCHIVED]: 1,
  [EVENT_TYPES.CARRIER_CREATED]: 1,
  [EVENT_TYPES.CARRIER_UPDATED]: 1,
  [EVENT_TYPES.CARRIER_ARCHIVED]: 1,
  [EVENT_TYPES.CUSTOMER_CREATED]: 1,
  [EVENT_TYPES.CUSTOMER_UPDATED]: 1,
  [EVENT_TYPES.CUSTOMER_ARCHIVED]: 1,
  [EVENT_TYPES.LOCATION_CREATED]: 1,
  [EVENT_TYPES.LOCATION_UPDATED]: 1,
  [EVENT_TYPES.LANE_CREATED]: 1,
  [EVENT_TYPES.LANE_UPDATED]: 1,
  [EVENT_TYPES.LANE_ARCHIVED]: 1,
  [EVENT_TYPES.TRACKING_LOCATION_RECEIVED]: 1,
  [EVENT_TYPES.TRACKING_GEOFENCE_ENTERED]: 1,
  [EVENT_TYPES.TRACKING_ETA_UPDATED]: 1,
  [EVENT_TYPES.ISSUE_CREATED]: 1,
  [EVENT_TYPES.ISSUE_UPDATED]: 1,
  [EVENT_TYPES.ISSUE_ASSIGNED]: 1,
  [EVENT_TYPES.ISSUE_STATUS_CHANGED]: 1,
  [EVENT_TYPES.ISSUE_ESCALATED]: 1,
  [EVENT_TYPES.ISSUE_RESOLVED]: 1,
};

/**
 * Event payload types for type-safe publishing.
 */
export interface ShipmentStatusChangedPayload {
  previousStatus: string;
  newStatus: string;
  shipmentReference: string;
}

export interface ShipmentCreatedPayload {
  shipmentReference: string;
  customerId?: string;
  originId?: string;
  destinationId?: string;
  status: string;
}

export interface ShipmentDeliveredPayload {
  shipmentReference: string;
  deliveredAt: string;
}

export interface ShipmentExceptionPayload {
  shipmentReference: string;
  exceptionType: string;
  description: string;
}

export interface OrderCreatedPayload {
  orderReference: string;
  customerId: string;
  status: string;
}

export interface OrderStatusChangedPayload {
  orderReference: string;
  previousStatus: string;
  newStatus: string;
}

export interface OrderDeliveryStatusChangedPayload {
  orderReference: string;
  previousStatus: string;
  newStatus: string;
  method?: string;
}

export interface OrderAssignedToShipmentPayload {
  orderReference: string;
  shipmentId: string;
  shipmentReference: string;
}

export interface TrackingLocationReceivedPayload {
  shipmentId: string;
  lat: number;
  lng: number;
  eventTime: string;
  deviceId?: string;
}

export interface CargoMisdropPayload {
  shipmentId: string;
  trackableUnitId: string;
  unitIdentifier: string;
  unitType: string;
  discrepancyType: string;
  expectedStop: string;
  actualStop: string;
  orderId: string;
  orderNumber: string;
}

export interface CargoMissingPayload {
  shipmentId: string;
  trackableUnitId: string;
  unitIdentifier: string;
  unitType: string;
  stopName: string;
  orderNumber: string;
}

export interface CargoLeftOnVehiclePayload {
  shipmentId: string;
  trackableUnitId: string;
  unitIdentifier: string;
  unitType: string;
  orderId: string;
  orderNumber: string;
}

export interface EntityChangedPayload {
  changes?: Record<string, { before: unknown; after: unknown }>;
}

export interface EntityArchivedPayload {
  entityId: string;
  entityType: string;
}
