/**
 * Dependency Injection Tokens
 * Symbols used to identify dependencies in the container
 */

// Repository tokens
export const TOKENS = {
  ICustomersRepository: Symbol.for('ICustomersRepository'),
  ICarriersRepository: Symbol.for('ICarriersRepository'),
  ILocationsRepository: Symbol.for('ILocationsRepository'),
  IShipmentsRepository: Symbol.for('IShipmentsRepository'),
  ILanesRepository: Symbol.for('ILanesRepository'),
  IOrdersRepository: Symbol.for('IOrdersRepository'),
  IOrganizationRepository: Symbol.for('IOrganizationRepository'),
  IPendingLaneRequestsRepository: Symbol.for('IPendingLaneRequestsRepository'),

  IArrivalCriteriaRepository: Symbol.for('IArrivalCriteriaRepository'),
  ICargoTrackingRepository: Symbol.for('ICargoTrackingRepository'),

  // Service tokens
  ILocationResolutionService: Symbol.for('ILocationResolutionService'),
  IArrivalCriteriaEvaluationService: Symbol.for('IArrivalCriteriaEvaluationService'),
  IShipmentAssignmentService: Symbol.for('IShipmentAssignmentService'),
  ICSVImportService: Symbol.for('ICSVImportService'),
  IOrderDeliveryService: Symbol.for('IOrderDeliveryService'),
  IEDI850ParseService: Symbol.for('IEDI850ParseService'),
  IEdiImportService: Symbol.for('IEdiImportService'),
  IOrderConversionService: Symbol.for('IOrderConversionService'),
  ICargoReconciliationService: Symbol.for('ICargoReconciliationService'),

  // Document tokens
  IDocumentTemplateRepository: Symbol.for('IDocumentTemplateRepository'),
  IGeneratedDocumentRepository: Symbol.for('IGeneratedDocumentRepository'),
  IDocumentGenerationService: Symbol.for('IDocumentGenerationService'),
  IDailyReportService: Symbol.for('IDailyReportService'),

  // Attachment tokens
  IAttachmentRepository: Symbol.for('IAttachmentRepository'),

  // Custom fields tokens
  ICustomFieldService: Symbol.for('ICustomFieldService'),

  // Email tokens
  IEmailService: Symbol.for('IEmailService'),

  // Command bus
  ICommandBus: Symbol.for('ICommandBus'),

  // Tender tokens
  ITenderRepository: Symbol.for('ITenderRepository'),
  ICarrierUserRepository: Symbol.for('ICarrierUserRepository'),
  ITenderService: Symbol.for('ITenderService'),
  ICarrierAuthService: Symbol.for('ICarrierAuthService'),
  IEDI204Service: Symbol.for('IEDI204Service'),
  IEDI990ParseService: Symbol.for('IEDI990ParseService'),

  // Cold Chain & Compliance tokens
  IColdChainRepository: Symbol.for('IColdChainRepository'),
  IColdChainService: Symbol.for('IColdChainService'),
  IComplianceReportService: Symbol.for('IComplianceReportService'),

  // Trading Partner / EDI Hub tokens
  ITradingPartnerRepository: Symbol.for('ITradingPartnerRepository'),
  IEdiRouterService: Symbol.for('IEdiRouterService'),
  IOutboundEdiDeliveryService: Symbol.for('IOutboundEdiDeliveryService'),
  IEDI997Service: Symbol.for('IEDI997Service'),
  IEDI214ParseService: Symbol.for('IEDI214ParseService'),
  IEDI214Service: Symbol.for('IEDI214Service'),

  // SLA tokens
  ISlaRepository: Symbol.for('ISlaRepository'),
  ISlaEvaluationService: Symbol.for('ISlaEvaluationService'),

  // Routing & ETA monitoring tokens
  IRoutingProvider: Symbol.for('IRoutingProvider'),
  IShipmentEtaMonitorService: Symbol.for('IShipmentEtaMonitorService'),

  // Agent Decision tokens
  IAgentDecisionRepository: Symbol.for('IAgentDecisionRepository'),
  IIssueRepository: Symbol.for('IIssueRepository'),

  // LLM tokens
  ILlmProvider: Symbol.for('ILlmProvider'),

  // Skills tokens
  ISkillRegistry: Symbol.for('ISkillRegistry'),

  // Financial tokens
  IChargeRepository: Symbol.for('IChargeRepository'),
  IChargeService: Symbol.for('IChargeService'),
  IRatingService: Symbol.for('IRatingService'),
  IInvoiceRepository: Symbol.for('IInvoiceRepository'),
  IPaymentRepository: Symbol.for('IPaymentRepository'),
  IInvoicingService: Symbol.for('IInvoicingService'),
  ICarrierInvoiceRepository: Symbol.for('ICarrierInvoiceRepository'),
  IFreightAuditService: Symbol.for('IFreightAuditService'),
  IFinancialQueryRepository: Symbol.for('IFinancialQueryRepository'),
  ICreditNoteRepository: Symbol.for('ICreditNoteRepository'),
  IQuoteRepository: Symbol.for('IQuoteRepository'),
  ILtlRatingService: Symbol.for('ILtlRatingService'),

  // Infrastructure tokens
  PrismaClient: Symbol.for('PrismaClient'),
  IFileStorageProvider: Symbol.for('IFileStorageProvider'),
  IBinaryStorageProvider: Symbol.for('IBinaryStorageProvider'),
  IQueueAdapter: Symbol.for('IQueueAdapter'),
  IEventBus: Symbol.for('IEventBus'),
} as const;
