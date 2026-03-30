/**
 * Registers all event handlers with the event bus.
 * Called by the worker process on startup.
 */

import { PrismaClient } from '@prisma/client';
import { IEventBus } from './IEventBus.js';
import { IEventHandler } from './IEventHandler.js';
import { AuditHandler } from './handlers/AuditHandler.js';
import { InAppNotificationHandler } from './handlers/InAppNotificationHandler.js';

export async function registerEventHandlers(
  eventBus: IEventBus,
  prisma: PrismaClient
): Promise<void> {
  const handlers: IEventHandler[] = [
    new AuditHandler(),
    new InAppNotificationHandler(prisma),
    // Future handlers:
    // new EmailHandler(prisma, emailService),
    // new WebhookHandler(prisma),
    // new TriageHandler(prisma),
  ];

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
