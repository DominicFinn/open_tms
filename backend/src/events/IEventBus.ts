/**
 * IEventBus — the core abstraction for publishing and subscribing to domain events.
 *
 * Implementation: PgBossEventBus (fans out events to per-handler pg-boss queues).
 * Future: Could be swapped for CloudEventBus (SNS/Pub-Sub) via DI.
 */

import { DomainEvent } from './DomainEvent.js';

export type EventHandler = (event: DomainEvent) => Promise<void>;

export interface SubscribeOptions {
  /** pg-boss concurrency for this handler's queue. Default: 2 */
  concurrency?: number;
  /** Priority: higher number = processed first. Default: 0 */
  priority?: number;
  /** Retry limit override. Default: 3 */
  retryLimit?: number;
  /** Job expiry in seconds. Default: 900 (15 min) */
  expireInSeconds?: number;
}

export interface IEventBus {
  /**
   * Publish a domain event.
   * Persists to the event store and fans out to all matching handler queues.
   */
  publish<T>(event: DomainEvent<T>): Promise<void>;

  /**
   * Publish multiple events (e.g., within a single service action).
   */
  publishBatch(events: DomainEvent[]): Promise<void>;

  /**
   * Register a named handler for a set of event type patterns.
   * Each handler gets its own pg-boss queue (fan-out).
   * Patterns support wildcards: "shipment.*", "order.delivered", "*"
   */
  subscribe(
    handlerName: string,
    eventPatterns: string[],
    handler: EventHandler,
    options?: SubscribeOptions
  ): Promise<void>;

  /** Start processing (called by worker process) */
  start(): Promise<void>;

  /** Graceful stop */
  stop(): Promise<void>;
}
