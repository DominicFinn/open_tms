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
import { TradingPartnerRepository } from '../repositories/TradingPartnerRepository.js';
import { EdiRouterService } from '../services/EdiRouterService.js';
import { OutboundEdiDeliveryService } from '../services/OutboundEdiDeliveryService.js';
import { EDI997Service } from '../services/EDI997Service.js';
import { EDI214ParseService } from '../services/EDI214ParseService.js';
import { EDI214Service } from '../services/EDI214Service.js';
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
import { HereRoutingProvider } from '../services/routing/HereRoutingProvider.js';
import { TomTomRoutingProvider } from '../services/routing/TomTomRoutingProvider.js';
import { ValhallaRoutingProvider } from '../services/routing/ValhallaRoutingProvider.js';
import { ShipmentEtaMonitorService } from '../services/routing/ShipmentEtaMonitorService.js';

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
      container.resolve(TOKENS.IArrivalCriteriaRepository)
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

  // Wire up cargo reconciliation into the delivery service (post-construction to avoid circular deps)
  {
    const deliveryService = container.resolve<OrderDeliveryService>(TOKENS.IOrderDeliveryService);
    const cargoService = container.resolve<CargoReconciliationService>(TOKENS.ICargoReconciliationService);
    deliveryService.setCargoReconciliationService(cargoService);
  }

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
      container.resolve(TOKENS.ILocationResolutionService)
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
      );
    });
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

    return bus;
  });
}
