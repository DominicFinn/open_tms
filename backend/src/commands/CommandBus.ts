/**
 * CommandBus — registers command handlers and dispatches commands to them.
 *
 * Each command type maps to exactly one handler (unlike events which fan out).
 * Commands are dispatched synchronously — the caller gets a result.
 */

import { Command, CommandResult, ICommandHandler } from './types.js';

export interface ICommandBus {
  /** Register a handler for a command type. One handler per type. */
  register(handler: ICommandHandler): void;

  /** Dispatch a command to its handler. Throws if no handler is registered. */
  dispatch<TPayload, TResult>(command: Command<TPayload>): Promise<CommandResult<TResult>>;
}

export class CommandBus implements ICommandBus {
  private handlers = new Map<string, ICommandHandler>();

  register(handler: ICommandHandler): void {
    if (this.handlers.has(handler.commandType)) {
      throw new Error(`Handler already registered for command type: ${handler.commandType}`);
    }
    this.handlers.set(handler.commandType, handler);
  }

  async dispatch<TPayload, TResult>(command: Command<TPayload>): Promise<CommandResult<TResult>> {
    const handler = this.handlers.get(command.type);
    if (!handler) {
      throw new Error(`No handler registered for command type: ${command.type}`);
    }
    return handler.execute(command) as Promise<CommandResult<TResult>>;
  }
}
