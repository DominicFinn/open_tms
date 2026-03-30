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

  // Service tokens
  IShipmentAssignmentService: Symbol.for('IShipmentAssignmentService'),
  ICSVImportService: Symbol.for('ICSVImportService'),
  IOrderDeliveryService: Symbol.for('IOrderDeliveryService'),
  IEDI850ParseService: Symbol.for('IEDI850ParseService'),
  IEdiImportService: Symbol.for('IEdiImportService'),
  IOrderConversionService: Symbol.for('IOrderConversionService'),

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

  // Infrastructure tokens
  PrismaClient: Symbol.for('PrismaClient'),
  IFileStorageProvider: Symbol.for('IFileStorageProvider'),
  IBinaryStorageProvider: Symbol.for('IBinaryStorageProvider'),
  IQueueAdapter: Symbol.for('IQueueAdapter'),
  IEventBus: Symbol.for('IEventBus'),
} as const;
