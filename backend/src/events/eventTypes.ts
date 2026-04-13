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

  // Trading Partners
  TRADING_PARTNER_CREATED: 'trading_partner.created',
  TRADING_PARTNER_UPDATED: 'trading_partner.updated',

  // Devices
  DEVICE_CREATED: 'device.created',
  DEVICE_UPDATED: 'device.updated',
  DEVICE_ASSIGNED: 'device.assigned',
  DEVICE_UNASSIGNED: 'device.unassigned',

  // Carrier Users
  CARRIER_USER_CREATED: 'carrier_user.created',
  CARRIER_USER_UPDATED: 'carrier_user.updated',
  CARRIER_USER_DEACTIVATED: 'carrier_user.deactivated',

  // Tracking
  TRACKING_LOCATION_RECEIVED: 'tracking.location_received',
  TRACKING_GEOFENCE_ENTERED: 'tracking.geofence_entered',
  TRACKING_ETA_UPDATED: 'tracking.eta_updated',
  TRACKING_ROUTE_DEVIATION: 'tracking.route_deviation',

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
  ISSUE_SNOOZED: 'issue.snoozed',
  ISSUE_UNSNOOZED: 'issue.unsnoozed',
  ISSUE_CLOSED: 'issue.closed',
  ISSUE_REOPENED: 'issue.reopened',
  ISSUE_NEEDS_CAPA_MARKED: 'issue.needs_capa_marked',
  ISSUE_LABEL_ADDED: 'issue.label_added',
  ISSUE_LABEL_REMOVED: 'issue.label_removed',

  // Comments
  COMMENT_ADDED: 'comment.added',
  COMMENT_UPDATED: 'comment.updated',
  COMMENT_DELETED: 'comment.deleted',

  // Cold Chain
  COLD_CHAIN_PROFILE_CREATED: 'cold_chain_profile.created',
  COLD_CHAIN_PROFILE_UPDATED: 'cold_chain_profile.updated',
  COLD_CHAIN_PROFILE_DEACTIVATED: 'cold_chain_profile.deactivated',
  COLD_CHAIN_EXCURSION_DETECTED: 'cold_chain.excursion_detected',
  COLD_CHAIN_EXCURSION_ACKNOWLEDGED: 'cold_chain.excursion_acknowledged',
  COLD_CHAIN_EXCURSION_RESOLVED: 'cold_chain.excursion_resolved',
  COLD_CHAIN_DISPOSITION_CHANGED: 'cold_chain.disposition_changed',
  COLD_CHAIN_TEMPERATURE_LOGGED: 'cold_chain.temperature_logged',
  DEVICE_CALIBRATION_RECORDED: 'device.calibration_recorded',
  DEVICE_CALIBRATION_EXPIRED: 'device.calibration_expired',

  // CAPA
  CAPA_CREATED: 'capa.created',
  CAPA_UPDATED: 'capa.updated',
  CAPA_STATUS_CHANGED: 'capa.status_changed',
  CAPA_APPROVED: 'capa.approved',
  CAPA_VERIFIED: 'capa.verified',

  // SLA
  SLA_POLICY_CREATED: 'sla_policy.created',
  SLA_POLICY_UPDATED: 'sla_policy.updated',
  SLA_POLICY_DEACTIVATED: 'sla_policy.deactivated',
  SLA_EVALUATION_CREATED: 'sla.evaluation_created',
  SLA_WARNING: 'sla.warning',
  SLA_BREACHED: 'sla.breached',
  SLA_MET: 'sla.met',

  // Carrier Tracking
  CARRIER_TRACKING_INTEGRATION_CREATED: 'carrier_tracking_integration.created',
  CARRIER_TRACKING_INTEGRATION_UPDATED: 'carrier_tracking_integration.updated',
  CARRIER_TRACKING_INTEGRATION_DELETED: 'carrier_tracking_integration.deleted',
  CARRIER_TRACKING_INTEGRATION_ERROR: 'carrier_tracking_integration.error',
  CARRIER_TRACKING_UPDATE_RECEIVED: 'carrier_tracking.update_received',
  CARRIER_TRACKING_DELIVERED: 'carrier_tracking.delivered',
  CARRIER_TRACKING_EXCEPTION: 'carrier_tracking.exception',

  // Integration
  INTEGRATION_OUTBOUND_SENT: 'integration.outbound_sent',
  INTEGRATION_OUTBOUND_FAILED: 'integration.outbound_failed',
  INTEGRATION_WEBHOOK_RECEIVED: 'integration.webhook_received',

  // EDI 214 (Shipment Status)
  EDI_214_RECEIVED: 'edi_status.received',
  EDI_214_SENT: 'edi_status.sent',

  // EDI — generic events for all transaction types
  EDI_FILE_RECEIVED: 'edi.file_received',
  EDI_FILE_SENT: 'edi.file_sent',
  EDI_FILE_FAILED: 'edi.file_failed',

  // Agent Decisions
  AGENT_DECISION_CREATED: 'agent_decision.created',
  AGENT_DECISION_OUTCOME_RECORDED: 'agent_decision.outcome_recorded',
  AGENT_DECISION_PROMOTED: 'agent_decision.promoted',

  // Financial: Quotes
  QUOTE_CREATED: 'quote.created',
  QUOTE_UPDATED: 'quote.updated',
  QUOTE_SENT: 'quote.sent',
  QUOTE_ACCEPTED: 'quote.accepted',
  QUOTE_DECLINED: 'quote.declined',
  QUOTE_EXPIRED: 'quote.expired',

  // Financial: Charges
  CHARGE_CREATED: 'charge.created',
  CHARGE_APPROVED: 'charge.approved',
  CHARGE_DISPUTED: 'charge.disputed',

  // Financial: Customer Invoices (AR)
  INVOICE_CREATED: 'invoice.created',
  INVOICE_APPROVED: 'invoice.approved',
  INVOICE_SENT: 'invoice.sent',
  INVOICE_PAYMENT_RECEIVED: 'invoice.payment_received',
  INVOICE_PAID: 'invoice.paid',
  INVOICE_OVERDUE: 'invoice.overdue',
  INVOICE_VOIDED: 'invoice.voided',

  // Financial: Carrier Invoices (AP)
  CARRIER_INVOICE_RECEIVED: 'carrier_invoice.received',
  CARRIER_INVOICE_MATCHED: 'carrier_invoice.matched',
  CARRIER_INVOICE_DISCREPANCY: 'carrier_invoice.discrepancy',
  CARRIER_INVOICE_APPROVED: 'carrier_invoice.approved',
  CARRIER_INVOICE_SCHEDULED: 'carrier_invoice.scheduled',
  CARRIER_INVOICE_PAID: 'carrier_invoice.paid',

  // Financial: Queries & Disputes
  FINANCIAL_QUERY_RAISED: 'financial_query.raised',
  FINANCIAL_QUERY_ASSIGNED: 'financial_query.assigned',
  FINANCIAL_QUERY_RESOLVED: 'financial_query.resolved',

  // Financial: Credit Notes
  CREDIT_NOTE_CREATED: 'credit_note.created',
  CREDIT_NOTE_APPLIED: 'credit_note.applied',

  // Financial: Billing Triggers
  SHIPMENT_READY_TO_INVOICE: 'shipment.ready_to_invoice',

  // Quality Centre: CAPA Follow-ups
  CAPA_FOLLOW_UP_CREATED: 'capa.follow_up_created',
  CAPA_FOLLOW_UP_COMPLETED: 'capa.follow_up_completed',
  CAPA_FOLLOW_UP_OVERDUE: 'capa.follow_up_overdue',

  // Quality Centre: SOP / GDP Audits
  SOP_CHECKLIST_CREATED: 'sop_checklist.created',
  SOP_CHECKLIST_UPDATED: 'sop_checklist.updated',
  SOP_AUDIT_STARTED: 'sop_audit.started',
  SOP_AUDIT_COMPLETED: 'sop_audit.completed',
  SOP_AUDIT_FAILED: 'sop_audit.failed',
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
  [EVENT_TYPES.TRACKING_ROUTE_DEVIATION]: 1,
  [EVENT_TYPES.ISSUE_CREATED]: 1,
  [EVENT_TYPES.ISSUE_UPDATED]: 1,
  [EVENT_TYPES.ISSUE_ASSIGNED]: 1,
  [EVENT_TYPES.ISSUE_STATUS_CHANGED]: 1,
  [EVENT_TYPES.ISSUE_ESCALATED]: 1,
  [EVENT_TYPES.ISSUE_RESOLVED]: 1,
  [EVENT_TYPES.ISSUE_SNOOZED]: 1,
  [EVENT_TYPES.ISSUE_UNSNOOZED]: 1,
  [EVENT_TYPES.ISSUE_CLOSED]: 1,
  [EVENT_TYPES.ISSUE_REOPENED]: 1,
  [EVENT_TYPES.ISSUE_NEEDS_CAPA_MARKED]: 1,
  [EVENT_TYPES.ISSUE_LABEL_ADDED]: 1,
  [EVENT_TYPES.ISSUE_LABEL_REMOVED]: 1,
  // Comments
  [EVENT_TYPES.COMMENT_ADDED]: 1,
  [EVENT_TYPES.COMMENT_UPDATED]: 1,
  [EVENT_TYPES.COMMENT_DELETED]: 1,
  [EVENT_TYPES.COLD_CHAIN_PROFILE_CREATED]: 1,
  [EVENT_TYPES.COLD_CHAIN_PROFILE_UPDATED]: 1,
  [EVENT_TYPES.COLD_CHAIN_PROFILE_DEACTIVATED]: 1,
  [EVENT_TYPES.COLD_CHAIN_EXCURSION_DETECTED]: 1,
  [EVENT_TYPES.COLD_CHAIN_EXCURSION_ACKNOWLEDGED]: 1,
  [EVENT_TYPES.COLD_CHAIN_EXCURSION_RESOLVED]: 1,
  [EVENT_TYPES.COLD_CHAIN_DISPOSITION_CHANGED]: 1,
  [EVENT_TYPES.COLD_CHAIN_TEMPERATURE_LOGGED]: 1,
  [EVENT_TYPES.DEVICE_CALIBRATION_RECORDED]: 1,
  [EVENT_TYPES.DEVICE_CALIBRATION_EXPIRED]: 1,
  [EVENT_TYPES.CAPA_CREATED]: 1,
  [EVENT_TYPES.CAPA_UPDATED]: 1,
  [EVENT_TYPES.CAPA_STATUS_CHANGED]: 1,
  [EVENT_TYPES.CAPA_APPROVED]: 1,
  [EVENT_TYPES.CAPA_VERIFIED]: 1,
  [EVENT_TYPES.EDI_214_RECEIVED]: 1,
  [EVENT_TYPES.EDI_214_SENT]: 1,
  [EVENT_TYPES.EDI_FILE_RECEIVED]: 1,
  [EVENT_TYPES.EDI_FILE_SENT]: 1,
  [EVENT_TYPES.EDI_FILE_FAILED]: 1,
  [EVENT_TYPES.SLA_POLICY_CREATED]: 1,
  [EVENT_TYPES.SLA_POLICY_UPDATED]: 1,
  [EVENT_TYPES.SLA_POLICY_DEACTIVATED]: 1,
  [EVENT_TYPES.SLA_EVALUATION_CREATED]: 1,
  [EVENT_TYPES.SLA_WARNING]: 1,
  [EVENT_TYPES.SLA_BREACHED]: 1,
  [EVENT_TYPES.SLA_MET]: 1,
  [EVENT_TYPES.AGENT_DECISION_CREATED]: 1,
  [EVENT_TYPES.AGENT_DECISION_OUTCOME_RECORDED]: 1,
  [EVENT_TYPES.AGENT_DECISION_PROMOTED]: 1,
  // Financial: Quotes
  [EVENT_TYPES.QUOTE_CREATED]: 1,
  [EVENT_TYPES.QUOTE_UPDATED]: 1,
  [EVENT_TYPES.QUOTE_SENT]: 1,
  [EVENT_TYPES.QUOTE_ACCEPTED]: 1,
  [EVENT_TYPES.QUOTE_DECLINED]: 1,
  [EVENT_TYPES.QUOTE_EXPIRED]: 1,
  // Financial: Charges
  [EVENT_TYPES.CHARGE_CREATED]: 1,
  [EVENT_TYPES.CHARGE_APPROVED]: 1,
  [EVENT_TYPES.CHARGE_DISPUTED]: 1,
  [EVENT_TYPES.INVOICE_CREATED]: 1,
  [EVENT_TYPES.INVOICE_APPROVED]: 1,
  [EVENT_TYPES.INVOICE_SENT]: 1,
  [EVENT_TYPES.INVOICE_PAYMENT_RECEIVED]: 1,
  [EVENT_TYPES.INVOICE_PAID]: 1,
  [EVENT_TYPES.INVOICE_OVERDUE]: 1,
  [EVENT_TYPES.INVOICE_VOIDED]: 1,
  [EVENT_TYPES.CARRIER_INVOICE_RECEIVED]: 1,
  [EVENT_TYPES.CARRIER_INVOICE_MATCHED]: 1,
  [EVENT_TYPES.CARRIER_INVOICE_DISCREPANCY]: 1,
  [EVENT_TYPES.CARRIER_INVOICE_APPROVED]: 1,
  [EVENT_TYPES.CARRIER_INVOICE_SCHEDULED]: 1,
  [EVENT_TYPES.CARRIER_INVOICE_PAID]: 1,
  [EVENT_TYPES.FINANCIAL_QUERY_RAISED]: 1,
  [EVENT_TYPES.FINANCIAL_QUERY_ASSIGNED]: 1,
  [EVENT_TYPES.FINANCIAL_QUERY_RESOLVED]: 1,
  [EVENT_TYPES.CREDIT_NOTE_CREATED]: 1,
  [EVENT_TYPES.CREDIT_NOTE_APPLIED]: 1,
  [EVENT_TYPES.SHIPMENT_READY_TO_INVOICE]: 1,
  // Carrier Tracking
  [EVENT_TYPES.CARRIER_TRACKING_INTEGRATION_CREATED]: 1,
  [EVENT_TYPES.CARRIER_TRACKING_INTEGRATION_UPDATED]: 1,
  [EVENT_TYPES.CARRIER_TRACKING_INTEGRATION_DELETED]: 1,
  [EVENT_TYPES.CARRIER_TRACKING_INTEGRATION_ERROR]: 1,
  [EVENT_TYPES.CARRIER_TRACKING_UPDATE_RECEIVED]: 1,
  [EVENT_TYPES.CARRIER_TRACKING_DELIVERED]: 1,
  [EVENT_TYPES.CARRIER_TRACKING_EXCEPTION]: 1,
  // Quality Centre
  [EVENT_TYPES.CAPA_FOLLOW_UP_CREATED]: 1,
  [EVENT_TYPES.CAPA_FOLLOW_UP_COMPLETED]: 1,
  [EVENT_TYPES.CAPA_FOLLOW_UP_OVERDUE]: 1,
  [EVENT_TYPES.SOP_CHECKLIST_CREATED]: 1,
  [EVENT_TYPES.SOP_CHECKLIST_UPDATED]: 1,
  [EVENT_TYPES.SOP_AUDIT_STARTED]: 1,
  [EVENT_TYPES.SOP_AUDIT_COMPLETED]: 1,
  [EVENT_TYPES.SOP_AUDIT_FAILED]: 1,
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

export interface TrackingEtaUpdatedPayload {
  shipmentId: string;
  shipmentReference: string;
  previousEta?: string;
  newEta: string;
  delayMinutes: number;
  severity: 'minor_delay' | 'warning' | 'critical';
  nextStopId?: string;
  nextStopName?: string;
  trafficDelaySeconds?: number;
  provider: string;
}

export interface TrackingRouteDeviationPayload {
  shipmentId: string;
  shipmentReference: string;
  laneId: string;
  laneName: string;
  currentLat: number;
  currentLng: number;
  deviationMeters: number;
  corridorMeters: number;
  severity: 'warning' | 'critical';
  nearestRouteLat: number;
  nearestRouteLng: number;
}

export interface EntityChangedPayload {
  changes?: Record<string, { before: unknown; after: unknown }>;
}

export interface EntityArchivedPayload {
  entityId: string;
  entityType: string;
}

// Cold Chain payloads
export interface ColdChainProfileCreatedPayload {
  name: string;
  minTemperature: number;
  maxTemperature: number;
  alertMinTemperature: number;
  alertMaxTemperature: number;
}

export interface ColdChainExcursionDetectedPayload {
  shipmentId: string;
  shipmentReference: string;
  deviceId?: string;
  excursionType: string;
  severity: string;
  peakValue: number;
  thresholdValue: number;
}

export interface ColdChainDispositionChangedPayload {
  shipmentId: string;
  shipmentReference: string;
  previousDisposition: string;
  newDisposition: string;
  setBy: string;
}

export interface ColdChainTemperatureLoggedPayload {
  shipmentId: string;
  deviceId?: string;
  temperature: number;
  isExcursion: boolean;
  isAlert: boolean;
}

export interface DeviceCalibrationRecordedPayload {
  deviceId: string;
  deviceName: string;
  calibratedBy: string;
  certificateNumber?: string;
  expiresAt: string;
}

export interface CAPACreatedPayload {
  reportNumber: string;
  title: string;
  issueId: string;
  shipmentId?: string;
  priority: string;
}

export interface CAPAStatusChangedPayload {
  reportNumber: string;
  title: string;
  previousStatus: string;
  newStatus: string;
}

// EDI 214 payloads
export interface Edi214ReceivedPayload {
  shipmentId: string;
  shipmentReference: string;
  carrierScac: string;
  proNumber: string;
  statusCode: string;
  statusDescription: string;
  city: string;
  state: string;
  tradingPartnerId?: string;
}

// SLA payloads
export interface SlaPolicyCreatedPayload {
  name: string;
  customerId?: string;
  ruleCount: number;
}

export interface SlaEvaluationCreatedPayload {
  evaluationId: string;
  ruleType: string;
  ruleName: string;
  entityType: string;
  entityId: string;
  entityReference?: string;
  slaDueAt?: string;
}

export interface SlaWarningPayload {
  evaluationId: string;
  ruleType: string;
  ruleName: string;
  entityType: string;
  entityId: string;
  entityReference?: string;
  remainingMinutes: number;
  slaDueAt: string;
}

export interface SlaBreachedPayload {
  evaluationId: string;
  ruleType: string;
  ruleName: string;
  entityType: string;
  entityId: string;
  entityReference?: string;
  customerId?: string;
  breachedAt: string;
  breachDurationMinutes: number;
  issueId?: string;
}

export interface SlaMetPayload {
  evaluationId: string;
  ruleType: string;
  ruleName: string;
  entityType: string;
  entityId: string;
  entityReference?: string;
  metAt: string;
}

export interface Edi214SentPayload {
  shipmentId: string;
  shipmentReference: string;
  tradingPartnerId: string;
  statusCode: string;
}

/** Generic payload for any EDI file received/sent/failed */
export interface EdiFileEventPayload {
  logId: string;
  transactionType: string;
  direction: 'inbound' | 'outbound';
  partnerId?: string;
  partnerName?: string;
  fileName?: string;
  shipmentId?: string;
  shipmentReference?: string;
  orderId?: string;
  tenderId?: string;
  invoiceId?: string;
  status: 'success' | 'error';
  errorMessage?: string;
}

// Agent Decision payloads
export interface AgentDecisionCreatedPayload {
  agentType: string;
  modelProvider?: string;
  modelId?: string;
  triggerType: string;
  triggerEventType?: string;
  entityType?: string;
  entityId?: string;
  summary: string;
  confidence?: number;
  actionType: string;
  actionEntityType?: string;
  actionEntityId?: string;
}

export interface AgentDecisionOutcomeRecordedPayload {
  outcomeStatus: string;
  outcomeNotes?: string;
  reviewedBy?: string;
}

export interface AgentDecisionPromotedPayload {
  agentType: string;
  actionType: string;
}

// ─── Financial Event Payloads ───────────────────────────────────────────────

export interface ChargeCreatedPayload {
  chargeId: string;
  shipmentId?: string;
  orderId?: string;
  chargeType: string;
  chargeCategory: string;
  amountCents: number;
  currency: string;
  source: string;
}

export interface ChargeApprovedPayload {
  chargeId: string;
  shipmentId?: string;
  orderId?: string;
  approvedBy: string;
}

export interface ShipmentReadyToInvoicePayload {
  shipmentId: string;
  shipmentReference: string;
  customerId: string;
}
