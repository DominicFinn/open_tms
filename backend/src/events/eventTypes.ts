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
  SHIPMENT_CUTOFF_AT_RISK: 'shipment.cutoff_at_risk',
  SHIPMENT_CUTOFF_CLEARED: 'shipment.cutoff_cleared',
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

  // Trackable Units (per-handling-unit ops, Phase 2)
  TRACKABLE_UNIT_CREATED: 'trackable_unit.created',
  TRACKABLE_UNIT_UPDATED: 'trackable_unit.updated',
  TRACKABLE_UNIT_DELETED: 'trackable_unit.deleted',
  TRACKABLE_UNIT_BARCODE_GENERATED: 'trackable_unit.barcode_generated',
  TRACKABLE_UNIT_LINE_ITEM_ADDED: 'trackable_unit.line_item_added',
  TRACKABLE_UNIT_LINE_ITEM_MOVED: 'trackable_unit.line_item_moved',
  TRACKABLE_UNITS_MERGED: 'trackable_unit.merged',
  TRACKABLE_UNIT_SPLIT: 'trackable_unit.split',

  // Order Line Items (per-line ops, Phase 4)
  ORDER_LINE_ITEM_CREATED: 'order_line_item.created',
  ORDER_LINE_ITEM_UPDATED: 'order_line_item.updated',
  ORDER_LINE_ITEM_DELETED: 'order_line_item.deleted',

  // Carriers
  CARRIER_CREATED: 'carrier.created',
  CARRIER_UPDATED: 'carrier.updated',
  CARRIER_ARCHIVED: 'carrier.archived',

  // Customers
  CUSTOMER_CREATED: 'customer.created',
  CUSTOMER_UPDATED: 'customer.updated',
  CUSTOMER_ARCHIVED: 'customer.archived',

  // Shipment Types (templates)
  SHIPMENT_TYPE_CREATED: 'shipment_type.created',
  SHIPMENT_TYPE_UPDATED: 'shipment_type.updated',
  SHIPMENT_TYPE_ARCHIVED: 'shipment_type.archived',

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

  // Customer Users (portal)
  CUSTOMER_USER_CREATED: 'customer_user.created',
  CUSTOMER_USER_UPDATED: 'customer_user.updated',
  CUSTOMER_USER_DEACTIVATED: 'customer_user.deactivated',

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

  // Issue label catalogue (the labels themselves, not assignments)
  ISSUE_LABEL_CREATED: 'issue_label.created',
  ISSUE_LABEL_UPDATED: 'issue_label.updated',
  ISSUE_LABEL_DELETED: 'issue_label.deleted',

  // Comments
  COMMENT_ADDED: 'comment.added',
  COMMENT_UPDATED: 'comment.updated',
  COMMENT_DELETED: 'comment.deleted',

  // API keys
  API_KEY_CREATED: 'api_key.created',
  API_KEY_UPDATED: 'api_key.updated',
  API_KEY_REVOKED: 'api_key.revoked',
  API_KEY_DELETED: 'api_key.deleted',

  // Agent config + prompt versioning
  AGENT_CONFIG_CREATED: 'agent_config.created',
  AGENT_CONFIG_UPDATED: 'agent_config.updated',
  AGENT_CONFIG_PROMPT_VERSION_CREATED: 'agent_config.prompt_version_created',
  AGENT_CONFIG_VERSION_ACTIVATED: 'agent_config.version_activated',

  // Automation rules
  AUTOMATION_RULE_CREATED: 'automation_rule.created',
  AUTOMATION_RULE_UPDATED: 'automation_rule.updated',
  AUTOMATION_RULE_TOGGLED: 'automation_rule.toggled',
  AUTOMATION_RULE_DELETED: 'automation_rule.deleted',
  AUTOMATION_RULE_PROMOTED_FROM_DECISION: 'automation_rule.promoted_from_decision',

  // Customer-owned outbound webhooks
  CUSTOMER_WEBHOOK_CREATED: 'customer_webhook.created',
  CUSTOMER_WEBHOOK_UPDATED: 'customer_webhook.updated',
  CUSTOMER_WEBHOOK_DELETED: 'customer_webhook.deleted',
  CUSTOMER_WEBHOOK_SECRET_ROTATED: 'customer_webhook.secret_rotated',

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

  // Brokerage: Margin Alerts
  MARGIN_ALERT: 'margin.alert',

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

  // WMS: Warehouse Zones & Bins
  WAREHOUSE_ZONE_CREATED: 'warehouse_zone.created',
  WAREHOUSE_ZONE_UPDATED: 'warehouse_zone.updated',
  WAREHOUSE_ZONE_ARCHIVED: 'warehouse_zone.archived',
  WAREHOUSE_BIN_CREATED: 'warehouse_bin.created',
  WAREHOUSE_BIN_UPDATED: 'warehouse_bin.updated',
  WAREHOUSE_BIN_ARCHIVED: 'warehouse_bin.archived',
  WAREHOUSE_BIN_BULK_CREATED: 'warehouse_bin.bulk_created',

  // WMS: Receiving
  RECEIVING_APPOINTMENT_CREATED: 'receiving_appointment.created',
  RECEIVING_APPOINTMENT_CHECKED_IN: 'receiving_appointment.checked_in',
  RECEIVING_TASK_CREATED: 'receiving_task.created',
  RECEIVING_TASK_STARTED: 'receiving_task.started',
  RECEIVING_LINE_RECORDED: 'receiving_line.recorded',
  RECEIVING_LINE_INSPECTED: 'receiving_line.inspected',
  RECEIVING_TASK_COMPLETED: 'receiving_task.completed',

  // WMS: Putaway
  PUTAWAY_TASK_CREATED: 'putaway_task.created',
  PUTAWAY_TASK_ASSIGNED: 'putaway_task.assigned',
  PUTAWAY_TASK_STARTED: 'putaway_task.started',
  PUTAWAY_TASK_COMPLETED: 'putaway_task.completed',
  PUTAWAY_TASK_DEVIATION: 'putaway_task.deviation',

  // WMS: Inventory
  INVENTORY_RECEIVED: 'inventory.received',
  INVENTORY_ADJUSTED: 'inventory.adjusted',
  INVENTORY_TRANSFERRED: 'inventory.transferred',

  // WMS: Waves & Picking
  WAVE_CREATED: 'wave.created',
  WAVE_RELEASED: 'wave.released',
  WAVE_COMPLETED: 'wave.completed',
  WAVE_CANCELLED: 'wave.cancelled',
  PICK_TASK_CREATED: 'pick_task.created',
  PICK_TASK_ASSIGNED: 'pick_task.assigned',
  PICK_LINE_COMPLETED: 'pick_line.completed',
  PICK_LINE_SHORT: 'pick_line.short',
  PICK_TASK_COMPLETED: 'pick_task.completed',

  // WMS: Packing & Loading
  PACK_TASK_CREATED: 'pack_task.created',
  PACK_LINE_VERIFIED: 'pack_line.verified',
  PACK_TASK_COMPLETED: 'pack_task.completed',
  PACK_AUDIT_RECORDED: 'pack.audit_recorded',
  PACK_AUDIT_VARIANCE_DETECTED: 'pack.audit_variance_detected',
  STAGING_ASSIGNMENT_CREATED: 'staging_assignment.created',
  LOADING_COMPLETED: 'loading.completed',

  // WMS: Cycle Counting
  CYCLE_COUNT_CREATED: 'cycle_count.created',
  CYCLE_COUNT_STARTED: 'cycle_count.started',
  CYCLE_COUNT_LINE_RECORDED: 'cycle_count.line_recorded',
  CYCLE_COUNT_COMPLETED: 'cycle_count.completed',
  CYCLE_COUNT_VARIANCE_DETECTED: 'cycle_count.variance_detected',

  // WMS: Replenishment
  REPLENISHMENT_RULE_CREATED: 'replenishment_rule.created',
  REPLENISHMENT_RULE_UPDATED: 'replenishment_rule.updated',
  INVENTORY_BELOW_MINIMUM: 'inventory.below_minimum',
  REPLENISHMENT_TRIGGERED: 'replenishment.triggered',

  // WMS: Manifest Ingestion
  MANIFEST_UPLOADED: 'manifest.uploaded',
  MANIFEST_MAPPED: 'manifest.mapped',
  MANIFEST_PROCESSED: 'manifest.processed',
  MANIFEST_FAILED: 'manifest.failed',

  // WMS: Load Planning
  LOAD_PLAN_CREATED: 'load_plan.created',
  LOAD_PLAN_COMPLETED: 'load_plan.completed',
  LOAD_PLAN_BOL_GENERATED: 'load_plan.bol_generated',

  // WMS: Cross-dock
  CROSS_DOCK_SORTED: 'cross_dock.sorted',

  // WMS: Returns / RMA
  RMA_REQUESTED: 'rma.requested',
  RMA_AUTHORIZED: 'rma.authorized',
  RMA_REJECTED: 'rma.rejected',
  RMA_GOODS_RECEIVED: 'rma.goods_received',
  RMA_LINE_INSPECTED: 'rma.line_inspected',
  RMA_DISPOSITION_SET: 'rma.disposition_set',
  RMA_COMPLETED: 'rma.completed',
  RMA_REFUND_ADJUSTED: 'rma.refund_adjusted',
  RMA_RETURN_LABEL_GENERATED: 'rma.return_label_generated',
  RMA_PICKUP_SCHEDULED: 'rma.pickup_scheduled',
  RMA_PICKUP_CANCELLED: 'rma.pickup_cancelled',
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
  [EVENT_TYPES.SHIPMENT_CUTOFF_AT_RISK]: 1,
  [EVENT_TYPES.SHIPMENT_CUTOFF_CLEARED]: 1,
  [EVENT_TYPES.SHIPMENT_STOP_ARRIVED]: 1,
  [EVENT_TYPES.SHIPMENT_STOP_COMPLETED]: 1,
  [EVENT_TYPES.SHIPMENT_ARCHIVED]: 1,
  // v2 added optional `packingSummary` (Phase 1 cartonization). All v2 additions
  // are nullable / optional — v1-style payloads remain valid as long as
  // emitters set the new fields to null when unused (see AcceptQuoteCommand).
  [EVENT_TYPES.ORDER_CREATED]: 2,
  [EVENT_TYPES.ORDER_UPDATED]: 1,
  [EVENT_TYPES.ORDER_STATUS_CHANGED]: 1,
  [EVENT_TYPES.ORDER_DELIVERY_STATUS_CHANGED]: 1,
  [EVENT_TYPES.ORDER_ASSIGNED_TO_SHIPMENT]: 1,
  [EVENT_TYPES.ORDER_EXCEPTION]: 1,
  [EVENT_TYPES.ORDER_EXCEPTION_RESOLVED]: 1,
  [EVENT_TYPES.ORDER_DELIVERED]: 1,
  [EVENT_TYPES.ORDER_ARCHIVED]: 1,
  [EVENT_TYPES.TRACKABLE_UNIT_CREATED]: 1,
  [EVENT_TYPES.TRACKABLE_UNIT_UPDATED]: 1,
  [EVENT_TYPES.TRACKABLE_UNIT_DELETED]: 1,
  [EVENT_TYPES.TRACKABLE_UNIT_BARCODE_GENERATED]: 1,
  [EVENT_TYPES.TRACKABLE_UNIT_LINE_ITEM_ADDED]: 1,
  [EVENT_TYPES.TRACKABLE_UNIT_LINE_ITEM_MOVED]: 1,
  [EVENT_TYPES.TRACKABLE_UNITS_MERGED]: 1,
  [EVENT_TYPES.TRACKABLE_UNIT_SPLIT]: 1,
  [EVENT_TYPES.ORDER_LINE_ITEM_CREATED]: 1,
  [EVENT_TYPES.ORDER_LINE_ITEM_UPDATED]: 1,
  [EVENT_TYPES.ORDER_LINE_ITEM_DELETED]: 1,
  [EVENT_TYPES.CARRIER_CREATED]: 1,
  [EVENT_TYPES.CARRIER_UPDATED]: 1,
  [EVENT_TYPES.CARRIER_ARCHIVED]: 1,
  [EVENT_TYPES.CUSTOMER_CREATED]: 1,
  [EVENT_TYPES.CUSTOMER_UPDATED]: 1,
  [EVENT_TYPES.CUSTOMER_ARCHIVED]: 1,
  [EVENT_TYPES.SHIPMENT_TYPE_CREATED]: 1,
  [EVENT_TYPES.SHIPMENT_TYPE_UPDATED]: 1,
  [EVENT_TYPES.SHIPMENT_TYPE_ARCHIVED]: 1,
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
  [EVENT_TYPES.ISSUE_LABEL_CREATED]: 1,
  [EVENT_TYPES.ISSUE_LABEL_UPDATED]: 1,
  [EVENT_TYPES.ISSUE_LABEL_DELETED]: 1,
  // Comments
  [EVENT_TYPES.API_KEY_CREATED]: 1,
  [EVENT_TYPES.API_KEY_UPDATED]: 1,
  [EVENT_TYPES.API_KEY_REVOKED]: 1,
  [EVENT_TYPES.API_KEY_DELETED]: 1,
  [EVENT_TYPES.AGENT_CONFIG_CREATED]: 1,
  [EVENT_TYPES.AGENT_CONFIG_UPDATED]: 1,
  [EVENT_TYPES.AGENT_CONFIG_PROMPT_VERSION_CREATED]: 1,
  [EVENT_TYPES.AGENT_CONFIG_VERSION_ACTIVATED]: 1,
  [EVENT_TYPES.AUTOMATION_RULE_CREATED]: 1,
  [EVENT_TYPES.AUTOMATION_RULE_UPDATED]: 1,
  [EVENT_TYPES.AUTOMATION_RULE_TOGGLED]: 1,
  [EVENT_TYPES.AUTOMATION_RULE_DELETED]: 1,
  [EVENT_TYPES.AUTOMATION_RULE_PROMOTED_FROM_DECISION]: 1,
  [EVENT_TYPES.CUSTOMER_WEBHOOK_CREATED]: 1,
  [EVENT_TYPES.CUSTOMER_WEBHOOK_UPDATED]: 1,
  [EVENT_TYPES.CUSTOMER_WEBHOOK_DELETED]: 1,
  [EVENT_TYPES.CUSTOMER_WEBHOOK_SECRET_ROTATED]: 1,
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
  [EVENT_TYPES.MARGIN_ALERT]: 1,
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

  // WMS
  [EVENT_TYPES.WAREHOUSE_ZONE_CREATED]: 1,
  [EVENT_TYPES.WAREHOUSE_ZONE_UPDATED]: 1,
  [EVENT_TYPES.WAREHOUSE_ZONE_ARCHIVED]: 1,
  [EVENT_TYPES.WAREHOUSE_BIN_CREATED]: 1,
  [EVENT_TYPES.WAREHOUSE_BIN_UPDATED]: 1,
  [EVENT_TYPES.WAREHOUSE_BIN_ARCHIVED]: 1,
  [EVENT_TYPES.WAREHOUSE_BIN_BULK_CREATED]: 1,
  [EVENT_TYPES.RECEIVING_APPOINTMENT_CREATED]: 1,
  [EVENT_TYPES.RECEIVING_APPOINTMENT_CHECKED_IN]: 1,
  [EVENT_TYPES.RECEIVING_TASK_CREATED]: 1,
  [EVENT_TYPES.RECEIVING_TASK_STARTED]: 1,
  [EVENT_TYPES.RECEIVING_LINE_RECORDED]: 1,
  [EVENT_TYPES.RECEIVING_LINE_INSPECTED]: 1,
  [EVENT_TYPES.RECEIVING_TASK_COMPLETED]: 1,
  [EVENT_TYPES.PUTAWAY_TASK_CREATED]: 1,
  [EVENT_TYPES.PUTAWAY_TASK_ASSIGNED]: 1,
  [EVENT_TYPES.PUTAWAY_TASK_STARTED]: 1,
  [EVENT_TYPES.PUTAWAY_TASK_COMPLETED]: 1,
  [EVENT_TYPES.PUTAWAY_TASK_DEVIATION]: 1,
  [EVENT_TYPES.INVENTORY_RECEIVED]: 1,
  [EVENT_TYPES.INVENTORY_ADJUSTED]: 1,
  [EVENT_TYPES.INVENTORY_TRANSFERRED]: 1,
  [EVENT_TYPES.WAVE_CREATED]: 1,
  [EVENT_TYPES.WAVE_RELEASED]: 1,
  [EVENT_TYPES.WAVE_COMPLETED]: 1,
  [EVENT_TYPES.WAVE_CANCELLED]: 1,
  [EVENT_TYPES.PICK_TASK_CREATED]: 1,
  [EVENT_TYPES.PICK_TASK_ASSIGNED]: 1,
  [EVENT_TYPES.PICK_LINE_COMPLETED]: 1,
  [EVENT_TYPES.PICK_LINE_SHORT]: 1,
  [EVENT_TYPES.PICK_TASK_COMPLETED]: 1,
  [EVENT_TYPES.PACK_TASK_CREATED]: 1,
  [EVENT_TYPES.PACK_LINE_VERIFIED]: 1,
  [EVENT_TYPES.PACK_AUDIT_RECORDED]: 1,
  [EVENT_TYPES.PACK_AUDIT_VARIANCE_DETECTED]: 1,
  [EVENT_TYPES.PACK_TASK_COMPLETED]: 1,
  [EVENT_TYPES.STAGING_ASSIGNMENT_CREATED]: 1,
  [EVENT_TYPES.LOADING_COMPLETED]: 1,
  [EVENT_TYPES.CYCLE_COUNT_CREATED]: 1,
  [EVENT_TYPES.CYCLE_COUNT_STARTED]: 1,
  [EVENT_TYPES.CYCLE_COUNT_LINE_RECORDED]: 1,
  [EVENT_TYPES.CYCLE_COUNT_COMPLETED]: 1,
  [EVENT_TYPES.CYCLE_COUNT_VARIANCE_DETECTED]: 1,
  [EVENT_TYPES.REPLENISHMENT_RULE_CREATED]: 1,
  [EVENT_TYPES.REPLENISHMENT_RULE_UPDATED]: 1,
  [EVENT_TYPES.INVENTORY_BELOW_MINIMUM]: 1,
  [EVENT_TYPES.REPLENISHMENT_TRIGGERED]: 1,
  [EVENT_TYPES.MANIFEST_UPLOADED]: 1,
  [EVENT_TYPES.MANIFEST_MAPPED]: 1,
  [EVENT_TYPES.MANIFEST_PROCESSED]: 1,
  [EVENT_TYPES.MANIFEST_FAILED]: 1,
  [EVENT_TYPES.LOAD_PLAN_CREATED]: 1,
  [EVENT_TYPES.LOAD_PLAN_COMPLETED]: 1,
  [EVENT_TYPES.LOAD_PLAN_BOL_GENERATED]: 1,
  [EVENT_TYPES.CROSS_DOCK_SORTED]: 1,
  [EVENT_TYPES.RMA_REQUESTED]: 1,
  [EVENT_TYPES.RMA_AUTHORIZED]: 1,
  [EVENT_TYPES.RMA_REJECTED]: 1,
  [EVENT_TYPES.RMA_GOODS_RECEIVED]: 1,
  [EVENT_TYPES.RMA_LINE_INSPECTED]: 1,
  [EVENT_TYPES.RMA_DISPOSITION_SET]: 1,
  [EVENT_TYPES.RMA_COMPLETED]: 1,
  [EVENT_TYPES.RMA_REFUND_ADJUSTED]: 1,
  [EVENT_TYPES.RMA_RETURN_LABEL_GENERATED]: 1,
  [EVENT_TYPES.RMA_PICKUP_SCHEDULED]: 1,
  [EVENT_TYPES.RMA_PICKUP_CANCELLED]: 1,
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

export interface MarginAlertPayload {
  shipmentId: string;
  shipmentReference: string;
  revenueCents: number;
  costCents: number;
  marginCents: number;
  marginPercent: number;
  thresholdPercent: number;
}
