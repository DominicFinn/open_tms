/**
 * Helper for creating domain events with consistent structure.
 *
 * Usage:
 *   const event = createEvent({
 *     type: EVENT_TYPES.SHIPMENT_STATUS_CHANGED,
 *     orgId: org.id,
 *     actorId: userId,
 *     entityType: 'shipment',
 *     entityId: shipment.id,
 *     payload: { previousStatus: 'draft', newStatus: 'in_transit', shipmentReference: 'SH-001' },
 *     source: 'api',
 *   });
 *   await eventBus.publish(event);
 */

import { randomUUID } from 'crypto';
import { DomainEvent, EventMetadata } from './DomainEvent.js';

export interface CreateEventParams<T> {
  type: string;
  orgId: string;
  actorId?: string | null;
  entityType: string;
  entityId: string;
  payload: T;
  source?: string;
  correlationId?: string;
  causationId?: string;
}

export function createEvent<T>(params: CreateEventParams<T>): DomainEvent<T> {
  const id = randomUUID();
  return {
    id,
    type: params.type,
    timestamp: new Date().toISOString(),
    orgId: params.orgId,
    actorId: params.actorId ?? null,
    entityType: params.entityType,
    entityId: params.entityId,
    payload: params.payload,
    metadata: {
      correlationId: params.correlationId ?? id,
      causationId: params.causationId,
      source: params.source ?? 'api',
      schemaVersion: 1,
    },
  };
}
