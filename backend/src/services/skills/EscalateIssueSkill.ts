import { ISkill, SkillDefinition, SkillExecutionParams, SkillExecutionResult } from './ISkill.js';
import { ICommandBus } from '../../commands/CommandBus.js';
import { ESCALATE_ISSUE } from '../../commands/issues/EscalateIssueCommand.js';
import { randomUUID } from 'crypto';

export class EscalateIssueSkill implements ISkill {
  readonly definition: SkillDefinition = {
    type: 'escalate_issue',
    name: 'Escalate Issue',
    description: 'Escalate an existing issue to critical priority',
    icon: 'priority_high',
    category: 'triage',
    fields: [
      { key: 'issueId', label: 'Issue ID', type: 'string', required: true, placeholder: 'ID of the issue to escalate' },
      { key: 'escalatedTo', label: 'Escalate To', type: 'string', required: true, placeholder: 'operations-manager' },
      { key: 'reason', label: 'Reason', type: 'template', required: false, placeholder: 'Situation worsened: {{payload.description}}' },
    ],
    configSchema: [],
    requiresConfig: false,
  };

  constructor(private commandBus: ICommandBus) {}

  validateConfig(): { valid: boolean } { return { valid: true }; }

  async execute(params: SkillExecutionParams): Promise<SkillExecutionResult> {
    const result = await this.commandBus.dispatch({
      type: ESCALATE_ISSUE,
      orgId: params.orgId,
      actorId: 'system:skill:escalate_issue',
      payload: {
        id: String(params.fields.issueId),
        escalatedTo: String(params.fields.escalatedTo || 'operations-manager'),
        reason: params.fields.reason ? String(params.fields.reason) : undefined,
      },
      metadata: { correlationId: randomUUID(), source: 'system' },
    });

    if (result.success) {
      return { success: true, data: { issueId: params.fields.issueId } };
    }
    return { success: false, error: result.error };
  }
}
