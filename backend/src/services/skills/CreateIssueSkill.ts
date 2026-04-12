import { ISkill, SkillDefinition, SkillExecutionParams, SkillExecutionResult } from './ISkill.js';
import { ICommandBus } from '../../commands/CommandBus.js';
import { CREATE_ISSUE } from '../../commands/issues/CreateIssueCommand.js';
import { randomUUID } from 'crypto';

export class CreateIssueSkill implements ISkill {
  readonly definition: SkillDefinition = {
    type: 'create_issue',
    name: 'Create Issue',
    description: 'Create a triage issue linked to the triggering entity',
    icon: 'bug_report',
    category: 'triage',
    fields: [
      { key: 'title', label: 'Issue Title', type: 'template', required: true, placeholder: 'Delay on {{payload.shipmentReference}}', templateHelp: 'Use {{payload.*}} for event data' },
      { key: 'description', label: 'Description', type: 'text', required: false, placeholder: 'Optional description' },
      { key: 'priority', label: 'Priority', type: 'select', required: true, options: [{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }, { value: 'critical', label: 'Critical' }] },
      { key: 'category', label: 'Category', type: 'select', required: true, options: [{ value: 'exception', label: 'Exception' }, { value: 'delay', label: 'Delay' }, { value: 'damage', label: 'Damage' }, { value: 'compliance', label: 'Compliance' }, { value: 'other', label: 'Other' }] },
    ],
    configSchema: [],
    requiresConfig: false,
  };

  constructor(private commandBus: ICommandBus) {}

  validateConfig(): { valid: boolean } { return { valid: true }; }

  async execute(params: SkillExecutionParams): Promise<SkillExecutionResult> {
    const result = await this.commandBus.dispatch({
      type: CREATE_ISSUE,
      orgId: params.orgId,
      actorId: 'system:skill:create_issue',
      payload: {
        title: String(params.fields.title || 'Untitled issue'),
        description: params.fields.description ? String(params.fields.description) : undefined,
        priority: String(params.fields.priority || 'medium'),
        category: String(params.fields.category || 'exception'),
        sourceEntityType: params.event.entityType,
        sourceEntityId: params.event.entityId,
        sourceEventId: params.event.id,
      },
      metadata: { correlationId: randomUUID(), source: 'system' },
    });

    if (result.success) {
      return { success: true, data: { issueId: (result.data as { id: string })?.id } };
    }
    return { success: false, error: result.error };
  }
}
