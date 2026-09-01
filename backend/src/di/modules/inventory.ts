/**
 * Inventory: stock records, movements, and allocation.
 *
 * Module: inventory. Registered by di/registry.ts, which is the composition root.
 * See .claude/rules/module-boundaries.md for what this module may depend on.
 */

import { PrismaClient } from '@prisma/client';
import { CommandBus } from '../../commands/CommandBus.js';
import type { CommandHandlerDeps } from '../moduleRegistration.js';
import { AdjustInventoryCommandHandler } from '../../commands/warehouse/AdjustInventoryCommand.js';
import { TransferInventoryCommandHandler } from '../../commands/warehouse/TransferInventoryCommand.js';

export function registerInventoryDependencies(prisma: PrismaClient): void {
  // No module-level bindings yet.
}

export function registerInventoryCommandHandlers(bus: CommandBus, deps: CommandHandlerDeps): void {
  const { prisma, eventBus } = deps;
  // Stock adjustment and movement
  bus.register(new AdjustInventoryCommandHandler(prisma, eventBus));
  bus.register(new TransferInventoryCommandHandler(prisma, eventBus));
}
