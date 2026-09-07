/**
 * FinnWMS: warehouse topology, receiving, putaway, waves, picking, packing, loading.
 *
 * Module: wms. Registered by di/registry.ts, which is the composition root.
 * See .claude/rules/module-boundaries.md for what this module may depend on.
 */

import { PrismaClient } from '@prisma/client';
import { container } from '../container.js';
import { TOKENS } from '../tokens.js';
import { CommandBus } from '../../commands/CommandBus.js';
import type { CommandHandlerDeps } from '../moduleRegistration.js';
import { FacilityRepository } from '../../repositories/FacilityRepository.js';
import { WarehouseZoneRepository } from '../../repositories/WarehouseZoneRepository.js';
import { ReceivingRepository } from '../../repositories/ReceivingRepository.js';
import { PutawayRuleEvaluator } from '../../services/PutawayRuleEvaluator.js';
import { CartonizationService } from '../../services/CartonizationService.js';
import { CreateFacilityCommandHandler } from '../../commands/facilities/CreateFacilityCommand.js';
import { UpdateFacilityCommandHandler } from '../../commands/facilities/UpdateFacilityCommand.js';
import { ArchiveFacilityCommandHandler } from '../../commands/facilities/ArchiveFacilityCommand.js';
import { CreateWarehouseZoneCommandHandler } from '../../commands/warehouse/CreateWarehouseZoneCommand.js';
import { UpdateWarehouseZoneCommandHandler } from '../../commands/warehouse/UpdateWarehouseZoneCommand.js';
import { CreateWarehouseBinCommandHandler } from '../../commands/warehouse/CreateWarehouseBinCommand.js';
import { UpdateWarehouseBinCommandHandler } from '../../commands/warehouse/UpdateWarehouseBinCommand.js';
import { BulkCreateBinsCommandHandler } from '../../commands/warehouse/BulkCreateBinsCommand.js';
import { CreateReceivingTaskCommandHandler } from '../../commands/warehouse/CreateReceivingTaskCommand.js';
import { RecordReceivingLineCommandHandler } from '../../commands/warehouse/RecordReceivingLineCommand.js';
import { CompleteReceivingCommandHandler } from '../../commands/warehouse/CompleteReceivingCommand.js';
import { AssignPutawayTaskCommandHandler } from '../../commands/warehouse/AssignPutawayTaskCommand.js';
import { CompletePutawayCommandHandler } from '../../commands/warehouse/CompletePutawayCommand.js';
import { CreateWaveCommandHandler } from '../../commands/warehouse/CreateWaveCommand.js';
import { ReleaseWaveCommandHandler } from '../../commands/warehouse/ReleaseWaveCommand.js';
import { CompletePickLineCommandHandler } from '../../commands/warehouse/CompletePickLineCommand.js';
import { CreatePackTaskCommandHandler } from '../../commands/warehouse/CreatePackTaskCommand.js';
import { CompletePackLineCommandHandler } from '../../commands/warehouse/CompletePackLineCommand.js';
import { CreateStagingAssignmentCommandHandler } from '../../commands/warehouse/CreateStagingAssignmentCommand.js';
import { CompleteLoadingCommandHandler } from '../../commands/warehouse/CompleteLoadingCommand.js';
import { CreateCycleCountCommandHandler } from '../../commands/warehouse/CreateCycleCountCommand.js';
import { RecordCycleCountLineCommandHandler } from '../../commands/warehouse/RecordCycleCountLineCommand.js';
import { CreateReplenishmentRuleCommandHandler } from '../../commands/warehouse/CreateReplenishmentRuleCommand.js';
import { CheckReplenishmentCommandHandler } from '../../commands/warehouse/CheckReplenishmentCommand.js';
import { CreateWaveTemplateCommandHandler } from '../../commands/warehouse/CreateWaveTemplateCommand.js';
import { ApplyWaveTemplateCommandHandler } from '../../commands/warehouse/ApplyWaveTemplateCommand.js';
import { CreateLoadPlanCommandHandler } from '../../commands/warehouse/CreateLoadPlanCommand.js';
import { CompleteLoadPlanCommandHandler } from '../../commands/warehouse/CompleteLoadPlanCommand.js';
import { RecordPackAuditCommandHandler } from '../../commands/packAudit/RecordPackAuditCommand.js';

export function registerWmsDependencies(prisma: PrismaClient): void {
  container.singleton(TOKENS.IFacilityRepository).toFactory(() => {
    return new FacilityRepository(container.resolve(TOKENS.PrismaClient));
  });

  container.singleton(TOKENS.IWarehouseZoneRepository).toFactory(() => {
    return new WarehouseZoneRepository(container.resolve(TOKENS.PrismaClient));
  });

  container.singleton(TOKENS.IReceivingRepository).toFactory(() => {
    return new ReceivingRepository(container.resolve(TOKENS.PrismaClient));
  });

  container.singleton(TOKENS.IPutawayRuleEvaluator).toFactory(() => {
    return new PutawayRuleEvaluator(container.resolve(TOKENS.PrismaClient));
  });

  container.singleton(TOKENS.ICartonizationService).toFactory(() => {
    return new CartonizationService(container.resolve(TOKENS.PrismaClient));
  });
}

export function registerWmsCommandHandlers(bus: CommandBus, deps: CommandHandlerDeps): void {
  const { prisma, eventBus } = deps;
  // Facility, the WMS root (#217)
  bus.register(new CreateFacilityCommandHandler(prisma, eventBus));
  bus.register(new UpdateFacilityCommandHandler(prisma, eventBus));
  bus.register(new ArchiveFacilityCommandHandler(prisma, eventBus));

  bus.register(new CreateWarehouseZoneCommandHandler(prisma, eventBus));
  bus.register(new UpdateWarehouseZoneCommandHandler(prisma, eventBus));
  bus.register(new CreateWarehouseBinCommandHandler(prisma, eventBus));
  bus.register(new UpdateWarehouseBinCommandHandler(prisma, eventBus));
  bus.register(new BulkCreateBinsCommandHandler(prisma, eventBus));

  // Receiving commands
  bus.register(new CreateReceivingTaskCommandHandler(prisma, eventBus));
  bus.register(new RecordReceivingLineCommandHandler(prisma, eventBus));
  bus.register(new CompleteReceivingCommandHandler(prisma, eventBus));

  // Putaway commands
  bus.register(new AssignPutawayTaskCommandHandler(prisma, eventBus));
  bus.register(new CompletePutawayCommandHandler(prisma, eventBus));

  // Wave and pick commands
  bus.register(new CreateWaveCommandHandler(prisma, eventBus));
  bus.register(new ReleaseWaveCommandHandler(prisma, eventBus));
  bus.register(new CompletePickLineCommandHandler(prisma, eventBus));

  // Packing and loading commands
  bus.register(new CreatePackTaskCommandHandler(prisma, eventBus));
  bus.register(new CompletePackLineCommandHandler(prisma, eventBus));
  bus.register(new CreateStagingAssignmentCommandHandler(prisma, eventBus));
  bus.register(new CompleteLoadingCommandHandler(prisma, eventBus));

  // Cycle counting commands
  bus.register(new CreateCycleCountCommandHandler(prisma, eventBus));
  bus.register(new RecordCycleCountLineCommandHandler(prisma, eventBus));

  // Replenishment commands
  bus.register(new CreateReplenishmentRuleCommandHandler(prisma, eventBus));
  bus.register(new CheckReplenishmentCommandHandler(prisma, eventBus));

  // Wave template commands
  bus.register(new CreateWaveTemplateCommandHandler(prisma, eventBus));
  bus.register(new ApplyWaveTemplateCommandHandler(prisma, eventBus));

  // Load plan commands
  bus.register(new CreateLoadPlanCommandHandler(prisma, eventBus));
  bus.register(new CompleteLoadPlanCommandHandler(prisma, eventBus));

  // Pack audit
  bus.register(new RecordPackAuditCommandHandler(prisma, eventBus));
}
