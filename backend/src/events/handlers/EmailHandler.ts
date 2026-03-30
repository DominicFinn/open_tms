/**
 * EmailHandler — sends email notifications for domain events.
 *
 * Flow:
 * 1. Receives domain event from pg-boss queue (evt.notification.email)
 * 2. Checks org has email enabled
 * 3. Finds matching EmailTemplate (custom or default)
 * 4. Checks UserNotificationPreference for email opt-in
 * 5. Renders template with event payload
 * 6. Sends via IEmailService (SMTP, SendGrid, SES, or console)
 *
 * Deduplication: uses pg-boss singletonKey = `email-${event.id}` to prevent
 * double-sends on retry.
 */

import { PrismaClient } from '@prisma/client';
import { DomainEvent } from '../DomainEvent.js';
import { IEventHandler } from '../IEventHandler.js';
import { SubscribeOptions } from '../IEventBus.js';
import { IEmailService } from '../../services/IEmailService.js';
import { EmailTemplateRenderer } from '../../services/EmailTemplateRenderer.js';

export class EmailHandler implements IEventHandler {
  readonly name = 'notification.email';
  readonly eventPatterns = [
    'shipment.status_changed',
    'shipment.created',
    'shipment.exception',
    'shipment.delivered',
    'order.status_changed',
    'order.exception',
    'order.delivered',
  ];
  readonly options: SubscribeOptions = {
    concurrency: 2,
    priority: 3,
    retryLimit: 3,
    expireInSeconds: 300,
  };

  private renderer = new EmailTemplateRenderer();

  constructor(
    private prisma: PrismaClient,
    private emailService: IEmailService
  ) {}

  async handle(event: DomainEvent): Promise<void> {
    // 1. Get org and check if email is enabled
    const org = await this.prisma.organization.findFirst({
      where: { id: event.orgId },
      select: {
        id: true,
        name: true,
        emailEnabled: true,
        emailFromAddress: true,
        emailFromName: true,
        logoStorageKey: true,
        themeConfig: true,
      },
    });

    if (!org) {
      console.log(`[EmailHandler] Org ${event.orgId} not found, skipping`);
      return;
    }

    if (!org.emailEnabled) {
      console.log(`[EmailHandler] Email disabled for org ${org.name}, skipping`);
      return;
    }

    // 2. Find custom template or fall back to defaults
    const customTemplate = await this.prisma.emailTemplate.findFirst({
      where: {
        organizationId: org.id,
        eventType: event.type,
        active: true,
      },
    });

    // 3. Get branding info
    const themeConfig = org.themeConfig as Record<string, string> | null;
    const branding = {
      orgName: org.name,
      primaryColor: themeConfig?.['--color-primary'] || '#1976d2',
    };

    // 4. Render the email
    const rendered = this.renderer.render(
      event,
      branding,
      customTemplate ? {
        subject: customTemplate.subject,
        htmlBody: customTemplate.htmlBody,
        textBody: customTemplate.textBody,
      } : undefined
    );

    if (!rendered) {
      console.log(`[EmailHandler] No template for event type ${event.type}, skipping`);
      return;
    }

    // 5. Find recipients — users in org who have email notifications enabled
    const users = await this.prisma.user.findMany({
      where: { organizationId: event.orgId, active: true },
      select: { id: true, email: true },
    });

    if (users.length === 0) return;

    // Check per-user preferences
    const eventCategory = event.type.split('.')[0]; // "shipment", "order", etc.
    const preferences = await this.prisma.userNotificationPreference.findMany({
      where: {
        userId: { in: users.map((u) => u.id) },
        eventCategory,
      },
    });

    const prefMap = new Map(preferences.map((p) => [p.userId, p]));
    const recipients = users.filter((user) => {
      const pref = prefMap.get(user.id);
      // Default: email enabled if no preference record exists
      return pref ? pref.emailEnabled : true;
    });

    if (recipients.length === 0) {
      console.log(`[EmailHandler] No opted-in recipients for ${event.type}`);
      return;
    }

    // 6. Send emails
    const fromAddress = org.emailFromAddress || 'noreply@opentms.local';
    const messages = recipients.map((user) => ({
      to: user.email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      from: org.emailFromName
        ? `"${org.emailFromName}" <${fromAddress}>`
        : fromAddress,
    }));

    const results = await this.emailService.sendBatch(messages);
    const sent = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    console.log(`[EmailHandler] ${event.type}: sent=${sent} failed=${failed}`);

    if (failed > 0) {
      const errors = results.filter((r) => !r.success).map((r) => r.error);
      console.warn(`[EmailHandler] Failures: ${errors.join('; ')}`);
    }
  }
}
