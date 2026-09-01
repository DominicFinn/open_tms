/**
 * Quality: CAPA reports and SOP audits.
 *
 * Module: quality. Registered by di/registry.ts, which is the composition root.
 * See .claude/rules/module-boundaries.md for what this module may depend on.
 */

import { PrismaClient } from '@prisma/client';
import { CommandBus } from '../../commands/CommandBus.js';
import type { CommandHandlerDeps } from '../moduleRegistration.js';
import { CreateCAPACommandHandler } from '../../commands/capa/CreateCAPACommand.js';
import { UpdateCAPACommandHandler } from '../../commands/capa/UpdateCAPACommand.js';
import { CreateCAPAFollowUpCommandHandler } from '../../commands/capaFollowUps/CreateCAPAFollowUpCommand.js';
import { CompleteCAPAFollowUpCommandHandler } from '../../commands/capaFollowUps/CompleteCAPAFollowUpCommand.js';
import { CreateSOPChecklistCommandHandler } from '../../commands/sopChecklists/CreateSOPChecklistCommand.js';
import { StartSOPAuditCommandHandler } from '../../commands/sopChecklists/StartSOPAuditCommand.js';
import { CompleteSOPAuditCommandHandler } from '../../commands/sopChecklists/CompleteSOPAuditCommand.js';

export function registerQualityDependencies(prisma: PrismaClient): void {
  // No module-level bindings yet.
}

export function registerQualityCommandHandlers(bus: CommandBus, deps: CommandHandlerDeps): void {
  const { prisma, eventBus } = deps;
  // CAPA commands
  bus.register(new CreateCAPACommandHandler(prisma, eventBus));
  bus.register(new UpdateCAPACommandHandler(prisma, eventBus));

  // Quality Centre commands
  bus.register(new CreateCAPAFollowUpCommandHandler(prisma, eventBus));
  bus.register(new CompleteCAPAFollowUpCommandHandler(prisma, eventBus));
  bus.register(new CreateSOPChecklistCommandHandler(prisma, eventBus));
  bus.register(new StartSOPAuditCommandHandler(prisma, eventBus));
  bus.register(new CompleteSOPAuditCommandHandler(prisma, eventBus));
}
