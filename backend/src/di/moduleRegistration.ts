import type { PrismaClient } from '@prisma/client';
import type { PgBossEventBus } from '../events/PgBossEventBus.js';
import type { IQueueAdapter } from '../queue/IQueueAdapter.js';

/**
 * What a module's command handlers are given when the composition root builds the CommandBus.
 * Anything beyond these three is resolved from the container by the module itself.
 */
export interface CommandHandlerDeps {
  readonly prisma: PrismaClient;
  // Concrete rather than IEventBus because BaseCommandHandler takes the concrete bus. Narrowing
  // that to the interface is a separate change with a wide blast radius.
  readonly eventBus: PgBossEventBus;
  readonly queue: IQueueAdapter;
}
