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
import { OrderProjection } from './projections/OrderProjection.js';
import { ShipmentProjection } from './projections/ShipmentProjection.js';
import { CarrierProjection } from './projections/CarrierProjection.js';
import { CustomerProjection } from './projections/CustomerProjection.js';
import { LaneProjection } from './projections/LaneProjection.js';
import { IssueProjection } from './projections/IssueProjection.js';

/** Read concurrency from env with a default */
function envInt(key: string, fallback: number): number {
  const val = process.env[key];
  return val ? parseInt(val, 10) : fallback;
}

/**
 * Concurrency overrides via environment variables.
 * Set PROJECTION_CONCURRENCY, AUDIT_CONCURRENCY, or EMAIL_CONCURRENCY
 * to tune handler throughput per worker instance.
 */
const CONCURRENCY_OVERRIDES: Record<string, () => number> = {
  'audit': () => envInt('AUDIT_CONCURRENCY', 5),
  'projection.order': () => envInt('PROJECTION_CONCURRENCY', 3),
  'projection.shipment': () => envInt('PROJECTION_CONCURRENCY', 3),
  'projection.carrier': () => envInt('PROJECTION_CONCURRENCY', 3),
  'projection.customer': () => envInt('PROJECTION_CONCURRENCY', 3),
  'projection.lane': () => envInt('PROJECTION_CONCURRENCY', 3),
  'projection.issue': () => envInt('PROJECTION_CONCURRENCY', 3),
  'notification.email': () => envInt('EMAIL_CONCURRENCY', 2),
};

export async function registerEventHandlers(
  eventBus: IEventBus,
  prisma: PrismaClient,
  emailService?: IEmailService
): Promise<void> {
  const handlers: IEventHandler[] = [
    new AuditHandler(),
    new InAppNotificationHandler(prisma),
    // CQRS read model projections
    new OrderProjection(prisma),
    new ShipmentProjection(prisma),
    new CarrierProjection(prisma),
    new CustomerProjection(prisma),
    new LaneProjection(prisma),
    new IssueProjection(prisma),
  ];

  // Add email handler if email service is available
  if (emailService) {
    handlers.push(new EmailHandler(prisma, emailService));
  }

  for (const handler of handlers) {
    // Apply env-based concurrency overrides
    const options = { ...handler.options };
    const override = CONCURRENCY_OVERRIDES[handler.name];
    if (override) {
      options.concurrency = override();
    }

    await eventBus.subscribe(
      handler.name,
      handler.eventPatterns,
      (event) => handler.handle(event),
      options
    );
    console.log(`[EventBus] Registered handler: ${handler.name} (concurrency: ${options.concurrency ?? 'default'}, patterns: ${handler.eventPatterns.join(', ')})`);
  }
}
