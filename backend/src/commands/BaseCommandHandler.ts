/**
 * BaseCommandHandler — abstract base for command handlers.
 *
 * Provides:
 * 1. Prisma transaction wrapping (every command = one atomic unit of work)
 * 2. Event collection during execution via emit()
 * 3. Event publishing AFTER transaction commits (no phantom events)
 * 4. Consistent error handling that returns CommandResult
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { DomainEvent } from '../events/DomainEvent.js';
import { IEventBus } from '../events/IEventBus.js';
import { createEvent, CreateEventParams } from '../events/createEvent.js';
import { Command, CommandResult, ICommandHandler } from './types.js';

/** Prisma transaction client type — the `tx` parameter inside $transaction */
export type TransactionClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

/** Callback to collect events during handler execution */
export type EmitFn = (event: DomainEvent) => void;

export abstract class BaseCommandHandler<TPayload = unknown, TResult = unknown>
  implements ICommandHandler<TPayload, TResult>
{
  abstract readonly commandType: string;

  constructor(
    protected prisma: PrismaClient,
    protected eventBus: IEventBus
  ) {}

  async execute(command: Command<TPayload>): Promise<CommandResult<TResult>> {
    const events: DomainEvent[] = [];
    const emit: EmitFn = (event) => events.push(event);

    try {
      const data = await this.prisma.$transaction(async (tx) => {
        return this.handle(command, tx, emit);
      });

      // Publish events AFTER transaction commits successfully
      for (const event of events) {
        try {
          await this.eventBus.publish(event);
        } catch (err) {
          // Log but don't fail the command — event is in the collected array
          // and the DomainEventLog write inside publish will retry via pg-boss
          console.error(`[CommandHandler] Failed to publish event ${event.type}: ${(err as Error).message}`);
        }
      }

      return { success: true, data, events };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, events: [] };
    }
  }

  /**
   * Implement this in each command handler.
   *
   * @param command - The command being executed
   * @param tx - Prisma transaction client (use this for ALL db operations)
   * @param emit - Call to collect a domain event (published after tx commits)
   */
  protected abstract handle(
    command: Command<TPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<TResult>;

  /**
   * Helper to create a domain event with command metadata carried forward.
   */
  protected createEvent<T>(command: Command, params: Omit<CreateEventParams<T>, 'orgId' | 'actorId' | 'correlationId' | 'source'> & Partial<CreateEventParams<T>>): DomainEvent<T> {
    return createEvent({
      ...params,
      orgId: params.orgId ?? command.orgId,
      actorId: params.actorId ?? command.actorId,
      correlationId: command.metadata.correlationId,
      source: params.source ?? command.metadata.source,
    });
  }
}
