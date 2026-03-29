export const QUEUES = {
  OUTBOUND_CARRIER: 'outbound.carrier',
  OUTBOUND_TRACKING: 'outbound.tracking',
  INBOUND_WEBHOOK: 'inbound.webhook',
} as const;

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
