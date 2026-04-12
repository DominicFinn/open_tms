/**
 * BaseCommandHandler — abstract base for command handlers.
 *
 * Provides:
 * 1. Prisma transaction wrapping (every command = one atomic unit of work)
 * 2. Event collection during execution via emit()
 * 3. Outbox pattern: events persisted to DomainEventLog INSIDE the transaction
 * 4. Fan-out to handler queues AFTER transaction commits
 * 5. Idempotency check via correlationId
 * 6. Consistent error handling that returns CommandResult
 */

import { PrismaClient } from '@prisma/client';
import { DomainEvent } from '../events/DomainEvent.js';
import { PgBossEventBus } from '../events/PgBossEventBus.js';
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
    protected eventBus: PgBossEventBus
  ) {}

  async execute(command: Command<TPayload>): Promise<CommandResult<TResult>> {
    const events: DomainEvent[] = [];
    const emit: EmitFn = (event) => events.push(event);

    // Idempotency check: if we already processed this correlationId for this
    // command type, return early to prevent duplicate writes
    if (command.metadata.idempotencyKey) {
      const existing = await this.prisma.domainEventLog.findFirst({
        where: {
          metadata: {
            path: ['correlationId'],
            equals: command.metadata.idempotencyKey,
          },
        },
        select: { id: true },
      });
      if (existing) {
        return { success: true, data: undefined as TResult, events: [], idempotent: true };
      }
    }

    try {
      const data = await this.prisma.$transaction(async (tx: TransactionClient) => {
        // Execute the command handler logic
        const result = await this.handle(command, tx, emit);

        // Outbox: persist all emitted events INSIDE the transaction
        // This guarantees events are never lost — if the tx commits,
        // events are in DomainEventLog. If it rolls back, they're not.
        for (const event of events) {
          await this.eventBus.persist(event, tx);
        }

        return result;
      });

      // Fan out events to handler queues AFTER transaction commits.
      // If fan-out fails, events are still safely in DomainEventLog
      // and can be replayed later.
      for (const event of events) {
        try {
          await this.eventBus.fanOut(event);
        } catch (err) {
          console.error(
            `[CommandHandler] Fan-out failed for event ${event.type} (${event.id}), ` +
            `event is persisted and will be picked up on replay: ${(err as Error).message}`
          );
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
