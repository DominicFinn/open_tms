import { ISkill, SkillDefinition, SkillExecutionParams, SkillExecutionResult } from './ISkill.js';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

export class AddCommentSkill implements ISkill {
  readonly definition: SkillDefinition = {
    type: 'add_comment',
    name: 'Add Comment',
    description: 'Add a comment to an issue, shipment, or order',
    icon: 'comment',
    category: 'triage',
    fields: [
      { key: 'entityType', label: 'Entity Type', type: 'select', required: true, options: [{ value: 'issue', label: 'Issue' }, { value: 'shipment', label: 'Shipment' }, { value: 'order', label: 'Order' }] },
      { key: 'entityId', label: 'Entity ID', type: 'template', required: true, placeholder: '{{context.issueId}}', templateHelp: 'Use {{context.*}} for entity IDs' },
      { key: 'body', label: 'Comment Body', type: 'template', required: true, placeholder: 'Agent analysis: {{payload.summary}}', templateHelp: 'Supports markdown' },
    ],
    configSchema: [],
    requiresConfig: false,
  };

  constructor(private prisma: PrismaClient) {}

  validateConfig(): { valid: boolean } { return { valid: true }; }

  async execute(params: SkillExecutionParams): Promise<SkillExecutionResult> {
    try {
      const comment = await this.prisma.comment.create({
        data: {
          id: randomUUID(),
          orgId: params.orgId,
          entityType: String(params.fields.entityType || 'issue'),
          entityId: String(params.fields.entityId),
          authorId: null,
          authorName: 'AI Triage Agent',
          authorType: 'agent',
          body: String(params.fields.body || ''),
        },
      });

      // Update comment count on IssueReadModel if entity is an issue
      if (params.fields.entityType === 'issue') {
        await this.prisma.issueReadModel.update({
          where: { id: String(params.fields.entityId) },
          data: { commentCount: { increment: 1 }, updatedAt: new Date() },
        }).catch(() => {}); // Non-critical
      }

      return { success: true, data: { commentId: comment.id } };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}
