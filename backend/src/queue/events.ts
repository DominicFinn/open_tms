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

export interface WebhookEvent {
  webhookLogId: string;
  rawPayload: any;
  /** Null when the request was authenticated by signature rather than an API key. */
  apiKeyId: string | null;
  ipAddress: string;
  /**
   * The tenant resolved from the request's credential. Optional only because messages queued
   * before #303 lack it; the worker derives it from the API key or dead-letters the message.
   */
  orgId?: string;
}
