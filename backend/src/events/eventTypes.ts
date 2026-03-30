/**
 * Event type constants — the full catalog of domain events.
 *
 * Naming convention: entity.action (past tense).
 * Wildcards supported for subscriptions: "shipment.*", "*"
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

  // Orders
  ORDER_CREATED: 'order.created',
  ORDER_UPDATED: 'order.updated',
  ORDER_STATUS_CHANGED: 'order.status_changed',
  ORDER_DELIVERY_STATUS_CHANGED: 'order.delivery_status_changed',
  ORDER_ASSIGNED_TO_SHIPMENT: 'order.assigned_to_shipment',
  ORDER_EXCEPTION: 'order.exception',
  ORDER_EXCEPTION_RESOLVED: 'order.exception_resolved',
  ORDER_DELIVERED: 'order.delivered',

  // Carriers
  CARRIER_CREATED: 'carrier.created',
  CARRIER_UPDATED: 'carrier.updated',
  CARRIER_ARCHIVED: 'carrier.archived',

  // Customers
  CUSTOMER_CREATED: 'customer.created',
  CUSTOMER_UPDATED: 'customer.updated',
  CUSTOMER_ARCHIVED: 'customer.archived',

  // Tracking
  TRACKING_LOCATION_RECEIVED: 'tracking.location_received',
  TRACKING_GEOFENCE_ENTERED: 'tracking.geofence_entered',
  TRACKING_ETA_UPDATED: 'tracking.eta_updated',

  // Triage (Phase 4)
  TRIAGE_ISSUE_CREATED: 'triage.issue_created',
  TRIAGE_ISSUE_ASSIGNED: 'triage.issue_assigned',
  TRIAGE_ISSUE_STATUS_CHANGED: 'triage.issue_status_changed',
  TRIAGE_ISSUE_ESCALATED: 'triage.issue_escalated',

  // Integration
  INTEGRATION_OUTBOUND_SENT: 'integration.outbound_sent',
  INTEGRATION_OUTBOUND_FAILED: 'integration.outbound_failed',
  INTEGRATION_WEBHOOK_RECEIVED: 'integration.webhook_received',
} as const;

export type EventType = typeof EVENT_TYPES[keyof typeof EVENT_TYPES];

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

export interface EntityChangedPayload {
  changes?: Record<string, { before: unknown; after: unknown }>;
}
