import { ISkill, SkillDefinition, SkillExecutionParams, SkillExecutionResult } from './ISkill.js';

export class CallWebhookSkill implements ISkill {
  readonly definition: SkillDefinition = {
    type: 'call_webhook',
    name: 'Call Webhook',
    description: 'Send an HTTP request to an external URL',
    icon: 'webhook',
    category: 'integration',
    fields: [
      { key: 'body', label: 'Request Body', type: 'text', required: false, placeholder: '{"shipmentId": "{{event.entityId}}"}', templateHelp: 'JSON body with template variables' },
    ],
    configSchema: [
      { key: 'url', label: 'Webhook URL', type: 'url', required: true, placeholder: 'https://api.example.com/webhook' },
      { key: 'method', label: 'HTTP Method', type: 'string', required: false, placeholder: 'POST' },
      { key: 'authType', label: 'Auth Type', type: 'string', required: false, placeholder: 'none, bearer, api_key' },
      { key: 'authValue', label: 'Auth Value', type: 'password', required: false, placeholder: 'Bearer token or API key' },
    ],
    requiresConfig: true,
  };

  validateConfig(config: Record<string, unknown>): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];
    if (!config.url || typeof config.url !== 'string') errors.push('Webhook URL is required');
    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  async execute(params: SkillExecutionParams): Promise<SkillExecutionResult> {
    const url = String(params.config.url || '');
    if (!url) return { success: false, error: 'No webhook URL configured' };

    const method = String(params.config.method || 'POST').toUpperCase();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    // Auth
    const authType = String(params.config.authType || 'none');
    if (authType === 'bearer' && params.config.authValue) {
      headers['Authorization'] = `Bearer ${params.config.authValue}`;
    } else if (authType === 'api_key' && params.config.authValue) {
      headers['X-API-Key'] = String(params.config.authValue);
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: params.fields.body ? String(params.fields.body) : undefined,
      });

      return {
        success: response.ok,
        data: { statusCode: response.status, statusText: response.statusText },
        error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
      };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }
}
