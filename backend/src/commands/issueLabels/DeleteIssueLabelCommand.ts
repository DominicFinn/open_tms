import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface DeleteIssueLabelPayload {
  id: string;
}

export interface DeleteIssueLabelResult {
  id: string;
  affectedIssueIds: string[];
}

export const DELETE_ISSUE_LABEL = 'issue_label.delete';

export class DeleteIssueLabelCommandHandler extends BaseCommandHandler<DeleteIssueLabelPayload, DeleteIssueLabelResult> {
  readonly commandType = DELETE_ISSUE_LABEL;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<DeleteIssueLabelPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<DeleteIssueLabelResult> {
    const { id } = command.payload;

    // Capture which issues were carrying this label so the projection can
    // refresh their labels cache after the deletion.
    const assignments = await tx.issueLabelAssignment.findMany({
      where: { labelId: id },
      select: { issueId: true },
    });
    const affectedIssueIds = Array.from(new Set(assignments.map((a) => a.issueId)));

    await tx.issueLabelAssignment.deleteMany({ where: { labelId: id } });
    await tx.issueLabel.delete({ where: { id } });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.ISSUE_LABEL_DELETED,
      entityType: 'issue_label',
      entityId: id,
      payload: { affectedIssueIds },
    }));

    // Re-emit ISSUE_LABEL_REMOVED for each affected issue so the IssueProjection
    // refreshes its labels cache. Otherwise stale label names linger on the
    // read model until the next assignment change.
    for (const issueId of affectedIssueIds) {
      emit(this.createEvent(command, {
        type: EVENT_TYPES.ISSUE_LABEL_REMOVED,
        entityType: 'issue',
        entityId: issueId,
        payload: { labelId: id, reason: 'label_deleted' },
      }));
    }

    return { id, affectedIssueIds };
  }
}
