/**
 * Registers all event handlers with the event bus.
 * Called by the worker process on startup.
 */

import { PrismaClient } from '@prisma/client';
import { IEventBus } from './IEventBus.js';
import { IEventHandler } from './IEventHandler.js';
import { IEmailService } from '../services/IEmailService.js';
import { AuditHandler } from './handlers/AuditHandler.js';
import { InAppNotificationHandler } from './handlers/InAppNotificationHandler.js';
import { EmailHandler } from './handlers/EmailHandler.js';

export async function registerEventHandlers(
  eventBus: IEventBus,
  prisma: PrismaClient,
  emailService?: IEmailService
): Promise<void> {
  const handlers: IEventHandler[] = [
    new AuditHandler(),
    new InAppNotificationHandler(prisma),
    // Future handlers:
    // new WebhookHandler(prisma),
    // new TriageHandler(prisma),
  ];

  // Add email handler if email service is available
  if (emailService) {
    handlers.push(new EmailHandler(prisma, emailService));
  }

  for (const handler of handlers) {
    await eventBus.subscribe(
      handler.name,
      handler.eventPatterns,
      (event) => handler.handle(event),
      handler.options
    );
    console.log(`[EventBus] Registered handler: ${handler.name} (patterns: ${handler.eventPatterns.join(', ')})`);
  }
}
