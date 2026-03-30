/**
 * IEmailService — pluggable email sending abstraction.
 *
 * Implementations:
 * - SmtpEmailService — uses nodemailer (works with any SMTP server, SendGrid SMTP, SES SMTP)
 * - ConsoleEmailService — logs to stdout (local dev / testing)
 *
 * Selected via EMAIL_PROVIDER env var: "smtp" | "console" (default: "console")
 */

export interface EmailMessage {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;        // Override org default
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;       // true for 465, false for other ports (STARTTLS)
  user: string;
  password: string;
  fromEmail: string;
  fromName: string;
}

export interface IEmailService {
  /** Send a single email */
  send(message: EmailMessage): Promise<EmailResult>;

  /** Send multiple emails (batch). Returns results in order. */
  sendBatch(messages: EmailMessage[]): Promise<EmailResult[]>;

  /** Verify connection / credentials. Returns true if valid. */
  verify(): Promise<boolean>;
}
