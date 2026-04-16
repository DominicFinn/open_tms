/**
 * Dependency Injection Registry
 * Registers all dependencies at application startup
 */

import { PrismaClient } from '@prisma/client';
import { container } from './container.js';
import { TOKENS } from './tokens.js';
import { CustomersRepository } from '../repositories/CustomersRepository.js';
import { CarriersRepository } from '../repositories/CarriersRepository.js';
import { LocationsRepository } from '../repositories/LocationsRepository.js';
import { ShipmentsRepository } from '../repositories/ShipmentsRepository.js';
import { LanesRepository } from '../repositories/LanesRepository.js';
import { OrdersRepository } from '../repositories/OrdersRepository.js';
import { OrganizationRepository } from '../repositories/OrganizationRepository.js';
import { PendingLaneRequestsRepository } from '../repositories/PendingLaneRequestsRepository.js';
import { ArrivalCriteriaRepository } from '../repositories/ArrivalCriteriaRepository.js';
import { CargoTrackingRepository } from '../repositories/CargoTrackingRepository.js';
import { WarehouseZoneRepository } from '../repositories/WarehouseZoneRepository.js';
import { ReceivingRepository } from '../repositories/ReceivingRepository.js';
import { PutawayRuleEvaluator } from '../services/PutawayRuleEvaluator.js';
import { LocationResolutionService } from '../services/LocationResolutionService.js';
import { ArrivalCriteriaEvaluationService } from '../services/ArrivalCriteriaEvaluationService.js';
import { ShipmentAssignmentService } from '../services/ShipmentAssignmentService.js';
import { CSVImportService } from '../services/CSVImportService.js';
import { OrderDeliveryService } from '../services/OrderDeliveryService.js';
import { EDI850ParseService } from '../services/EDI850ParseService.js';
import { EdiImportService } from '../services/EdiImportService.js';
import { OrderConversionService } from '../services/OrderConversionService.js';
import { CargoReconciliationService } from '../services/CargoReconciliationService.js';
import { DocumentTemplateRepository } from '../repositories/DocumentTemplateRepository.js';
import { GeneratedDocumentRepository } from '../repositories/GeneratedDocumentRepository.js';
import { DocumentGenerationService } from '../services/DocumentGenerationService.js';
import { DailyReportService } from '../services/DailyReportService.js';
import { DatabaseFileStorage } from '../storage/DatabaseFileStorage.js';
import { DatabaseBinaryStorage } from '../storage/DatabaseBinaryStorage.js';
import { S3FileStorage } from '../storage/S3FileStorage.js';
import { AttachmentRepository } from '../repositories/AttachmentRepository.js';
import { CustomFieldService } from '../services/CustomFieldService.js';
import { PgBossQueueAdapter } from '../queue/PgBossQueueAdapter.js';
import { PgBossEventBus } from '../events/PgBossEventBus.js';
import { SmtpEmailService } from '../services/SmtpEmailService.js';
import { ConsoleEmailService } from '../services/ConsoleEmailService.js';
import { CommandBus } from '../commands/CommandBus.js';
import { CreateOrderCommandHandler } from '../commands/orders/CreateOrderCommand.js';
import { UpdateOrderCommandHandler } from '../commands/orders/UpdateOrderCommand.js';
import { ArchiveOrderCommandHandler } from '../commands/orders/ArchiveOrderCommand.js';
import { CreateShipmentCommandHandler } from '../commands/shipments/CreateShipmentCommand.js';
import { UpdateShipmentCommandHandler } from '../commands/shipments/UpdateShipmentCommand.js';
import { ArchiveShipmentCommandHandler } from '../commands/shipments/ArchiveShipmentCommand.js';
import { CreateCarrierCommandHandler } from '../commands/carriers/CreateCarrierCommand.js';
import { UpdateCarrierCommandHandler } from '../commands/carriers/UpdateCarrierCommand.js';
import { ArchiveCarrierCommandHandler } from '../commands/carriers/ArchiveCarrierCommand.js';
import { CreateCustomerCommandHandler } from '../commands/customers/CreateCustomerCommand.js';
import { UpdateCustomerCommandHandler } from '../commands/customers/UpdateCustomerCommand.js';
import { ArchiveCustomerCommandHandler } from '../commands/customers/ArchiveCustomerCommand.js';
import { CreateLocationCommandHandler } from '../commands/locations/CreateLocationCommand.js';
import { UpdateLocationCommandHandler } from '../commands/locations/UpdateLocationCommand.js';
import { CreateLaneCommandHandler } from '../commands/lanes/CreateLaneCommand.js';
import { UpdateLaneCommandHandler } from '../commands/lanes/UpdateLaneCommand.js';
import { ArchiveLaneCommandHandler } from '../commands/lanes/ArchiveLaneCommand.js';
import { CreateIssueCommandHandler } from '../commands/issues/CreateIssueCommand.js';
import { UpdateIssueCommandHandler } from '../commands/issues/UpdateIssueCommand.js';
import { EscalateIssueCommandHandler } from '../commands/issues/EscalateIssueCommand.js';
import { CreateTenderCommandHandler } from '../commands/tenders/CreateTenderCommand.js';
import { OpenTenderCommandHandler } from '../commands/tenders/OpenTenderCommand.js';
import { AwardTenderCommandHandler } from '../commands/tenders/AwardTenderCommand.js';
import { CancelTenderCommandHandler } from '../commands/tenders/CancelTenderCommand.js';
import { CreateTradingPartnerCommandHandler } from '../commands/tradingPartners/CreateTradingPartnerCommand.js';
import { UpdateTradingPartnerCommandHandler } from '../commands/tradingPartners/UpdateTradingPartnerCommand.js';
import { CreateDeviceCommandHandler } from '../commands/devices/CreateDeviceCommand.js';
import { UpdateDeviceCommandHandler } from '../commands/devices/UpdateDeviceCommand.js';
import { AssignDeviceCommandHandler } from '../commands/devices/AssignDeviceCommand.js';
import { CreateCarrierUserCommandHandler } from '../commands/carrierUsers/CreateCarrierUserCommand.js';
import { RecordCargoScanCommandHandler } from '../commands/cargoTracking/RecordCargoScanCommand.js';
import { CreateColdChainProfileCommandHandler } from '../commands/coldChain/CreateColdChainProfileCommand.js';
import { UpdateColdChainProfileCommandHandler } from '../commands/coldChain/UpdateColdChainProfileCommand.js';
import { AcknowledgeExcursionCommandHandler } from '../commands/coldChain/AcknowledgeExcursionCommand.js';
import { ResolveExcursionCommandHandler } from '../commands/coldChain/ResolveExcursionCommand.js';
import { SetDispositionCommandHandler } from '../commands/coldChain/SetDispositionCommand.js';
import { RecordCalibrationCommandHandler } from '../commands/coldChain/RecordCalibrationCommand.js';
import { CreateCAPACommandHandler } from '../commands/capa/CreateCAPACommand.js';
import { UpdateCAPACommandHandler } from '../commands/capa/UpdateCAPACommand.js';
import { ColdChainRepository } from '../repositories/ColdChainRepository.js';
import { ColdChainService } from '../services/ColdChainService.js';
import { ComplianceReportService } from '../services/ComplianceReportService.js';
import { TenderRepository } from '../repositories/TenderRepository.js';
import { CarrierUserRepository } from '../repositories/CarrierUserRepository.js';
import { TenderService } from '../services/TenderService.js';
import { CarrierAuthService } from '../services/CarrierAuthService.js';
import { CustomerUserRepository } from '../repositories/CustomerUserRepository.js';
import { CustomerAuthService } from '../services/CustomerAuthService.js';
import { TradingPartnerRepository } from '../repositories/TradingPartnerRepository.js';
import { EdiRouterService } from '../services/EdiRouterService.js';
import { OutboundEdiDeliveryService } from '../services/OutboundEdiDeliveryService.js';
import { EDI997Service } from '../services/EDI997Service.js';
import { EDI214ParseService } from '../services/EDI214ParseService.js';
import { EDI214Service } from '../services/EDI214Service.js';
import { EDI204Service } from '../services/EDI204Service.js';
import { EDI990ParseService } from '../services/EDI990ParseService.js';
import { EDI210ParseService } from '../services/EDI210ParseService.js';
import { EDI810Service } from '../services/EDI810Service.js';
import { EDI820ParseService } from '../services/EDI820ParseService.js';
import { EDI855Service } from '../services/EDI855Service.js';
import { ProcessInbound214CommandHandler } from '../commands/shipments/ProcessInbound214Command.js';
import { ChargeRepository } from '../repositories/ChargeRepository.js';
import { ChargeService } from '../services/ChargeService.js';
import { RatingService } from '../services/RatingService.js';
import { CreateChargeCommandHandler } from '../commands/charges/CreateChargeCommand.js';
import { ApproveChargeCommandHandler } from '../commands/charges/ApproveChargeCommand.js';
import { InvoiceRepository, PaymentRepository } from '../repositories/InvoiceRepository.js';
import { InvoicingService } from '../services/InvoicingService.js';
import { CreateInvoiceCommandHandler } from '../commands/invoices/CreateInvoiceCommand.js';
import { CarrierInvoiceRepository } from '../repositories/CarrierInvoiceRepository.js';
import { FreightAuditService } from '../services/FreightAuditService.js';
import { ReceiveCarrierInvoiceCommandHandler } from '../commands/carrierInvoices/ReceiveCarrierInvoiceCommand.js';
import { FinancialQueryRepository, CreditNoteRepository } from '../repositories/FinancialQueryRepository.js';
import { RaiseQueryCommandHandler } from '../commands/queries/RaiseQueryCommand.js';
import { ResolveQueryCommandHandler } from '../commands/queries/ResolveQueryCommand.js';
import { QuoteRepository } from '../repositories/QuoteRepository.js';
import { LtlRatingService } from '../services/LtlRatingService.js';
import { CreateQuoteCommandHandler } from '../commands/quotes/CreateQuoteCommand.js';
import { AcceptQuoteCommandHandler } from '../commands/quotes/AcceptQuoteCommand.js';
import { DeclineQuoteCommandHandler } from '../commands/quotes/DeclineQuoteCommand.js';
import { ReviseQuoteCommandHandler } from '../commands/quotes/ReviseQuoteCommand.js';
import { ReweighAdjustmentCommandHandler } from '../commands/charges/ReweighAdjustmentCommand.js';
import { ApproveCarrierInvoiceCommandHandler } from '../commands/carrierInvoices/ApproveCarrierInvoiceCommand.js';
import { RecordCarrierPaymentCommandHandler } from '../commands/carrierInvoices/RecordCarrierPaymentCommand.js';
import { ApproveInvoiceCommandHandler } from '../commands/invoices/ApproveInvoiceCommand.js';
import { SendInvoiceCommandHandler } from '../commands/invoices/SendInvoiceCommand.js';
import { RecordPaymentCommandHandler } from '../commands/invoices/RecordPaymentCommand.js';
import { VoidInvoiceCommandHandler } from '../commands/invoices/VoidInvoiceCommand.js';
import { SlaRepository } from '../repositories/SlaRepository.js';
import { SlaEvaluationService } from '../services/SlaEvaluationService.js';
import { CreateSlaPolicyCommandHandler } from '../commands/sla/CreateSlaPolicyCommand.js';
import { UpdateSlaPolicyCommandHandler } from '../commands/sla/UpdateSlaPolicyCommand.js';
import { DeactivateSlaPolicyCommandHandler } from '../commands/sla/DeactivateSlaPolicyCommand.js';
import { AgentDecisionRepository } from '../repositories/AgentDecisionRepository.js';
import { IssueRepository } from '../repositories/IssueRepository.js';
import { CreateAgentDecisionCommandHandler } from '../commands/agentDecisions/CreateAgentDecisionCommand.js';
import { RecordDecisionOutcomeCommandHandler } from '../commands/agentDecisions/RecordDecisionOutcomeCommand.js';
import { PromoteDecisionCommandHandler } from '../commands/agentDecisions/PromoteDecisionCommand.js';
import { HereRoutingProvider } from '../services/routing/HereRoutingProvider.js';
import { TomTomRoutingProvider } from '../services/routing/TomTomRoutingProvider.js';
import { ValhallaRoutingProvider } from '../services/routing/ValhallaRoutingProvider.js';
import { ShipmentEtaMonitorService } from '../services/routing/ShipmentEtaMonitorService.js';
import { RouteDeviationService } from '../services/routing/RouteDeviationService.js';
import { AnthropicLlmProvider } from '../services/llm/AnthropicLlmProvider.js';
import { SkillRegistry } from '../services/skills/SkillRegistry.js';
import { CreateIssueSkill } from '../services/skills/CreateIssueSkill.js';
import { EscalateIssueSkill } from '../services/skills/EscalateIssueSkill.js';
import { AddCommentSkill } from '../services/skills/AddCommentSkill.js';
import { ContactDriverSkill } from '../services/skills/ContactDriverSkill.js';
import { SendEmailSkill } from '../services/skills/SendEmailSkill.js';
import { CallWebhookSkill } from '../services/skills/CallWebhookSkill.js';
import { CarrierTrackingIntegrationRepository } from '../repositories/CarrierTrackingIntegrationRepository.js';
import { CarrierTrackingProviderRegistry } from '../services/carrierTracking/ProviderRegistry.js';
import { CarrierTrackingService } from '../services/carrierTracking/CarrierTrackingService.js';
import { FedExTrackingProvider } from '../services/carrierTracking/providers/FedExTrackingProvider.js';
import { UPSTrackingProvider } from '../services/carrierTracking/providers/UPSTrackingProvider.js';
import { DHLTrackingProvider } from '../services/carrierTracking/providers/DHLTrackingProvider.js';
import { CreateCarrierTrackingIntegrationCommandHandler } from '../commands/carrierTracking/CreateCarrierTrackingIntegrationCommand.js';
import { UpdateCarrierTrackingIntegrationCommandHandler } from '../commands/carrierTracking/UpdateCarrierTrackingIntegrationCommand.js';
import { DeleteCarrierTrackingIntegrationCommandHandler } from '../commands/carrierTracking/DeleteCarrierTrackingIntegrationCommand.js';
import { RecordCarrierTrackingEventCommandHandler } from '../commands/carrierTracking/RecordCarrierTrackingEventCommand.js';
import { CreateCAPAFollowUpCommandHandler } from '../commands/capaFollowUps/CreateCAPAFollowUpCommand.js';
import { CompleteCAPAFollowUpCommandHandler } from '../commands/capaFollowUps/CompleteCAPAFollowUpCommand.js';
import { CreateSOPChecklistCommandHandler } from '../commands/sopChecklists/CreateSOPChecklistCommand.js';
import { StartSOPAuditCommandHandler } from '../commands/sopChecklists/StartSOPAuditCommand.js';
import { CompleteSOPAuditCommandHandler } from '../commands/sopChecklists/CompleteSOPAuditCommand.js';

// WMS command handlers
import { CreateWarehouseZoneCommandHandler } from '../commands/warehouse/CreateWarehouseZoneCommand.js';
import { UpdateWarehouseZoneCommandHandler } from '../commands/warehouse/UpdateWarehouseZoneCommand.js';
import { CreateWarehouseBinCommandHandler } from '../commands/warehouse/CreateWarehouseBinCommand.js';
import { UpdateWarehouseBinCommandHandler } from '../commands/warehouse/UpdateWarehouseBinCommand.js';
import { BulkCreateBinsCommandHandler } from '../commands/warehouse/BulkCreateBinsCommand.js';
import { CreateReceivingTaskCommandHandler } from '../commands/warehouse/CreateReceivingTaskCommand.js';
import { RecordReceivingLineCommandHandler } from '../commands/warehouse/RecordReceivingLineCommand.js';
import { CompleteReceivingCommandHandler } from '../commands/warehouse/CompleteReceivingCommand.js';
import { AssignPutawayTaskCommandHandler } from '../commands/warehouse/AssignPutawayTaskCommand.js';
import { CompletePutawayCommandHandler } from '../commands/warehouse/CompletePutawayCommand.js';
import { AdjustInventoryCommandHandler } from '../commands/warehouse/AdjustInventoryCommand.js';
import { TransferInventoryCommandHandler } from '../commands/warehouse/TransferInventoryCommand.js';
import { CreateWaveCommandHandler } from '../commands/warehouse/CreateWaveCommand.js';
import { ReleaseWaveCommandHandler } from '../commands/warehouse/ReleaseWaveCommand.js';
import { CompletePickLineCommandHandler } from '../commands/warehouse/CompletePickLineCommand.js';
import { CreatePackTaskCommandHandler } from '../commands/warehouse/CreatePackTaskCommand.js';
import { CompletePackLineCommandHandler } from '../commands/warehouse/CompletePackLineCommand.js';
import { CreateStagingAssignmentCommandHandler } from '../commands/warehouse/CreateStagingAssignmentCommand.js';
import { CompleteLoadingCommandHandler } from '../commands/warehouse/CompleteLoadingCommand.js';
import { CreateCycleCountCommandHandler } from '../commands/warehouse/CreateCycleCountCommand.js';
import { RecordCycleCountLineCommandHandler } from '../commands/warehouse/RecordCycleCountLineCommand.js';
import { CreateReplenishmentRuleCommandHandler } from '../commands/warehouse/CreateReplenishmentRuleCommand.js';
import { CheckReplenishmentCommandHandler } from '../commands/warehouse/CheckReplenishmentCommand.js';
import { CreateWaveTemplateCommandHandler } from '../commands/warehouse/CreateWaveTemplateCommand.js';
import { ApplyWaveTemplateCommandHandler } from '../commands/warehouse/ApplyWaveTemplateCommand.js';

/**
 * Register all application dependencies
 */
export function registerDependencies(prisma: PrismaClient): void {
  // Register PrismaClient as singleton
  container.singleton(TOKENS.PrismaClient).toFactory(() => prisma);

  // Register repositories as singletons (they're stateless, so we can reuse instances)
  container.singleton(TOKENS.ICustomersRepository).toFactory(() => {
    return new CustomersRepository(container.resolve(TOKENS.PrismaClient));
  });

  container.singleton(TOKENS.ICarriersRepository).toFactory(() => {
    return new CarriersRepository(container.resolve(TOKENS.PrismaClient));
  });

  container.singleton(TOKENS.ILocationsRepository).toFactory(() => {
    return new LocationsRepository(container.resolve(TOKENS.PrismaClient));
  });

  container.singleton(TOKENS.IShipmentsRepository).toFactory(() => {
    return new ShipmentsRepository(container.resolve(TOKENS.PrismaClient));
  });

  container.singleton(TOKENS.ILanesRepository).toFactory(() => {
    return new LanesRepository(container.resolve(TOKENS.PrismaClient));
  });

  container.singleton(TOKENS.IOrdersRepository).toFactory(() => {
    return new OrdersRepository(container.resolve(TOKENS.PrismaClient));
  });

  container.singleton(TOKENS.IOrganizationRepository).toFactory(() => {
    return new OrganizationRepository(container.resolve(TOKENS.PrismaClient));
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

  // WMS repositories
  container.singleton(TOKENS.IWarehouseZoneRepository).toFactory(() => {
    return new WarehouseZoneRepository(container.resolve(TOKENS.PrismaClient));
  });
  container.singleton(TOKENS.IReceivingRepository).toFactory(() => {
    return new ReceivingRepository(container.resolve(TOKENS.PrismaClient));
  });
  container.singleton(TOKENS.IPutawayRuleEvaluator).toFactory(() => {
    return new PutawayRuleEvaluator(container.resolve(TOKENS.PrismaClient));
  });

  // Register services as singletons
  container.singleton(TOKENS.IShipmentAssignmentService).toFactory(() => {
    return new ShipmentAssignmentService(container.resolve(TOKENS.PrismaClient));
  });

  container.singleton(TOKENS.ICSVImportService).toFactory(() => {
    return new CSVImportService(
      container.resolve(TOKENS.PrismaClient),
      container.resolve(TOKENS.IOrdersRepository),
      container.resolve(TOKENS.ICustomersRepository),
      container.resolve(TOKENS.ILocationsRepository)
    );
  });

  container.singleton(TOKENS.ILocationResolutionService).toFactory(() => {
    return new LocationResolutionService(
      container.resolve(TOKENS.PrismaClient),
      container.resolve(TOKENS.ILocationsRepository),
      container.resolve(TOKENS.IArrivalCriteriaRepository),
      container.resolve(TOKENS.IEventBus)
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

  // File storage provider for EDI (string-based, default: database)
  container.singleton(TOKENS.IFileStorageProvider).toFactory(() => {
    return new DatabaseFileStorage(container.resolve(TOKENS.PrismaClient));
  });

  // Binary storage provider for documents/attachments (S3 or database fallback)
  const s3Endpoint = process.env.S3_ENDPOINT;
  const s3Bucket = process.env.S3_BUCKET;
  if (s3Endpoint && s3Bucket) {
    container.singleton(TOKENS.IBinaryStorageProvider).toFactory(() => {
      return new S3FileStorage({
        endpoint: s3Endpoint,
        bucket: s3Bucket,
        region: process.env.S3_REGION || 'us-east-1',
        accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
      });
    });
  } else {
    container.singleton(TOKENS.IBinaryStorageProvider).toFactory(() => {
      return new DatabaseBinaryStorage(container.resolve(TOKENS.PrismaClient));
    });
  }

  // Attachment repository
  container.singleton(TOKENS.IAttachmentRepository).toFactory(() => {
    return new AttachmentRepository(container.resolve(TOKENS.PrismaClient));
  });

  // Custom fields
  container.singleton(TOKENS.ICustomFieldService).toFactory(() => {
    return new CustomFieldService(container.resolve(TOKENS.PrismaClient));
  });

  // Email service — env-based provider selection
  const emailProvider = process.env.EMAIL_PROVIDER || 'console';
  if (emailProvider === 'smtp') {
    container.singleton(TOKENS.IEmailService).toFactory(() => {
      return new SmtpEmailService({
        host: process.env.SMTP_HOST || 'localhost',
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        user: process.env.SMTP_USER || '',
        password: process.env.SMTP_PASSWORD || '',
        fromEmail: process.env.EMAIL_FROM_ADDRESS || 'noreply@opentms.local',
        fromName: process.env.EMAIL_FROM_NAME || 'Open TMS',
      });
    });
  } else {
    container.singleton(TOKENS.IEmailService).toFactory(() => {
      return new ConsoleEmailService();
    });
  }

  // Queue adapter
  container.singleton(TOKENS.IQueueAdapter).toFactory(() => {
    const dbUrl = process.env.DATABASE_URL || '';
    return new PgBossQueueAdapter(dbUrl);
  });

  // Event bus (publish-only in API server, full processing in worker)
  container.singleton(TOKENS.IEventBus).toFactory(() => {
    return new PgBossEventBus(
      container.resolve(TOKENS.PrismaClient),
      container.resolve(TOKENS.IQueueAdapter)
    );
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

  container.singleton(TOKENS.IIssueRepository).toFactory(() => {
    return new IssueRepository(container.resolve(TOKENS.PrismaClient));
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

  // Customer Portal
  container.singleton(TOKENS.ICustomerUserRepository).toFactory(() => {
    return new CustomerUserRepository(container.resolve(TOKENS.PrismaClient));
  });

  container.singleton(TOKENS.ICustomerAuthService).toFactory(() => {
    return new CustomerAuthService(container.resolve(TOKENS.ICustomerUserRepository));
  });

  // Financial
  container.singleton(TOKENS.IChargeRepository).toFactory(() => {
    return new ChargeRepository(container.resolve(TOKENS.PrismaClient));
  });

  container.singleton(TOKENS.IRatingService).toFactory(() => {
    return new RatingService(container.resolve(TOKENS.PrismaClient));
  });

  container.singleton(TOKENS.IChargeService).toFactory(() => {
    return new ChargeService(
      container.resolve(TOKENS.IChargeRepository),
      container.resolve(TOKENS.PrismaClient),
    );
  });

  container.singleton(TOKENS.IInvoiceRepository).toFactory(() => {
    return new InvoiceRepository(container.resolve(TOKENS.PrismaClient));
  });

  container.singleton(TOKENS.IPaymentRepository).toFactory(() => {
    return new PaymentRepository(container.resolve(TOKENS.PrismaClient));
  });

  container.singleton(TOKENS.IInvoicingService).toFactory(() => {
    return new InvoicingService(
      container.resolve(TOKENS.IInvoiceRepository),
      container.resolve(TOKENS.IChargeRepository),
      container.resolve(TOKENS.PrismaClient),
    );
  });

  container.singleton(TOKENS.ICarrierInvoiceRepository).toFactory(() => {
    return new CarrierInvoiceRepository(container.resolve(TOKENS.PrismaClient));
  });

  container.singleton(TOKENS.IFreightAuditService).toFactory(() => {
    return new FreightAuditService(
      container.resolve(TOKENS.IChargeRepository),
      container.resolve(TOKENS.PrismaClient),
    );
  });

  container.singleton(TOKENS.IFinancialQueryRepository).toFactory(() => {
    return new FinancialQueryRepository(container.resolve(TOKENS.PrismaClient));
  });

  container.singleton(TOKENS.ICreditNoteRepository).toFactory(() => {
    return new CreditNoteRepository(container.resolve(TOKENS.PrismaClient));
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

  // Wire up cargo reconciliation into the delivery service (post-construction, after IEventBus is registered)
  {
    const deliveryService = container.resolve<OrderDeliveryService>(TOKENS.IOrderDeliveryService);
    const cargoService = container.resolve<CargoReconciliationService>(TOKENS.ICargoReconciliationService);
    deliveryService.setCargoReconciliationService(cargoService);
  }

  // Command bus — register all command handlers
  container.singleton(TOKENS.ICommandBus).toFactory(() => {
    const bus = new CommandBus();
    const prisma = container.resolve<PrismaClient>(TOKENS.PrismaClient);
    const eventBus = container.resolve<PgBossEventBus>(TOKENS.IEventBus);
    const queue = container.resolve<import('../queue/IQueueAdapter.js').IQueueAdapter>(TOKENS.IQueueAdapter);

    // Order commands
    bus.register(new CreateOrderCommandHandler(prisma, eventBus));
    bus.register(new UpdateOrderCommandHandler(prisma, eventBus));
    bus.register(new ArchiveOrderCommandHandler(prisma, eventBus));

    // Shipment commands
    bus.register(new CreateShipmentCommandHandler(prisma, eventBus, queue));
    bus.register(new UpdateShipmentCommandHandler(prisma, eventBus));
    bus.register(new ArchiveShipmentCommandHandler(prisma, eventBus));

    // Carrier commands
    bus.register(new CreateCarrierCommandHandler(prisma, eventBus));
    bus.register(new UpdateCarrierCommandHandler(prisma, eventBus));
    bus.register(new ArchiveCarrierCommandHandler(prisma, eventBus));

    // Customer commands
    bus.register(new CreateCustomerCommandHandler(prisma, eventBus));
    bus.register(new UpdateCustomerCommandHandler(prisma, eventBus));
    bus.register(new ArchiveCustomerCommandHandler(prisma, eventBus));

    // Location commands
    bus.register(new CreateLocationCommandHandler(prisma, eventBus));
    bus.register(new UpdateLocationCommandHandler(prisma, eventBus));

    // Lane commands
    bus.register(new CreateLaneCommandHandler(prisma, eventBus));
    bus.register(new UpdateLaneCommandHandler(prisma, eventBus));
    bus.register(new ArchiveLaneCommandHandler(prisma, eventBus));

    // Issue commands
    bus.register(new CreateIssueCommandHandler(prisma, eventBus));
    bus.register(new UpdateIssueCommandHandler(prisma, eventBus));
    bus.register(new EscalateIssueCommandHandler(prisma, eventBus));

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
    bus.register(new CreateColdChainProfileCommandHandler(prisma, eventBus));
    bus.register(new UpdateColdChainProfileCommandHandler(prisma, eventBus));
    bus.register(new AcknowledgeExcursionCommandHandler(prisma, eventBus));
    bus.register(new ResolveExcursionCommandHandler(prisma, eventBus));
    bus.register(new SetDispositionCommandHandler(prisma, eventBus));
    bus.register(new RecordCalibrationCommandHandler(prisma, eventBus));

    // CAPA commands
    bus.register(new CreateCAPACommandHandler(prisma, eventBus));
    bus.register(new UpdateCAPACommandHandler(prisma, eventBus));

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

    // Financial commands
    bus.register(new CreateChargeCommandHandler(prisma, eventBus));
    bus.register(new ApproveChargeCommandHandler(prisma, eventBus));

    // Invoice commands
    bus.register(new CreateInvoiceCommandHandler(prisma, eventBus));
    bus.register(new ApproveInvoiceCommandHandler(prisma, eventBus));
    bus.register(new SendInvoiceCommandHandler(prisma, eventBus));
    bus.register(new RecordPaymentCommandHandler(prisma, eventBus));
    bus.register(new VoidInvoiceCommandHandler(prisma, eventBus));

    // Carrier invoice commands
    bus.register(new ReceiveCarrierInvoiceCommandHandler(prisma, eventBus));
    bus.register(new ApproveCarrierInvoiceCommandHandler(prisma, eventBus));
    bus.register(new RecordCarrierPaymentCommandHandler(prisma, eventBus));

    // Financial query commands
    bus.register(new RaiseQueryCommandHandler(prisma, eventBus));
    bus.register(new ResolveQueryCommandHandler(prisma, eventBus));

    // Quote commands
    bus.register(new CreateQuoteCommandHandler(prisma, eventBus));
    bus.register(new AcceptQuoteCommandHandler(prisma, eventBus));
    bus.register(new DeclineQuoteCommandHandler(prisma, eventBus));
    bus.register(new ReviseQuoteCommandHandler(prisma, eventBus));
    bus.register(new ReweighAdjustmentCommandHandler(prisma, eventBus));

    // Quality Centre commands
    bus.register(new CreateCAPAFollowUpCommandHandler(prisma, eventBus));
    bus.register(new CompleteCAPAFollowUpCommandHandler(prisma, eventBus));
    bus.register(new CreateSOPChecklistCommandHandler(prisma, eventBus));
    bus.register(new StartSOPAuditCommandHandler(prisma, eventBus));
    bus.register(new CompleteSOPAuditCommandHandler(prisma, eventBus));

    // WMS commands
    bus.register(new CreateWarehouseZoneCommandHandler(prisma, eventBus));
    bus.register(new UpdateWarehouseZoneCommandHandler(prisma, eventBus));
    bus.register(new CreateWarehouseBinCommandHandler(prisma, eventBus));
    bus.register(new UpdateWarehouseBinCommandHandler(prisma, eventBus));
    bus.register(new BulkCreateBinsCommandHandler(prisma, eventBus));

    // WMS Receiving commands
    bus.register(new CreateReceivingTaskCommandHandler(prisma, eventBus));
    bus.register(new RecordReceivingLineCommandHandler(prisma, eventBus));
    bus.register(new CompleteReceivingCommandHandler(prisma, eventBus));

    // WMS Putaway commands
    bus.register(new AssignPutawayTaskCommandHandler(prisma, eventBus));
    bus.register(new CompletePutawayCommandHandler(prisma, eventBus));

    // WMS Inventory commands
    bus.register(new AdjustInventoryCommandHandler(prisma, eventBus));
    bus.register(new TransferInventoryCommandHandler(prisma, eventBus));

    // WMS Wave & Pick commands
    bus.register(new CreateWaveCommandHandler(prisma, eventBus));
    bus.register(new ReleaseWaveCommandHandler(prisma, eventBus));
    bus.register(new CompletePickLineCommandHandler(prisma, eventBus));

    // WMS Packing & Loading commands
    bus.register(new CreatePackTaskCommandHandler(prisma, eventBus));
    bus.register(new CompletePackLineCommandHandler(prisma, eventBus));
    bus.register(new CreateStagingAssignmentCommandHandler(prisma, eventBus));
    bus.register(new CompleteLoadingCommandHandler(prisma, eventBus));

    // WMS Cycle Counting commands
    bus.register(new CreateCycleCountCommandHandler(prisma, eventBus));
    bus.register(new RecordCycleCountLineCommandHandler(prisma, eventBus));

    // WMS Replenishment commands
    bus.register(new CreateReplenishmentRuleCommandHandler(prisma, eventBus));
    bus.register(new CheckReplenishmentCommandHandler(prisma, eventBus));

    // WMS Wave Template commands
    bus.register(new CreateWaveTemplateCommandHandler(prisma, eventBus));
    bus.register(new ApplyWaveTemplateCommandHandler(prisma, eventBus));

    return bus;
  });

  // Register built-in skills (after CommandBus is available)
  {
    const registry = container.resolve<SkillRegistry>(TOKENS.ISkillRegistry);
    const commandBus = container.resolve<import('../commands/CommandBus.js').ICommandBus>(TOKENS.ICommandBus);
    registry.register(new CreateIssueSkill(commandBus));
    registry.register(new EscalateIssueSkill(commandBus));
    registry.register(new AddCommentSkill(prisma));
    registry.register(new ContactDriverSkill(prisma));
    registry.register(new CallWebhookSkill());

    // SendEmailSkill only if email service is available
    if (container.has(TOKENS.IEmailService)) {
      const emailService = container.resolve<import('../services/IEmailService.js').IEmailService>(TOKENS.IEmailService);
      registry.register(new SendEmailSkill(emailService));
    }
  }
}
