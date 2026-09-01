/**
 * Core: tenancy, identity, storage, email, queue, events, and the issue engine.
 *
 * Module: core. Registered by di/registry.ts, which is the composition root.
 * See .claude/rules/module-boundaries.md for what this module may depend on.
 */

import { PrismaClient } from '@prisma/client';
import { container } from '../container.js';
import { TOKENS } from '../tokens.js';
import { CommandBus } from '../../commands/CommandBus.js';
import type { CommandHandlerDeps } from '../moduleRegistration.js';
import { CustomersRepository } from '../../repositories/CustomersRepository.js';
import { LocationsRepository } from '../../repositories/LocationsRepository.js';
import { OrganizationRepository } from '../../repositories/OrganizationRepository.js';
import { LocationResolutionService } from '../../services/LocationResolutionService.js';
import { DatabaseFileStorage } from '../../storage/DatabaseFileStorage.js';
import { DatabaseBinaryStorage } from '../../storage/DatabaseBinaryStorage.js';
import { S3FileStorage } from '../../storage/S3FileStorage.js';
import { AttachmentRepository } from '../../repositories/AttachmentRepository.js';
import { CustomFieldService } from '../../services/CustomFieldService.js';
import { PgBossQueueAdapter } from '../../queue/PgBossQueueAdapter.js';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { SmtpEmailService } from '../../services/SmtpEmailService.js';
import { ConsoleEmailService } from '../../services/ConsoleEmailService.js';
import { CreateCustomerCommandHandler } from '../../commands/customers/CreateCustomerCommand.js';
import { UpdateCustomerCommandHandler } from '../../commands/customers/UpdateCustomerCommand.js';
import { ArchiveCustomerCommandHandler } from '../../commands/customers/ArchiveCustomerCommand.js';
import { CreateLocationCommandHandler } from '../../commands/locations/CreateLocationCommand.js';
import { UpdateLocationCommandHandler } from '../../commands/locations/UpdateLocationCommand.js';
import { CreateIssueCommandHandler } from '../../commands/issues/CreateIssueCommand.js';
import { UpdateIssueCommandHandler } from '../../commands/issues/UpdateIssueCommand.js';
import { EscalateIssueCommandHandler } from '../../commands/issues/EscalateIssueCommand.js';
import { AddIssueLabelCommandHandler } from '../../commands/issues/AddIssueLabelCommand.js';
import { RemoveIssueLabelCommandHandler } from '../../commands/issues/RemoveIssueLabelCommand.js';
import {
  CreateIssueLabelCommandHandler,
  UpdateIssueLabelCommandHandler,
  DeleteIssueLabelCommandHandler,
} from '../../commands/issueLabels/index.js';
import {
  CreateCommentCommandHandler,
  UpdateCommentCommandHandler,
  DeleteCommentCommandHandler,
} from '../../commands/comments/index.js';
import {
  CreateApiKeyCommandHandler,
  UpdateApiKeyCommandHandler,
  DeleteApiKeyCommandHandler,
} from '../../commands/apiKeys/index.js';
import {
  CreateCustomerWebhookCommandHandler,
  UpdateCustomerWebhookCommandHandler,
  DeleteCustomerWebhookCommandHandler,
  RotateWebhookSecretCommandHandler,
} from '../../commands/customerWebhooks/index.js';
import { AuthService } from '../../services/AuthService.js';
import { CustomerUserRepository } from '../../repositories/CustomerUserRepository.js';
import { CustomerAuthService } from '../../services/CustomerAuthService.js';
import { IssueRepository } from '../../repositories/IssueRepository.js';
import { TriageRepository } from '../../repositories/TriageRepository.js';
import { IBinaryStorageProvider } from '../../storage/IBinaryStorageProvider.js';

export function registerCoreDependencies(prisma: PrismaClient): void {
  // Register repositories as singletons (they're stateless, so we can reuse instances)
  container.singleton(TOKENS.ICustomersRepository).toFactory(() => {
    return new CustomersRepository(container.resolve(TOKENS.PrismaClient));
  });

  container.singleton(TOKENS.ILocationsRepository).toFactory(() => {
    return new LocationsRepository(container.resolve(TOKENS.PrismaClient));
  });

  container.singleton(TOKENS.IOrganizationRepository).toFactory(() => {
    return new OrganizationRepository(container.resolve(TOKENS.PrismaClient));
  });

  container.singleton(TOKENS.ILocationResolutionService).toFactory(() => {
    return new LocationResolutionService(
      container.resolve(TOKENS.PrismaClient),
      container.resolve(TOKENS.ILocationsRepository),
      container.resolve(TOKENS.IArrivalCriteriaRepository),
      container.resolve(TOKENS.IEventBus)
    );
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

  container.singleton(TOKENS.IIssueRepository).toFactory(() => {
    return new IssueRepository(container.resolve(TOKENS.PrismaClient));
  });

  container.singleton(TOKENS.ITriageRepository).toFactory(() => {
    return new TriageRepository(container.resolve(TOKENS.PrismaClient));
  });

  container.singleton(TOKENS.IAuthService).toFactory(() => {
    return new AuthService(container.resolve(TOKENS.PrismaClient));
  });

  // Customer Portal
  container.singleton(TOKENS.ICustomerUserRepository).toFactory(() => {
    return new CustomerUserRepository(container.resolve(TOKENS.PrismaClient));
  });

  container.singleton(TOKENS.ICustomerAuthService).toFactory(() => {
    return new CustomerAuthService(container.resolve(TOKENS.ICustomerUserRepository));
  });
}

export function registerCoreCommandHandlers(bus: CommandBus, deps: CommandHandlerDeps): void {
  const { prisma, eventBus } = deps;
  // Customer commands
  bus.register(new CreateCustomerCommandHandler(prisma, eventBus));
  bus.register(new UpdateCustomerCommandHandler(prisma, eventBus));
  bus.register(new ArchiveCustomerCommandHandler(prisma, eventBus));

  // Location commands
  bus.register(new CreateLocationCommandHandler(prisma, eventBus));
  bus.register(new UpdateLocationCommandHandler(prisma, eventBus));

  // Issue commands
  bus.register(new CreateIssueCommandHandler(prisma, eventBus));
  bus.register(new UpdateIssueCommandHandler(prisma, eventBus));
  bus.register(new EscalateIssueCommandHandler(prisma, eventBus));
  bus.register(new AddIssueLabelCommandHandler(prisma, eventBus));
  bus.register(new RemoveIssueLabelCommandHandler(prisma, eventBus));

  // Issue label catalogue commands
  bus.register(new CreateIssueLabelCommandHandler(prisma, eventBus));
  bus.register(new UpdateIssueLabelCommandHandler(prisma, eventBus));
  bus.register(new DeleteIssueLabelCommandHandler(prisma, eventBus));

  // Comment commands (polymorphic: issues, shipments, orders, etc.)
  bus.register(new CreateCommentCommandHandler(prisma, eventBus));
  bus.register(new UpdateCommentCommandHandler(prisma, eventBus));
  bus.register(new DeleteCommentCommandHandler(prisma, eventBus));

  // API key commands
  bus.register(new CreateApiKeyCommandHandler(prisma, eventBus));
  bus.register(new UpdateApiKeyCommandHandler(prisma, eventBus));
  bus.register(new DeleteApiKeyCommandHandler(prisma, eventBus));

  // Customer-owned webhook commands
  bus.register(new CreateCustomerWebhookCommandHandler(prisma, eventBus));
  bus.register(new UpdateCustomerWebhookCommandHandler(prisma, eventBus));
  bus.register(new DeleteCustomerWebhookCommandHandler(prisma, eventBus));
  bus.register(new RotateWebhookSecretCommandHandler(prisma, eventBus));
}
