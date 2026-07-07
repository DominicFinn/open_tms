/**
 * CreateIssueCommand — creates a new triage issue.
 *
 * Can be dispatched manually (dispatcher creates issue) or automatically
 * by event handlers (e.g., on shipment.exception -> auto-create issue).
 */

import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface CreateIssuePayload {
  title: string;
  description?: string;
  priority?: string;
  category: string;
  /** Deterministic issue engine: stable Issue Type registry key. */
  issueType?: string;
  /** Latched issues cannot be auto-resolved when the condition clears. */
  latched?: boolean;
  sourceEntityType?: string;
  sourceEntityId?: string;
  sourceEventId?: string;
  assigneeId?: string;
  assigneeName?: string;
}

export const CREATE_ISSUE = 'issue.create';

export class CreateIssueCommandHandler extends BaseCommandHandler<CreateIssuePayload, { id: string; title: string }> {
  readonly commandType = CREATE_ISSUE;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<CreateIssuePayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string; title: string }> {
    const issue = await tx.issue.create({
      data: {
        orgId: command.orgId,
        ...command.payload,
      },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.ISSUE_CREATED,
      entityType: 'issue',
      entityId: issue.id,
      payload: {
        title: issue.title,
        priority: issue.priority,
        category: issue.category,
        issueType: issue.issueType,
        latched: issue.latched,
        sourceEntityType: issue.sourceEntityType,
        sourceEntityId: issue.sourceEntityId,
      },
    }));

    return { id: issue.id, title: issue.title };
  }
}
