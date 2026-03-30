/**
 * AuditHandler — subscribes to ALL events (*) and writes an immutable audit record.
 *
 * This is the first and most critical handler. It runs at highest priority
 * because audit logging is compliance-critical and must never be delayed.
 *
 * Note: DomainEventLog already stores the event on publish(). This handler
 * could enrich an additional AuditLog model with human-readable descriptions,
 * but for now it logs to console and validates the pipeline end-to-end.
 * When a dedicated AuditLog model is added, this handler writes to it.
 */

import { DomainEvent } from '../DomainEvent.js';
import { IEventHandler } from '../IEventHandler.js';
import { SubscribeOptions } from '../IEventBus.js';

export class AuditHandler implements IEventHandler {
  readonly name = 'audit';
  readonly eventPatterns = ['*'];
  readonly options: SubscribeOptions = {
    concurrency: 5,
    priority: 10,
    retryLimit: 5,
    expireInSeconds: 300,
  };

  async handle(event: DomainEvent): Promise<void> {
    console.log(
      `[Audit] ${event.type} | entity=${event.entityType}:${event.entityId} | org=${event.orgId} | actor=${event.actorId || 'system'} | ${event.timestamp}`
    );
  }
}
