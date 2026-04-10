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
import { LocationResolutionService } from '../services/LocationResolutionService.js';
import { ArrivalCriteriaEvaluationService } from '../services/ArrivalCriteriaEvaluationService.js';
import { ShipmentAssignmentService } from '../services/ShipmentAssignmentService.js';
import { CSVImportService } from '../services/CSVImportService.js';
import { OrderDeliveryService } from '../services/OrderDeliveryService.js';
import { EDI850ParseService } from '../services/EDI850ParseService.js';
import { EdiImportService } from '../services/EdiImportService.js';
import { OrderConversionService } from '../services/OrderConversionService.js';
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
import { TenderRepository } from '../repositories/TenderRepository.js';
import { CarrierUserRepository } from '../repositories/CarrierUserRepository.js';
import { TenderService } from '../services/TenderService.js';
import { CarrierAuthService } from '../services/CarrierAuthService.js';
import { TradingPartnerRepository } from '../repositories/TradingPartnerRepository.js';
import { EdiRouterService } from '../services/EdiRouterService.js';
import { OutboundEdiDeliveryService } from '../services/OutboundEdiDeliveryService.js';
import { EDI997Service } from '../services/EDI997Service.js';

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

  container.singleton(TOKENS.IOrderConversionService).toFactory(() => {
    return new OrderConversionService(container.resolve(TOKENS.PrismaClient));
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
}
