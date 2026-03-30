/**
 * PgBossEventBus — publishes domain events to an immutable event store
 * and fans them out to per-handler pg-boss queues.
 *
 * Fan-out: one published event may be delivered to multiple handler queues
 * (e.g., evt.audit, evt.notification.email, evt.webhook) independently.
 * Each handler queue has its own retry policy and concurrency.
 */

import { PrismaClient } from '@prisma/client';
import { DomainEvent } from './DomainEvent.js';
import { IEventBus, EventHandler, SubscribeOptions } from './IEventBus.js';
import { IQueueAdapter, QueueMessage } from '../queue/IQueueAdapter.js';

const QUEUE_PREFIX = 'evt.';

interface HandlerRegistration {
  patterns: string[];
  handler: EventHandler;
  options: SubscribeOptions;
}

export class PgBossEventBus implements IEventBus {
  private registry = new Map<string, HandlerRegistration>();
  private started = false;

  constructor(
    private prisma: PrismaClient,
    private queue: IQueueAdapter
  ) {}

  async publish<T>(event: DomainEvent<T>): Promise<void> {
    // 1. Persist to immutable event store
    await this.prisma.domainEventLog.create({
      data: {
        id: event.id,
        type: event.type,
        timestamp: event.timestamp,
        orgId: event.orgId,
        actorId: event.actorId,
        entityType: event.entityType,
        entityId: event.entityId,
        payload: event.payload as any,
        metadata: event.metadata as any,
      },
    });

    // 2. Fan out to matching handler queues
    const fanOutPromises: Promise<string>[] = [];

    for (const [handlerName, registration] of this.registry) {
      if (this.matchesAny(event.type, registration.patterns)) {
        const queueName = QUEUE_PREFIX + handlerName;
        const message: QueueMessage = {
          type: event.type,
          payload: event,
          metadata: {
            timestamp: event.timestamp,
            sourceId: event.id,
          },
        };
        fanOutPromises.push(this.queue.publish(queueName, message));
      }
    }

    if (fanOutPromises.length > 0) {
      await Promise.all(fanOutPromises);
    }
  }

  async publishBatch(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }

  async subscribe(
    handlerName: string,
    eventPatterns: string[],
    handler: EventHandler,
    options: SubscribeOptions = {}
  ): Promise<void> {
    this.registry.set(handlerName, {
      patterns: eventPatterns,
      handler,
      options,
    });

    // If already started (worker process), immediately wire up the queue subscription
    if (this.started) {
      await this.wireHandler(handlerName, handler, options);
    }
  }

  async start(): Promise<void> {
    // Wire up all registered handlers to their pg-boss queues
    for (const [handlerName, reg] of this.registry) {
      await this.wireHandler(handlerName, reg.handler, reg.options);
    }
    this.started = true;
    console.log(`[EventBus] Started with ${this.registry.size} handler(s)`);
  }

  async stop(): Promise<void> {
    this.started = false;
    console.log('[EventBus] Stopped');
  }

  /**
   * Wire a handler to its pg-boss queue.
   * The handler receives the DomainEvent from the queue message payload.
   */
  private async wireHandler(
    handlerName: string,
    handler: EventHandler,
    options: SubscribeOptions
  ): Promise<void> {
    const queueName = QUEUE_PREFIX + handlerName;

    await this.queue.subscribe(queueName, async (message: QueueMessage) => {
      const event = message.payload as DomainEvent;
      await handler(event);
    });

    console.log(`[EventBus] Handler "${handlerName}" subscribed to queue "${queueName}"`);
  }

  /**
   * Check if an event type matches any of the given patterns.
   * Supports: exact match ("shipment.created"), prefix wildcard ("shipment.*"), catch-all ("*").
   */
  private matchesAny(eventType: string, patterns: string[]): boolean {
    return patterns.some((pattern) => {
      if (pattern === '*') return true;
      if (pattern.endsWith('.*')) {
        const prefix = pattern.slice(0, -1); // "shipment."
        return eventType.startsWith(prefix);
      }
      return eventType === pattern;
    });
  }
}
