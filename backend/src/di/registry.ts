/**
 * Dependency Injection Registry — the composition root.
 *
 * This file wires the modules together and does nothing else. Each module owns its own
 * repositories, services and command handlers in di/modules/<module>.ts, and this is the one
 * place allowed to know about all of them at once. See .claude/rules/module-boundaries.md.
 *
 * Registration order does not carry meaning: every binding is a lazy factory, resolved on first
 * use. Order does matter for the wiring step at the end, which resolves instances.
 */

import { PrismaClient } from '@prisma/client';
import { container } from './container.js';
import { TOKENS } from './tokens.js';
import { CommandBus } from '../commands/CommandBus.js';
import { PgBossEventBus } from '../events/PgBossEventBus.js';
import type { IQueueAdapter } from '../queue/IQueueAdapter.js';
import type { CommandHandlerDeps } from './moduleRegistration.js';
import { registerCoreDependencies, registerCoreCommandHandlers } from './modules/core.js';
import { registerFinanceDependencies, registerFinanceCommandHandlers } from './modules/finance.js';
import { registerInventoryDependencies, registerInventoryCommandHandlers } from './modules/inventory.js';
import { registerQualityDependencies, registerQualityCommandHandlers } from './modules/quality.js';
import { registerTmsDependencies, registerTmsCommandHandlers, wireTmsDependencies } from './modules/tms.js';
import { registerWmsDependencies, registerWmsCommandHandlers } from './modules/wms.js';

export function registerDependencies(prisma: PrismaClient): void {
  container.singleton(TOKENS.PrismaClient).toFactory(() => prisma);

  registerCoreDependencies(prisma);
  registerFinanceDependencies(prisma);
  registerInventoryDependencies(prisma);
  registerQualityDependencies(prisma);
  registerTmsDependencies(prisma);
  registerWmsDependencies(prisma);

  container.singleton(TOKENS.ICommandBus).toFactory(() => {
    const bus = new CommandBus();
    const deps: CommandHandlerDeps = {
      prisma: container.resolve<PrismaClient>(TOKENS.PrismaClient),
      eventBus: container.resolve<PgBossEventBus>(TOKENS.IEventBus),
      queue: container.resolve<IQueueAdapter>(TOKENS.IQueueAdapter),
    };

    registerCoreCommandHandlers(bus, deps);
    registerFinanceCommandHandlers(bus, deps);
    registerInventoryCommandHandlers(bus, deps);
    registerQualityCommandHandlers(bus, deps);
    registerTmsCommandHandlers(bus, deps);
    registerWmsCommandHandlers(bus, deps);

    return bus;
  });

  wireTmsDependencies(prisma);
}
