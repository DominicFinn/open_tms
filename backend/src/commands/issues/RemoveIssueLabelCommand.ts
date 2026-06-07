import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface RemoveIssueLabelPayload {
  issueId: string;
  labelId: string;
}

export interface RemoveIssueLabelResult {
  issueId: string;
  labelId: string;
  removedCount: number;
}

export const REMOVE_ISSUE_LABEL = 'issue.remove_label';

export class RemoveIssueLabelCommandHandler extends BaseCommandHandler<RemoveIssueLabelPayload, RemoveIssueLabelResult> {
  readonly commandType = REMOVE_ISSUE_LABEL;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<RemoveIssueLabelPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<RemoveIssueLabelResult> {
    const { issueId, labelId } = command.payload;

    const result = await tx.issueLabelAssignment.deleteMany({
      where: { issueId, labelId },
    });

    if (result.count > 0) {
      emit(this.createEvent(command, {
        type: EVENT_TYPES.ISSUE_LABEL_REMOVED,
        entityType: 'issue',
        entityId: issueId,
        payload: { labelId },
      }));
    }

    return { issueId, labelId, removedCount: result.count };
  }
}
