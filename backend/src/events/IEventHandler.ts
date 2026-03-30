/**
 * IEventHandler — interface for event handler implementations.
 *
 * Each handler has a unique name (used as the pg-boss queue suffix: evt.<name>),
 * a set of event patterns it subscribes to, and a handle() method.
 */

import { DomainEvent } from './DomainEvent.js';
import { SubscribeOptions } from './IEventBus.js';

export interface IEventHandler {
  /** Unique name, used as the pg-boss queue suffix: evt.<name> */
  readonly name: string;

  /** Event type patterns this handler subscribes to. Supports wildcards: "shipment.*", "*" */
  readonly eventPatterns: string[];

  /** Processing options (concurrency, priority, retry) */
  readonly options?: SubscribeOptions;

  /** Handle a single event */
  handle(event: DomainEvent): Promise<void>;
}
