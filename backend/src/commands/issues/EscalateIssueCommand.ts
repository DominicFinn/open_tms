import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface EscalateIssuePayload {
  id: string;
  escalatedTo: string;
  reason?: string;
}

export const ESCALATE_ISSUE = 'issue.escalate';

export class EscalateIssueCommandHandler extends BaseCommandHandler<EscalateIssuePayload, { id: string }> {
  readonly commandType = ESCALATE_ISSUE;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<EscalateIssuePayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string }> {
    const { id, escalatedTo, reason } = command.payload;

    const updated = await tx.issue.update({
      where: { id },
      data: {
        escalatedTo,
        escalatedAt: new Date(),
        status: 'in_progress',
        priority: 'critical',
      },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.ISSUE_ESCALATED,
      entityType: 'issue',
      entityId: id,
      payload: {
        title: updated.title,
        escalatedTo,
        reason,
        category: updated.category,
        sourceEntityType: updated.sourceEntityType,
        sourceEntityId: updated.sourceEntityId,
      },
    }));

    return { id };
  }
}
