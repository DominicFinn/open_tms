/**
 * EmailTemplateRenderer — renders Handlebars email templates with event data.
 *
 * Provides:
 * - Template rendering with Handlebars
 * - Base layout wrapping (logo, branding from org theme)
 * - Default templates for each event type (used when no custom template exists)
 * - Plain-text auto-generation from HTML
 */

import Handlebars from 'handlebars';
import { DomainEvent } from '../events/DomainEvent.js';

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

interface OrgBranding {
  orgName: string;
  logoUrl?: string;
  primaryColor?: string;
}

/** Strip HTML tags for plain-text fallback */
function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Wraps email content in a branded base layout */
function wrapInBaseLayout(content: string, branding: OrgBranding): string {
  const primaryColor = branding.primaryColor || '#1976d2';
  const logoHtml = branding.logoUrl
    ? `<img src="${branding.logoUrl}" alt="${branding.orgName}" style="max-height:40px;max-width:200px;" />`
    : `<span style="font-size:18px;font-weight:600;color:${primaryColor};">${branding.orgName}</span>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <!-- Header -->
        <tr><td style="padding:20px 24px;border-bottom:2px solid ${primaryColor};">
          ${logoHtml}
        </td></tr>
        <!-- Content -->
        <tr><td style="padding:24px;">
          ${content}
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:16px 24px;border-top:1px solid #e0e0e0;color:#757575;font-size:12px;">
          Sent by ${branding.orgName} via Open TMS
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** Default templates for event types when no custom template exists */
const DEFAULT_TEMPLATES: Record<string, { subject: string; body: string }> = {
  'shipment.status_changed': {
    subject: 'Shipment {{shipmentReference}} — Status: {{newStatus}}',
    body: `<h2 style="margin:0 0 16px;">Shipment Status Update</h2>
<p>Shipment <strong>{{shipmentReference}}</strong> has changed status:</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <tr><td style="padding:8px 12px;background:#f5f5f5;font-weight:600;width:120px;">Previous</td><td style="padding:8px 12px;">{{previousStatus}}</td></tr>
  <tr><td style="padding:8px 12px;background:#f5f5f5;font-weight:600;">New Status</td><td style="padding:8px 12px;">{{newStatus}}</td></tr>
</table>`,
  },
  'shipment.created': {
    subject: 'New Shipment Created — {{shipmentReference}}',
    body: `<h2 style="margin:0 0 16px;">New Shipment</h2>
<p>A new shipment <strong>{{shipmentReference}}</strong> has been created with status <strong>{{status}}</strong>.</p>`,
  },
  'shipment.delivered': {
    subject: 'Shipment {{shipmentReference}} — Delivered',
    body: `<h2 style="margin:0 0 16px;">Shipment Delivered</h2>
<p>Shipment <strong>{{shipmentReference}}</strong> has been delivered at <strong>{{deliveredAt}}</strong>.</p>`,
  },
  'shipment.exception': {
    subject: '⚠ Shipment {{shipmentReference}} — Exception',
    body: `<h2 style="margin:0 0 16px;color:#d32f2f;">Shipment Exception</h2>
<p>An exception has occurred on shipment <strong>{{shipmentReference}}</strong>:</p>
<p style="padding:12px;background:#fff3f3;border-left:4px solid #d32f2f;border-radius:4px;">{{description}}</p>`,
  },
  'order.status_changed': {
    subject: 'Order {{orderReference}} — Status: {{newStatus}}',
    body: `<h2 style="margin:0 0 16px;">Order Status Update</h2>
<p>Order <strong>{{orderReference}}</strong> has changed status from <strong>{{previousStatus}}</strong> to <strong>{{newStatus}}</strong>.</p>`,
  },
  'order.delivered': {
    subject: 'Order {{orderReference}} — Delivered',
    body: `<h2 style="margin:0 0 16px;">Order Delivered</h2>
<p>Order <strong>{{orderReference}}</strong> has been delivered.</p>`,
  },
  'order.exception': {
    subject: '⚠ Order {{orderReference}} — Exception',
    body: `<h2 style="margin:0 0 16px;color:#d32f2f;">Order Exception</h2>
<p>An exception has occurred on order <strong>{{orderReference}}</strong>:</p>
<p style="padding:12px;background:#fff3f3;border-left:4px solid #d32f2f;border-radius:4px;">{{description}}</p>`,
  },
};

export class EmailTemplateRenderer {
  /**
   * Render an email from a stored template (custom) or default.
   */
  render(
    event: DomainEvent,
    branding: OrgBranding,
    customTemplate?: { subject: string; htmlBody: string; textBody?: string | null }
  ): RenderedEmail | null {
    const payload = event.payload as Record<string, unknown>;
    const context = { ...payload, eventType: event.type, entityId: event.entityId, entityType: event.entityType };

    if (customTemplate) {
      const subject = Handlebars.compile(customTemplate.subject)(context);
      const bodyHtml = Handlebars.compile(customTemplate.htmlBody)(context);
      const html = wrapInBaseLayout(bodyHtml, branding);
      const text = customTemplate.textBody
        ? Handlebars.compile(customTemplate.textBody)(context)
        : htmlToText(bodyHtml);
      return { subject, html, text };
    }

    // Fall back to default template
    const defaultTpl = DEFAULT_TEMPLATES[event.type];
    if (!defaultTpl) return null; // No template for this event type

    const subject = Handlebars.compile(defaultTpl.subject)(context);
    const bodyHtml = Handlebars.compile(defaultTpl.body)(context);
    const html = wrapInBaseLayout(bodyHtml, branding);
    const text = htmlToText(bodyHtml);

    return { subject, html, text };
  }
}
