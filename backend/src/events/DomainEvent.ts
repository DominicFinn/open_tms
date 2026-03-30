/**
 * Domain Event — the core envelope that wraps every event in the system.
 *
 * Every meaningful state change (shipment created, order delivered, etc.)
 * emits a DomainEvent. Handlers subscribe to event types and take action
 * (send email, create notification, fire webhook, write audit log, etc.).
 */

export interface DomainEvent<T = unknown> {
  /** Unique event ID (UUID v4) */
  id: string;

  /** Event type in entity.action format, e.g. "shipment.status_changed" */
  type: string;

  /** ISO-8601 timestamp of when the event occurred */
  timestamp: string;

  /** Organization ID — scopes events for multi-tenancy */
  orgId: string;

  /** User or system principal that caused the event. Null for system-generated events. */
  actorId: string | null;

  /** The entity type that changed: "shipment", "order", "carrier", etc. */
  entityType: string;

  /** Primary key of the changed entity */
  entityId: string;

  /** Event-specific payload */
  payload: T;

  /** Extensible metadata */
  metadata: EventMetadata;
}

export interface EventMetadata {
  /** Correlation ID for tracing a chain of events back to a single user action */
  correlationId: string;
  /** Causation ID: the ID of the event that directly caused this one */
  causationId?: string;
  /** Source: "api", "worker", "webhook", "system" */
  source: string;
  /** Schema version for forward-compatible evolution */
  schemaVersion: number;
}
