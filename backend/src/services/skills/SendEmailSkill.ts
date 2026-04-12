import { ISkill, SkillDefinition, SkillExecutionParams, SkillExecutionResult } from './ISkill.js';
import { IEmailService } from '../IEmailService.js';

export class SendEmailSkill implements ISkill {
  readonly definition: SkillDefinition = {
    type: 'send_email',
    name: 'Send Email',
    description: 'Send an email notification using the configured email service',
    icon: 'email',
    category: 'communication',
    fields: [
      { key: 'to', label: 'To', type: 'template', required: true, placeholder: 'ops@company.com', templateHelp: 'Comma-separated for multiple recipients' },
      { key: 'subject', label: 'Subject', type: 'template', required: true, placeholder: 'Alert: {{payload.shipmentReference}}' },
      { key: 'body', label: 'Body', type: 'text', required: true, placeholder: 'Shipment {{payload.shipmentReference}} has an exception...' },
    ],
    configSchema: [],
    requiresConfig: false, // Uses the org's configured email service
  };

  constructor(private emailService: IEmailService) {}

  validateConfig(): { valid: boolean } { return { valid: true }; }

  async execute(params: SkillExecutionParams): Promise<SkillExecutionResult> {
    try {
      const to = String(params.fields.to || '');
      const recipients = to.split(',').map((r) => r.trim()).filter(Boolean);
      if (recipients.length === 0) {
        return { success: false, error: 'No recipients specified' };
      }

      const result = await this.emailService.send({
        to: recipients,
        subject: String(params.fields.subject || 'Open TMS Notification'),
        html: String(params.fields.body || ''),
      });

      return { success: result.success, data: { messageId: result.messageId }, error: result.error };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }
}
