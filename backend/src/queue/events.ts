export const QUEUES = {
  OUTBOUND_CARRIER: 'outbound.carrier',
  OUTBOUND_TRACKING: 'outbound.tracking',
  INBOUND_WEBHOOK: 'inbound.webhook',
  DOCUMENT_GENERATION: 'document.generation',
} as const;

export type DocumentGenerationKind = 'bol' | 'labels' | 'customs' | 'rate_confirmation';

export interface DocumentGenerationJob {
  kind: DocumentGenerationKind;
  /** shipmentId for bol/customs/rate_confirmation; orderId for labels */
  entityId: string;
  templateId?: string | null;
  /** Set by the route. Used by clients to query GeneratedDocument afterward. */
  correlationId: string;
  requestedBy?: string | null;
  orgId?: string | null;
}

export interface ShipmentEvent {
  shipmentId: string;
  eventType: 'created' | 'updated' | 'status_changed' | 'delivered';
  shipmentReference: string;
  carrierId?: string;
}

export interface WebhookEvent {
  webhookLogId: string;
  rawPayload: any;
  apiKeyId: string;
  ipAddress: string;
}
