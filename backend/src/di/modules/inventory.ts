/**
 * Inventory: stock records, movements, and allocation.
 *
 * Module: inventory. Registered by di/registry.ts, which is the composition root.
 * See .claude/rules/module-boundaries.md for what this module may depend on.
 */

import { PrismaClient } from '@prisma/client';
import { container } from '../container.js';
import { TOKENS } from '../tokens.js';
import { CommandBus } from '../../commands/CommandBus.js';
import type { CommandHandlerDeps } from '../moduleRegistration.js';
import { AdjustInventoryCommandHandler } from '../../commands/warehouse/AdjustInventoryCommand.js';
import { TransferInventoryCommandHandler } from '../../commands/warehouse/TransferInventoryCommand.js';
import { RecordInventoryObservationCommandHandler } from '../../commands/inventory/RecordInventoryObservationCommand.js';
import { ReceiveReturnedStockCommandHandler } from '../../commands/inventory/ReceiveReturnedStockCommand.js';
import { InventoryObservationRepository } from '../../repositories/InventoryObservationRepository.js';

export function registerInventoryDependencies(prisma: PrismaClient): void {
  container.singleton(TOKENS.IInventoryObservationRepository).toFactory(() => {
    return new InventoryObservationRepository(container.resolve(TOKENS.PrismaClient));
  });
}

export function registerInventoryCommandHandlers(bus: CommandBus, deps: CommandHandlerDeps): void {
  const { prisma, eventBus } = deps;
  // Stock adjustment and movement
  bus.register(new AdjustInventoryCommandHandler(prisma, eventBus));
  bus.register(new TransferInventoryCommandHandler(prisma, eventBus));
  // Observations (#233)
  bus.register(new RecordInventoryObservationCommandHandler(prisma, eventBus));
  // Returned goods back into stock, dispatched by the warehouse on rma.restock_requested (#359)
  bus.register(new ReceiveReturnedStockCommandHandler(prisma, eventBus));
}
