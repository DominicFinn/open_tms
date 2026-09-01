/**
 * FinnTMS: shipments, orders, carriers, lanes, tendering, EDI, tracking, cold chain.
 *
 * Module: tms. Registered by di/registry.ts, which is the composition root.
 * See .claude/rules/module-boundaries.md for what this module may depend on.
 */

import { PrismaClient } from '@prisma/client';
import { container } from '../container.js';
import { TOKENS } from '../tokens.js';
import { CommandBus } from '../../commands/CommandBus.js';
import type { CommandHandlerDeps } from '../moduleRegistration.js';
import { ShipmentTypesRepository } from '../../repositories/ShipmentTypesRepository.js';
import { CarriersRepository } from '../../repositories/CarriersRepository.js';
import { ShipmentsRepository } from '../../repositories/ShipmentsRepository.js';
import { LanesRepository } from '../../repositories/LanesRepository.js';
import { OrdersRepository } from '../../repositories/OrdersRepository.js';
import { PendingLaneRequestsRepository } from '../../repositories/PendingLaneRequestsRepository.js';
import { ArrivalCriteriaRepository } from '../../repositories/ArrivalCriteriaRepository.js';
import { CargoTrackingRepository } from '../../repositories/CargoTrackingRepository.js';
import { ModeRulesService } from '../../services/orderLineItem/ModeRulesService.js';
import { OrderCartonizationService } from '../../services/orderLineItem/OrderCartonizationService.js';
import { ArrivalCriteriaEvaluationService } from '../../services/ArrivalCriteriaEvaluationService.js';
import { ShipmentAssignmentService } from '../../services/ShipmentAssignmentService.js';
import { CSVImportService } from '../../services/CSVImportService.js';
import { OrderDeliveryService } from '../../services/OrderDeliveryService.js';
import { EDI850ParseService } from '../../services/EDI850ParseService.js';
import { EdiImportService } from '../../services/EdiImportService.js';
import { OrderConversionService } from '../../services/OrderConversionService.js';
import { CargoReconciliationService } from '../../services/CargoReconciliationService.js';
import { DocumentTemplateRepository } from '../../repositories/DocumentTemplateRepository.js';
import { GeneratedDocumentRepository } from '../../repositories/GeneratedDocumentRepository.js';
import { DocumentGenerationService } from '../../services/DocumentGenerationService.js';
import { DailyReportService } from '../../services/DailyReportService.js';
import { CreateOrderCommandHandler } from '../../commands/orders/CreateOrderCommand.js';
import { UpdateOrderCommandHandler } from '../../commands/orders/UpdateOrderCommand.js';
import { ArchiveOrderCommandHandler } from '../../commands/orders/ArchiveOrderCommand.js';
import { CancelOrderCommandHandler } from '../../commands/orders/CancelOrderCommand.js';
import { SoftDeleteOrderCommandHandler } from '../../commands/orders/SoftDeleteOrderCommand.js';
import { UnarchiveOrderCommandHandler } from '../../commands/orders/UnarchiveOrderCommand.js';
import {
  CreateTrackableUnitCommandHandler,
  UpdateTrackableUnitCommandHandler,
  DeleteTrackableUnitCommandHandler,
  GenerateTrackableUnitBarcodeCommandHandler,
  AddLineItemToUnitCommandHandler,
  MoveLineItemBetweenUnitsCommandHandler,
  MergeTrackableUnitsCommandHandler,
  SplitTrackableUnitCommandHandler,
} from '../../commands/trackableUnits/index.js';
import {
  CreateLineItemCommandHandler,
  UpdateLineItemCommandHandler,
  DeleteLineItemCommandHandler,
} from '../../commands/lineItems/index.js';
import { CreateShipmentCommandHandler } from '../../commands/shipments/CreateShipmentCommand.js';
import { UpdateShipmentCommandHandler } from '../../commands/shipments/UpdateShipmentCommand.js';
import { ArchiveShipmentCommandHandler } from '../../commands/shipments/ArchiveShipmentCommand.js';
import { TransitionShipmentStatusCommandHandler } from '../../commands/shipments/TransitionShipmentStatusCommand.js';
import { SoftDeleteShipmentCommandHandler } from '../../commands/shipments/SoftDeleteShipmentCommand.js';
import { UnarchiveShipmentCommandHandler } from '../../commands/shipments/UnarchiveShipmentCommand.js';
import { CreateCarrierCommandHandler } from '../../commands/carriers/CreateCarrierCommand.js';
import { UpdateCarrierCommandHandler } from '../../commands/carriers/UpdateCarrierCommand.js';
import { ArchiveCarrierCommandHandler } from '../../commands/carriers/ArchiveCarrierCommand.js';
import { UnarchiveCarrierCommandHandler } from '../../commands/carriers/UnarchiveCarrierCommand.js';
import { SoftDeleteCarrierCommandHandler } from '../../commands/carriers/SoftDeleteCarrierCommand.js';
import { CreateShipmentTypeCommandHandler } from '../../commands/shipmentTypes/CreateShipmentTypeCommand.js';
import { UpdateShipmentTypeCommandHandler } from '../../commands/shipmentTypes/UpdateShipmentTypeCommand.js';
import { ArchiveShipmentTypeCommandHandler } from '../../commands/shipmentTypes/ArchiveShipmentTypeCommand.js';
import { CreateLaneCommandHandler } from '../../commands/lanes/CreateLaneCommand.js';
import { UpdateLaneCommandHandler } from '../../commands/lanes/UpdateLaneCommand.js';
import { ArchiveLaneCommandHandler } from '../../commands/lanes/ArchiveLaneCommand.js';
import {
  CreateAgentConfigCommandHandler,
  UpdateAgentConfigCommandHandler,
  CreatePromptVersionCommandHandler,
  ActivatePromptVersionCommandHandler,
} from '../../commands/agentConfig/index.js';
import {
  CreateAutomationRuleCommandHandler,
  UpdateAutomationRuleCommandHandler,
  DeleteAutomationRuleCommandHandler,
  PromoteDecisionToRuleCommandHandler,
} from '../../commands/automationRules/index.js';
import { CreateTenderCommandHandler } from '../../commands/tenders/CreateTenderCommand.js';
import { OpenTenderCommandHandler } from '../../commands/tenders/OpenTenderCommand.js';
import { AwardTenderCommandHandler } from '../../commands/tenders/AwardTenderCommand.js';
import { CancelTenderCommandHandler } from '../../commands/tenders/CancelTenderCommand.js';
import { CreateTradingPartnerCommandHandler } from '../../commands/tradingPartners/CreateTradingPartnerCommand.js';
import { UpdateTradingPartnerCommandHandler } from '../../commands/tradingPartners/UpdateTradingPartnerCommand.js';
import { CreateDeviceCommandHandler } from '../../commands/devices/CreateDeviceCommand.js';
import { UpdateDeviceCommandHandler } from '../../commands/devices/UpdateDeviceCommand.js';
import { AssignDeviceCommandHandler } from '../../commands/devices/AssignDeviceCommand.js';
import { CreateCarrierUserCommandHandler } from '../../commands/carrierUsers/CreateCarrierUserCommand.js';
import { RecordCargoScanCommandHandler } from '../../commands/cargoTracking/RecordCargoScanCommand.js';
import { AcknowledgeExcursionCommandHandler } from '../../commands/coldChain/AcknowledgeExcursionCommand.js';
import { ResolveExcursionCommandHandler } from '../../commands/coldChain/ResolveExcursionCommand.js';
import { SetDispositionCommandHandler } from '../../commands/coldChain/SetDispositionCommand.js';
import { RecordCalibrationCommandHandler } from '../../commands/coldChain/RecordCalibrationCommand.js';
import { ColdChainRepository } from '../../repositories/ColdChainRepository.js';
import { ColdChainService } from '../../services/ColdChainService.js';
import { ComplianceReportService } from '../../services/ComplianceReportService.js';
import { TenderRepository } from '../../repositories/TenderRepository.js';
import { CarrierUserRepository } from '../../repositories/CarrierUserRepository.js';
import { TenderService } from '../../services/TenderService.js';
import { CarrierAuthService } from '../../services/CarrierAuthService.js';
import { TradingPartnerRepository } from '../../repositories/TradingPartnerRepository.js';
import { EdiRouterService } from '../../services/EdiRouterService.js';
import { OutboundEdiDeliveryService } from '../../services/OutboundEdiDeliveryService.js';
import { EDI997Service } from '../../services/EDI997Service.js';
import { EDI214ParseService } from '../../services/EDI214ParseService.js';
import { EDI214Service } from '../../services/EDI214Service.js';
import { EDI204Service } from '../../services/EDI204Service.js';
import { EDI990ParseService } from '../../services/EDI990ParseService.js';
import { EDI210ParseService } from '../../services/EDI210ParseService.js';
import { EDI810Service } from '../../services/EDI810Service.js';
import { EDI820ParseService } from '../../services/EDI820ParseService.js';
import { EDI855Service } from '../../services/EDI855Service.js';
import { EDI180ParseService } from '../../services/EDI180ParseService.js';
import { EDI180Service } from '../../services/EDI180Service.js';
import { EDI940ParseService } from '../../services/EDI940ParseService.js';
import { EDI945Service } from '../../services/EDI945Service.js';
import { ProcessInbound214CommandHandler } from '../../commands/shipments/ProcessInbound214Command.js';
import { RatingService } from '../../services/RatingService.js';
import { QuoteRepository } from '../../repositories/QuoteRepository.js';
import { LtlRatingService } from '../../services/LtlRatingService.js';
import { CreateQuoteCommandHandler } from '../../commands/quotes/CreateQuoteCommand.js';
import { AcceptQuoteCommandHandler } from '../../commands/quotes/AcceptQuoteCommand.js';
import { DeclineQuoteCommandHandler } from '../../commands/quotes/DeclineQuoteCommand.js';
import { ReviseQuoteCommandHandler } from '../../commands/quotes/ReviseQuoteCommand.js';
import { SlaRepository } from '../../repositories/SlaRepository.js';
import { SlaEvaluationService } from '../../services/SlaEvaluationService.js';
import { CreateSlaPolicyCommandHandler } from '../../commands/sla/CreateSlaPolicyCommand.js';
import { UpdateSlaPolicyCommandHandler } from '../../commands/sla/UpdateSlaPolicyCommand.js';
import { DeactivateSlaPolicyCommandHandler } from '../../commands/sla/DeactivateSlaPolicyCommand.js';
import { AgentDecisionRepository } from '../../repositories/AgentDecisionRepository.js';
import { CreateAgentDecisionCommandHandler } from '../../commands/agentDecisions/CreateAgentDecisionCommand.js';
import { RecordDecisionOutcomeCommandHandler } from '../../commands/agentDecisions/RecordDecisionOutcomeCommand.js';
import { PromoteDecisionCommandHandler } from '../../commands/agentDecisions/PromoteDecisionCommand.js';
import { HereRoutingProvider } from '../../services/routing/HereRoutingProvider.js';
import { TomTomRoutingProvider } from '../../services/routing/TomTomRoutingProvider.js';
import { ValhallaRoutingProvider } from '../../services/routing/ValhallaRoutingProvider.js';
import { ShipmentEtaMonitorService } from '../../services/routing/ShipmentEtaMonitorService.js';
import { RouteDeviationService } from '../../services/routing/RouteDeviationService.js';
import { AnthropicLlmProvider } from '../../services/llm/AnthropicLlmProvider.js';
import { SkillRegistry } from '../../services/skills/SkillRegistry.js';
import { CreateIssueSkill } from '../../services/skills/CreateIssueSkill.js';
import { EscalateIssueSkill } from '../../services/skills/EscalateIssueSkill.js';
import { AddCommentSkill } from '../../services/skills/AddCommentSkill.js';
import { ContactDriverSkill } from '../../services/skills/ContactDriverSkill.js';
import { SendEmailSkill } from '../../services/skills/SendEmailSkill.js';
import { CallWebhookSkill } from '../../services/skills/CallWebhookSkill.js';
import { CarrierTrackingIntegrationRepository } from '../../repositories/CarrierTrackingIntegrationRepository.js';
import { CarrierTrackingProviderRegistry } from '../../services/carrierTracking/ProviderRegistry.js';
import { CarrierTrackingService } from '../../services/carrierTracking/CarrierTrackingService.js';
import { FedExTrackingProvider } from '../../services/carrierTracking/providers/FedExTrackingProvider.js';
import { UPSTrackingProvider } from '../../services/carrierTracking/providers/UPSTrackingProvider.js';
import { DHLTrackingProvider } from '../../services/carrierTracking/providers/DHLTrackingProvider.js';
import { EasyPostTrackingProvider } from '../../services/carrierTracking/providers/EasyPostTrackingProvider.js';
import { AfterShipTrackingProvider } from '../../services/carrierTracking/providers/AfterShipTrackingProvider.js';
import { CreateCarrierTrackingIntegrationCommandHandler } from '../../commands/carrierTracking/CreateCarrierTrackingIntegrationCommand.js';
import { UpdateCarrierTrackingIntegrationCommandHandler } from '../../commands/carrierTracking/UpdateCarrierTrackingIntegrationCommand.js';
import { DeleteCarrierTrackingIntegrationCommandHandler } from '../../commands/carrierTracking/DeleteCarrierTrackingIntegrationCommand.js';
import { RecordCarrierTrackingEventCommandHandler } from '../../commands/carrierTracking/RecordCarrierTrackingEventCommand.js';
import { CreateRmaCommandHandler } from '../../commands/rma/CreateRmaCommand.js';
import { AuthorizeRmaCommandHandler } from '../../commands/rma/AuthorizeRmaCommand.js';
import { RejectRmaCommandHandler } from '../../commands/rma/RejectRmaCommand.js';
import { ReceiveRmaLineCommandHandler } from '../../commands/rma/ReceiveRmaLineCommand.js';
import { InspectRmaLineCommandHandler } from '../../commands/rma/InspectRmaLineCommand.js';
import { CompleteRmaCommandHandler } from '../../commands/rma/CompleteRmaCommand.js';
import { GenerateReturnLabelCommandHandler } from '../../commands/rma/GenerateReturnLabelCommand.js';
import { SchedulePickupCommandHandler } from '../../commands/rma/SchedulePickupCommand.js';
import { CancelPickupCommandHandler } from '../../commands/rma/CancelPickupCommand.js';
import { ReturnLabelProviderRegistry } from '../../services/returnLabel/ReturnLabelProviderRegistry.js';
import { IReturnLabelProviderRegistry } from '../../services/returnLabel/IReturnLabelProvider.js';
import { IBinaryStorageProvider } from '../../storage/IBinaryStorageProvider.js';

export function registerTmsDependencies(prisma: PrismaClient): void {
  container.singleton(TOKENS.ICarriersRepository).toFactory(() => {
    return new CarriersRepository(container.resolve(TOKENS.PrismaClient));
  });

  container.singleton(TOKENS.IShipmentsRepository).toFactory(() => {
    return new ShipmentsRepository(container.resolve(TOKENS.PrismaClient));
  });

  container.singleton(TOKENS.IShipmentTypesRepository).toFactory(() => {
    return new ShipmentTypesRepository(container.resolve(TOKENS.PrismaClient));
  });

  container.singleton(TOKENS.ILanesRepository).toFactory(() => {
    return new LanesRepository(container.resolve(TOKENS.PrismaClient));
  });

  container.singleton(TOKENS.IOrdersRepository).toFactory(() => {
    return new OrdersRepository(container.resolve(TOKENS.PrismaClient));
  });

  container.singleton(TOKENS.IPendingLaneRequestsRepository).toFactory(() => {
    return new PendingLaneRequestsRepository(container.resolve(TOKENS.PrismaClient));
  });

  container.singleton(TOKENS.IArrivalCriteriaRepository).toFactory(() => {
    return new ArrivalCriteriaRepository(container.resolve(TOKENS.PrismaClient));
  });

  container.singleton(TOKENS.ICargoTrackingRepository).toFactory(() => {
    return new CargoTrackingRepository(container.resolve(TOKENS.PrismaClient));
  });

  // Order line-item rating services (Phase 1)
  container.singleton(TOKENS.IModeRulesService).toFactory(() => new ModeRulesService());

  container.singleton(TOKENS.IOrderCartonizationService).toFactory(() => new OrderCartonizationService());

  // Register services as singletons
  container.singleton(TOKENS.IShipmentAssignmentService).toFactory(() => {
    return new ShipmentAssignmentService(
      container.resolve(TOKENS.PrismaClient),
      container.resolve(TOKENS.IOrderConversionService),
    );
  });

  container.singleton(TOKENS.ICSVImportService).toFactory(() => {
    return new CSVImportService(
      container.resolve(TOKENS.PrismaClient),
      container.resolve(TOKENS.ICustomersRepository),
      container.resolve(TOKENS.ILocationsRepository),
      container.resolve(TOKENS.ICommandBus),
      container.resolve(TOKENS.IModeRulesService),
    );
  });

  container.singleton(TOKENS.IOrderDeliveryService).toFactory(() => {
    return new OrderDeliveryService(container.resolve(TOKENS.PrismaClient));
  });

  container.singleton(TOKENS.IArrivalCriteriaEvaluationService).toFactory(() => {
    return new ArrivalCriteriaEvaluationService(
      container.resolve(TOKENS.PrismaClient),
      container.resolve(TOKENS.IOrderDeliveryService)
    );
  });

  container.singleton(TOKENS.IOrderConversionService).toFactory(() => {
    return new OrderConversionService(container.resolve(TOKENS.PrismaClient));
  });

  container.singleton(TOKENS.ICargoReconciliationService).toFactory(() => {
    return new CargoReconciliationService(
      container.resolve(TOKENS.PrismaClient),
      container.resolve(TOKENS.ICargoTrackingRepository),
      container.resolve(TOKENS.IEventBus)
    );
  });

  // Document repositories
  container.singleton(TOKENS.IDocumentTemplateRepository).toFactory(() => {
    return new DocumentTemplateRepository(container.resolve(TOKENS.PrismaClient));
  });

  container.singleton(TOKENS.IGeneratedDocumentRepository).toFactory(() => {
    return new GeneratedDocumentRepository(container.resolve(TOKENS.PrismaClient));
  });

  // Document services
  container.singleton(TOKENS.IDocumentGenerationService).toFactory(() => {
    return new DocumentGenerationService(
      container.resolve(TOKENS.PrismaClient),
      container.resolve(TOKENS.IDocumentTemplateRepository),
      container.resolve(TOKENS.IGeneratedDocumentRepository),
      container.resolve(TOKENS.IBinaryStorageProvider),
    );
  });

  container.singleton(TOKENS.IDailyReportService).toFactory(() => {
    return new DailyReportService(container.resolve(TOKENS.PrismaClient));
  });

  // Cold Chain repositories and services
  container.singleton(TOKENS.IColdChainRepository).toFactory(() => {
    return new ColdChainRepository(container.resolve(TOKENS.PrismaClient));
  });

  container.singleton(TOKENS.IColdChainService).toFactory(() => {
    return new ColdChainService(container.resolve(TOKENS.PrismaClient));
  });

  container.singleton(TOKENS.IComplianceReportService).toFactory(() => {
    return new ComplianceReportService(
      container.resolve(TOKENS.PrismaClient),
      container.resolve(TOKENS.IBinaryStorageProvider),
    );
  });

  // SLA repository and service
  container.singleton(TOKENS.ISlaRepository).toFactory(() => {
    return new SlaRepository(container.resolve(TOKENS.PrismaClient));
  });

  container.singleton(TOKENS.IAgentDecisionRepository).toFactory(() => {
    return new AgentDecisionRepository(container.resolve(TOKENS.PrismaClient));
  });

  container.singleton(TOKENS.ISlaEvaluationService).toFactory(() => {
    return new SlaEvaluationService(
      container.resolve(TOKENS.PrismaClient),
      container.resolve(TOKENS.ISlaRepository),
      container.resolve(TOKENS.IEventBus),
    );
  });

  // Tender repositories and services
  container.singleton(TOKENS.ITenderRepository).toFactory(() => {
    return new TenderRepository(container.resolve(TOKENS.PrismaClient));
  });

  container.singleton(TOKENS.ICarrierUserRepository).toFactory(() => {
    return new CarrierUserRepository(container.resolve(TOKENS.PrismaClient));
  });

  container.singleton(TOKENS.ITenderService).toFactory(() => {
    return new TenderService(
      container.resolve(TOKENS.ITenderRepository),
      container.resolve(TOKENS.PrismaClient),
      container.resolve(TOKENS.IOutboundEdiDeliveryService),
    );
  });

  container.singleton(TOKENS.ICarrierAuthService).toFactory(() => {
    return new CarrierAuthService(container.resolve(TOKENS.ICarrierUserRepository));
  });

  container.singleton(TOKENS.IRatingService).toFactory(() => {
    return new RatingService(container.resolve(TOKENS.PrismaClient));
  });

  container.singleton(TOKENS.IQuoteRepository).toFactory(() => {
    return new QuoteRepository(container.resolve(TOKENS.PrismaClient));
  });

  container.singleton(TOKENS.ILtlRatingService).toFactory(() => {
    return new LtlRatingService();
  });

  // Trading Partner / EDI Hub
  container.singleton(TOKENS.ITradingPartnerRepository).toFactory(() => {
    return new TradingPartnerRepository(container.resolve(TOKENS.PrismaClient));
  });

  container.singleton(TOKENS.IEdiRouterService).toFactory(() => {
    return new EdiRouterService();
  });

  container.singleton(TOKENS.IOutboundEdiDeliveryService).toFactory(() => {
    return new OutboundEdiDeliveryService(container.resolve(TOKENS.ITradingPartnerRepository));
  });

  container.singleton(TOKENS.IEDI997Service).toFactory(() => {
    return new EDI997Service();
  });

  container.singleton(TOKENS.IEDI214ParseService).toFactory(() => {
    return new EDI214ParseService();
  });

  container.singleton(TOKENS.IEDI214Service).toFactory(() => {
    return new EDI214Service();
  });

  container.singleton(TOKENS.IEDI204Service).toFactory(() => {
    return new EDI204Service();
  });

  container.singleton(TOKENS.IEDI990ParseService).toFactory(() => {
    return new EDI990ParseService();
  });

  container.singleton(TOKENS.IEDI210ParseService).toFactory(() => {
    return new EDI210ParseService();
  });

  container.singleton(TOKENS.IEDI810Service).toFactory(() => {
    return new EDI810Service();
  });

  container.singleton(TOKENS.IEDI820ParseService).toFactory(() => {
    return new EDI820ParseService();
  });

  container.singleton(TOKENS.IEDI855Service).toFactory(() => {
    return new EDI855Service();
  });

  container.singleton(TOKENS.IEDI180ParseService).toFactory(() => {
    return new EDI180ParseService();
  });

  container.singleton(TOKENS.IEDI180Service).toFactory(() => {
    return new EDI180Service();
  });

  container.singleton(TOKENS.IEDI940ParseService).toFactory(() => {
    return new EDI940ParseService();
  });

  container.singleton(TOKENS.IEDI945Service).toFactory(() => {
    return new EDI945Service();
  });

  // Return label provider registry (manual + fedex/ups/dhl stubs)
  container.singleton(TOKENS.IReturnLabelProviderRegistry).toFactory(() => {
    return new ReturnLabelProviderRegistry();
  });

  // EDI services
  container.singleton(TOKENS.IEDI850ParseService).toFactory(() => {
    return new EDI850ParseService();
  });

  container.singleton(TOKENS.IEdiImportService).toFactory(() => {
    return new EdiImportService(
      container.resolve(TOKENS.PrismaClient),
      container.resolve(TOKENS.IEDI850ParseService),
      container.resolve(TOKENS.IOrdersRepository),
      container.resolve(TOKENS.ICustomersRepository),
      container.resolve(TOKENS.ILocationsRepository),
      container.resolve(TOKENS.ILocationResolutionService),
      container.resolve(TOKENS.ITradingPartnerRepository)
    );
  });

  // Carrier Tracking
  container.singleton(TOKENS.ICarrierTrackingIntegrationRepository).toFactory(() => {
    return new CarrierTrackingIntegrationRepository(container.resolve(TOKENS.PrismaClient));
  });

  container.singleton(TOKENS.ICarrierTrackingProviderRegistry).toFactory(() => {
    const registry = new CarrierTrackingProviderRegistry();
    registry.register('fedex', () => new FedExTrackingProvider());
    registry.register('ups', () => new UPSTrackingProvider());
    registry.register('dhl', () => new DHLTrackingProvider());
    registry.register('easypost', () => new EasyPostTrackingProvider());
    registry.register('aftership', () => new AfterShipTrackingProvider());
    return registry;
  });

  container.singleton(TOKENS.ICarrierTrackingService).toFactory(() => {
    return new CarrierTrackingService(
      container.resolve(TOKENS.PrismaClient),
      container.resolve(TOKENS.IEventBus),
      container.resolve(TOKENS.ICarrierTrackingProviderRegistry),
    );
  });

  // Routing provider — env-based provider selection
  const routingProvider = process.env.ROUTING_PROVIDER || 'none';

  if (routingProvider === 'here' && process.env.HERE_API_KEY) {
    container.singleton(TOKENS.IRoutingProvider).toFactory(() => {
      return new HereRoutingProvider({
        apiKey: process.env.HERE_API_KEY!,
        baseUrl: process.env.HERE_BASE_URL,
        matrixBaseUrl: process.env.HERE_MATRIX_BASE_URL,
      });
    });
  } else if (routingProvider === 'tomtom' && process.env.TOMTOM_API_KEY) {
    container.singleton(TOKENS.IRoutingProvider).toFactory(() => {
      return new TomTomRoutingProvider({
        apiKey: process.env.TOMTOM_API_KEY!,
        baseUrl: process.env.TOMTOM_BASE_URL,
      });
    });
  } else if (routingProvider === 'valhalla' && process.env.VALHALLA_BASE_URL) {
    container.singleton(TOKENS.IRoutingProvider).toFactory(() => {
      return new ValhallaRoutingProvider({
        baseUrl: process.env.VALHALLA_BASE_URL!,
      });
    });
  }

  // If no provider configured, IRoutingProvider won't be resolvable — ETA monitor stays disabled

  // ETA monitor service (only if routing provider is configured)
  if (routingProvider !== 'none') {
    container.singleton(TOKENS.IShipmentEtaMonitorService).toFactory(() => {
      return new ShipmentEtaMonitorService(
        container.resolve(TOKENS.PrismaClient),
        container.resolve(TOKENS.IRoutingProvider),
        container.resolve(TOKENS.IEventBus),
        {
          delayThresholdMinutes: Number(process.env.ETA_DELAY_THRESHOLD_MINUTES || 15),
          warningThresholdMinutes: Number(process.env.ETA_WARNING_THRESHOLD_MINUTES || 30),
          criticalThresholdMinutes: Number(process.env.ETA_CRITICAL_THRESHOLD_MINUTES || 60),
          routeDeviationMeters: Number(process.env.ETA_ROUTE_DEVIATION_METERS || 5000),
          staleGpsThresholdMinutes: Number(process.env.ETA_STALE_GPS_THRESHOLD_MINUTES || 60),
        },
        new RouteDeviationService(),
      );
    });
  }

  // LLM provider (optional — for AI agent features)
  // Set ANTHROPIC_API_KEY to enable the triage agent and other AI features.
  if (process.env.ANTHROPIC_API_KEY) {
    container.singleton(TOKENS.ILlmProvider).toFactory(() => {
      return new AnthropicLlmProvider({
        apiKey: process.env.ANTHROPIC_API_KEY!,
        model: process.env.ANTHROPIC_MODEL,
        baseURL: process.env.ANTHROPIC_BASE_URL,
      });
    });
  }

  // If no LLM provider configured, ILlmProvider won't be resolvable — agent handlers stay disabled

  // Skill registry — register all available skills
  // Skills that need dependencies (CommandBus, EmailService) are registered after the CommandBus
  container.singleton(TOKENS.ISkillRegistry).toFactory(() => new SkillRegistry());
}

export function registerTmsCommandHandlers(bus: CommandBus, deps: CommandHandlerDeps): void {
  const { prisma, eventBus, queue } = deps;
  // Order commands
  bus.register(new CreateOrderCommandHandler(prisma, eventBus));
  bus.register(new UpdateOrderCommandHandler(prisma, eventBus));
  bus.register(new ArchiveOrderCommandHandler(prisma, eventBus));
  bus.register(new CancelOrderCommandHandler(prisma, eventBus));
  bus.register(new SoftDeleteOrderCommandHandler(prisma, eventBus));
  bus.register(new UnarchiveOrderCommandHandler(prisma, eventBus));
  bus.register(new CreateTrackableUnitCommandHandler(prisma, eventBus));
  bus.register(new UpdateTrackableUnitCommandHandler(prisma, eventBus));
  bus.register(new DeleteTrackableUnitCommandHandler(prisma, eventBus));
  bus.register(new GenerateTrackableUnitBarcodeCommandHandler(prisma, eventBus));
  bus.register(new AddLineItemToUnitCommandHandler(prisma, eventBus));
  bus.register(new MoveLineItemBetweenUnitsCommandHandler(prisma, eventBus));
  bus.register(new MergeTrackableUnitsCommandHandler(prisma, eventBus));
  bus.register(new SplitTrackableUnitCommandHandler(prisma, eventBus));
  bus.register(new CreateLineItemCommandHandler(prisma, eventBus));
  bus.register(new UpdateLineItemCommandHandler(prisma, eventBus));
  bus.register(new DeleteLineItemCommandHandler(prisma, eventBus));

  // Shipment commands
  bus.register(new CreateShipmentCommandHandler(prisma, eventBus, queue));
  bus.register(new UpdateShipmentCommandHandler(prisma, eventBus));
  bus.register(new ArchiveShipmentCommandHandler(prisma, eventBus));
  bus.register(new TransitionShipmentStatusCommandHandler(prisma, eventBus));
  bus.register(new SoftDeleteShipmentCommandHandler(prisma, eventBus));
  bus.register(new UnarchiveShipmentCommandHandler(prisma, eventBus));

  // Carrier commands
  bus.register(new CreateCarrierCommandHandler(prisma, eventBus));
  bus.register(new UpdateCarrierCommandHandler(prisma, eventBus));
  bus.register(new ArchiveCarrierCommandHandler(prisma, eventBus));
  bus.register(new UnarchiveCarrierCommandHandler(prisma, eventBus));
  bus.register(new SoftDeleteCarrierCommandHandler(prisma, eventBus));
  bus.register(new CreateShipmentTypeCommandHandler(prisma, eventBus));
  bus.register(new UpdateShipmentTypeCommandHandler(prisma, eventBus));
  bus.register(new ArchiveShipmentTypeCommandHandler(prisma, eventBus));

  // Lane commands
  bus.register(new CreateLaneCommandHandler(prisma, eventBus));
  bus.register(new UpdateLaneCommandHandler(prisma, eventBus));
  bus.register(new ArchiveLaneCommandHandler(prisma, eventBus));

  // Agent config commands
  bus.register(new CreateAgentConfigCommandHandler(prisma, eventBus));
  bus.register(new UpdateAgentConfigCommandHandler(prisma, eventBus));
  bus.register(new CreatePromptVersionCommandHandler(prisma, eventBus));
  bus.register(new ActivatePromptVersionCommandHandler(prisma, eventBus));

  // Automation rule commands
  bus.register(new CreateAutomationRuleCommandHandler(prisma, eventBus));
  bus.register(new UpdateAutomationRuleCommandHandler(prisma, eventBus));
  bus.register(new DeleteAutomationRuleCommandHandler(prisma, eventBus));
  bus.register(new PromoteDecisionToRuleCommandHandler(prisma, eventBus));

  // Tender commands
  bus.register(new CreateTenderCommandHandler(prisma, eventBus));
  bus.register(new OpenTenderCommandHandler(prisma, eventBus));
  bus.register(new AwardTenderCommandHandler(prisma, eventBus));
  bus.register(new CancelTenderCommandHandler(prisma, eventBus));

  // Trading Partner commands
  bus.register(new CreateTradingPartnerCommandHandler(prisma, eventBus));
  bus.register(new UpdateTradingPartnerCommandHandler(prisma, eventBus));

  // Device commands
  bus.register(new CreateDeviceCommandHandler(prisma, eventBus));
  bus.register(new UpdateDeviceCommandHandler(prisma, eventBus));
  bus.register(new AssignDeviceCommandHandler(prisma, eventBus));

  // Carrier User commands
  bus.register(new CreateCarrierUserCommandHandler(prisma, eventBus));

  // Cargo Tracking commands
  bus.register(new RecordCargoScanCommandHandler(prisma, eventBus));

  // Cold Chain commands
  bus.register(new AcknowledgeExcursionCommandHandler(prisma, eventBus));
  bus.register(new ResolveExcursionCommandHandler(prisma, eventBus));
  bus.register(new SetDispositionCommandHandler(prisma, eventBus));
  bus.register(new RecordCalibrationCommandHandler(prisma, eventBus));

  // SLA commands
  bus.register(new CreateSlaPolicyCommandHandler(prisma, eventBus));
  bus.register(new UpdateSlaPolicyCommandHandler(prisma, eventBus));
  bus.register(new DeactivateSlaPolicyCommandHandler(prisma, eventBus));

  // EDI 214 commands
  bus.register(new ProcessInbound214CommandHandler(prisma, eventBus));

  // Agent Decision commands
  bus.register(new CreateAgentDecisionCommandHandler(prisma, eventBus));
  bus.register(new RecordDecisionOutcomeCommandHandler(prisma, eventBus));
  bus.register(new PromoteDecisionCommandHandler(prisma, eventBus));

  // Carrier Tracking commands
  bus.register(new CreateCarrierTrackingIntegrationCommandHandler(prisma, eventBus));
  bus.register(new UpdateCarrierTrackingIntegrationCommandHandler(prisma, eventBus));
  bus.register(new DeleteCarrierTrackingIntegrationCommandHandler(prisma, eventBus));
  bus.register(new RecordCarrierTrackingEventCommandHandler(prisma, eventBus));

  // Quote commands
  bus.register(new CreateQuoteCommandHandler(prisma, eventBus));
  bus.register(new AcceptQuoteCommandHandler(prisma, eventBus));
  bus.register(new DeclineQuoteCommandHandler(prisma, eventBus));
  bus.register(new ReviseQuoteCommandHandler(prisma, eventBus));

  // WMS Returns / RMA commands
  bus.register(new CreateRmaCommandHandler(prisma, eventBus));
  bus.register(new AuthorizeRmaCommandHandler(prisma, eventBus));
  bus.register(new RejectRmaCommandHandler(prisma, eventBus));
  bus.register(new ReceiveRmaLineCommandHandler(prisma, eventBus));
  bus.register(new InspectRmaLineCommandHandler(prisma, eventBus));
  bus.register(new CompleteRmaCommandHandler(prisma, eventBus));
  const returnLabelRegistry = container.resolve<IReturnLabelProviderRegistry>(TOKENS.IReturnLabelProviderRegistry);
  const binaryStorage = container.resolve<IBinaryStorageProvider>(TOKENS.IBinaryStorageProvider);
  bus.register(new GenerateReturnLabelCommandHandler(prisma, eventBus, returnLabelRegistry, binaryStorage));
  bus.register(new SchedulePickupCommandHandler(prisma, eventBus, returnLabelRegistry));
  bus.register(new CancelPickupCommandHandler(prisma, eventBus, returnLabelRegistry));
}

/**
 * Post-construction wiring. Runs after every module has registered, because it resolves
 * instances rather than binding factories.
 */
export function wireTmsDependencies(prisma: PrismaClient): void {
  // Wire up cargo reconciliation into the delivery service (post-construction, after IEventBus is registered)
  {
    const deliveryService = container.resolve<OrderDeliveryService>(TOKENS.IOrderDeliveryService);
    const cargoService = container.resolve<CargoReconciliationService>(TOKENS.ICargoReconciliationService);
    deliveryService.setCargoReconciliationService(cargoService);
  }

  // Register built-in skills (after CommandBus is available)
  {
    const registry = container.resolve<SkillRegistry>(TOKENS.ISkillRegistry);
    const commandBus = container.resolve<import('../../commands/CommandBus.js').ICommandBus>(TOKENS.ICommandBus);
    registry.register(new CreateIssueSkill(commandBus));
    registry.register(new EscalateIssueSkill(commandBus));
    registry.register(new AddCommentSkill(prisma));
    registry.register(new ContactDriverSkill(prisma));
    registry.register(new CallWebhookSkill());

    // SendEmailSkill only if email service is available
    if (container.has(TOKENS.IEmailService)) {
      const emailService = container.resolve<import('../../services/IEmailService.js').IEmailService>(TOKENS.IEmailService);
      registry.register(new SendEmailSkill(emailService));
    }
  }
}
