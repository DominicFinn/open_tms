/**
 * CQRS Command types.
 *
 * Commands represent intentions to change state. Each command is handled by
 * exactly one handler, which executes the write within a transaction and
 * collects domain events to publish after commit.
 */

import { DomainEvent } from '../events/DomainEvent.js';

/** A command is an intent to change state, dispatched synchronously. */
export interface Command<TPayload = unknown> {
  /** Command name in entity.verb format, e.g. "order.create" */
  readonly type: string;
  /** Organization scope */
  readonly orgId: string;
  /** User or system principal that issued the command */
  readonly actorId: string | null;
  /** Command-specific data */
  readonly payload: TPayload;
  /** Tracing metadata */
  readonly metadata: CommandMetadata;
}

export interface CommandMetadata {
  /** Correlation ID for tracing a chain of commands/events */
  correlationId: string;
  /** Where the command originated: "api", "worker", "webhook", "system" */
  source: string;
}

/** The result returned after a command executes. */
export interface CommandResult<T = unknown> {
  success: boolean;
  data?: T;
  /** Domain events that were published as a result of this command */
  events: DomainEvent[];
  error?: string;
}

/** Interface that all command handlers implement. */
export interface ICommandHandler<TPayload = unknown, TResult = unknown> {
  readonly commandType: string;
  execute(command: Command<TPayload>): Promise<CommandResult<TResult>>;
}
