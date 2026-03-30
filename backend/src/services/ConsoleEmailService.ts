/**
 * ConsoleEmailService — logs emails to stdout instead of sending.
 *
 * Used for local development and testing when no SMTP server is configured.
 * This is the default when EMAIL_PROVIDER is not set or set to "console".
 */

import { IEmailService, EmailMessage, EmailResult } from './IEmailService.js';

export class ConsoleEmailService implements IEmailService {
  async send(message: EmailMessage): Promise<EmailResult> {
    const to = Array.isArray(message.to) ? message.to.join(', ') : message.to;
    const messageId = `console-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    console.log('╔══════════════════════════════════════════════════════════');
    console.log('║ 📧 EMAIL (console mode — not actually sent)');
    console.log('╠══════════════════════════════════════════════════════════');
    console.log(`║ To:      ${to}`);
    if (message.from) console.log(`║ From:    ${message.from}`);
    if (message.cc?.length) console.log(`║ CC:      ${message.cc.join(', ')}`);
    if (message.bcc?.length) console.log(`║ BCC:     ${message.bcc.join(', ')}`);
    console.log(`║ Subject: ${message.subject}`);
    console.log('║ Body:');
    // Print text version if available, otherwise strip tags from HTML
    const body = message.text || message.html.replace(/<[^>]+>/g, '');
    body.split('\n').forEach((line) => console.log(`║   ${line}`));
    console.log(`║ ID:      ${messageId}`);
    console.log('╚══════════════════════════════════════════════════════════');

    return { success: true, messageId };
  }

  async sendBatch(messages: EmailMessage[]): Promise<EmailResult[]> {
    return Promise.all(messages.map((msg) => this.send(msg)));
  }

  async verify(): Promise<boolean> {
    console.log('[ConsoleEmailService] Verify: always returns true (console mode)');
    return true;
  }
}
