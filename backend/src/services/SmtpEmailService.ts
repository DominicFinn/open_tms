/**
 * SmtpEmailService — sends emails via SMTP using nodemailer.
 *
 * Works with any SMTP server: self-hosted, Gmail, SendGrid SMTP relay,
 * AWS SES SMTP endpoint, Mailgun, etc.
 */

import nodemailer, { Transporter } from 'nodemailer';
import { IEmailService, EmailMessage, EmailResult, SmtpConfig } from './IEmailService.js';

export class SmtpEmailService implements IEmailService {
  private transporter: Transporter;
  private defaultFrom: string;

  constructor(private config: SmtpConfig) {
    this.defaultFrom = config.fromName
      ? `"${config.fromName}" <${config.fromEmail}>`
      : config.fromEmail;

    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.password,
      },
    });
  }

  async send(message: EmailMessage): Promise<EmailResult> {
    try {
      const info = await this.transporter.sendMail({
        from: message.from || this.defaultFrom,
        to: Array.isArray(message.to) ? message.to.join(', ') : message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        replyTo: message.replyTo,
        cc: message.cc?.join(', '),
        bcc: message.bcc?.join(', '),
      });

      return { success: true, messageId: info.messageId };
    } catch (err) {
      const error = (err as Error).message;
      console.error(`[SmtpEmailService] Send failed: ${error}`);
      return { success: false, error };
    }
  }

  async sendBatch(messages: EmailMessage[]): Promise<EmailResult[]> {
    return Promise.all(messages.map((msg) => this.send(msg)));
  }

  async verify(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch (err) {
      console.error(`[SmtpEmailService] Verify failed: ${(err as Error).message}`);
      return false;
    }
  }
}
