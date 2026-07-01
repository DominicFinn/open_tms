/**
 * CarrierArchivalNotificationHandler — when a carrier is archived or deleted on
 * Open TMS, its portal users are notified that the account is being wound down.
 *
 * The email delivery itself is intentionally STUBBED (see dispatchEmail below) —
 * wiring a real email provider is future work. What IS implemented is the
 * decision of *who* gets messaged and an auditable record that the notification
 * was dispatched, emitted as a `carrier.users_notified` domain event.
 */

import { PrismaClient } from '@prisma/client';
import { DomainEvent } from '../DomainEvent.js';
import { IEventHandler } from '../IEventHandler.js';
import { EVENT_TYPES } from '../eventTypes.js';
import { IEventBus, SubscribeOptions } from '../IEventBus.js';
import { createEvent } from '../createEvent.js';

export class CarrierArchivalNotificationHandler implements IEventHandler {
  readonly name = 'handler.carrier_archival_notification';
  readonly eventPatterns = [EVENT_TYPES.CARRIER_ARCHIVED, EVENT_TYPES.CARRIER_DELETED];
  readonly options: SubscribeOptions = {
    concurrency: 2,
    priority: 5,
    retryLimit: 3,
    expireInSeconds: 60,
  };

  constructor(
    private prisma: PrismaClient,
    private eventBus: IEventBus,
  ) {}

  async handle(event: DomainEvent): Promise<void> {
    const carrierId = event.entityId;
    const reason = event.type === EVENT_TYPES.CARRIER_DELETED ? 'deleted' : 'archived';

    const carrier = await this.prisma.carrier.findUnique({
      where: { id: carrierId },
      select: { id: true, name: true },
    });
    if (!carrier) return;

    // All portal users for this carrier (including now-inactive ones — they
    // should still be told why their access was removed). Anonymised users have
    // no real address to reach and are skipped.
    const users = await this.prisma.carrierUser.findMany({
      where: { carrierId, anonymizedAt: null },
      select: { id: true, email: true, name: true },
    });
    if (users.length === 0) return;

    for (const user of users) {
      await this.dispatchEmail(user.email, user.name, carrier.name, reason);
    }

    // Auditable record of the dispatch (who was notified, and why).
    await this.eventBus.publish(createEvent({
      type: EVENT_TYPES.CARRIER_USERS_NOTIFIED,
      orgId: event.orgId,
      actorId: 'system',
      entityType: 'carrier',
      entityId: carrierId,
      payload: {
        carrierName: carrier.name,
        reason,
        channel: 'email',
        delivery: 'stubbed',
        recipientCount: users.length,
        recipients: users.map((u) => u.email),
      },
      source: 'carrier_archival_notification_handler',
    }));
  }

  /**
   * STUB. Replace with a real email provider (see SendEmailSkill / an
   * IEmailProvider) when email is wired up. Intentionally a no-op that only
   * logs, so archival works today without an outbound mail dependency.
   */
  private async dispatchEmail(to: string, name: string, carrierName: string, reason: string): Promise<void> {
    // TODO(email): send via the configured email provider.
    console.info(
      `[CarrierArchivalNotification] (stub) would email ${name} <${to}>: ` +
      `carrier "${carrierName}" is being ${reason} on Open TMS.`
    );
  }
}
