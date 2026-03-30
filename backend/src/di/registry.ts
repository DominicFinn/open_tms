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

  container.singleton(TOKENS.IOrderDeliveryService).toFactory(() => {
    return new OrderDeliveryService(container.resolve(TOKENS.PrismaClient));
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

  // Queue adapter
  container.singleton(TOKENS.IQueueAdapter).toFactory(() => {
    const dbUrl = process.env.DATABASE_URL || '';
    return new PgBossQueueAdapter(dbUrl);
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
      container.resolve(TOKENS.ILocationsRepository)
    );
  });
}
