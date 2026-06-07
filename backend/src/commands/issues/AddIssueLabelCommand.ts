import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface AddIssueLabelPayload {
  issueId: string;
  labelId: string;
}

export interface AddIssueLabelResult {
  issueId: string;
  labelId: string;
  labelName: string;
  labelColor: string;
  alreadyAssigned: boolean;
}

export const ADD_ISSUE_LABEL = 'issue.add_label';

export class AddIssueLabelCommandHandler extends BaseCommandHandler<AddIssueLabelPayload, AddIssueLabelResult> {
  readonly commandType = ADD_ISSUE_LABEL;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<AddIssueLabelPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<AddIssueLabelResult> {
    const { issueId, labelId } = command.payload;

    const label = await tx.issueLabel.findUnique({ where: { id: labelId } });
    if (!label) throw new Error('Label not found');

    const existing = await tx.issueLabelAssignment.findFirst({
      where: { issueId, labelId },
    });

    if (existing) {
      return {
        issueId,
        labelId,
        labelName: label.name,
        labelColor: label.color,
        alreadyAssigned: true,
      };
    }

    await tx.issueLabelAssignment.create({
      data: { issueId, labelId },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.ISSUE_LABEL_ADDED,
      entityType: 'issue',
      entityId: issueId,
      payload: {
        labelId,
        labelName: label.name,
        labelColor: label.color,
      },
    }));

    return {
      issueId,
      labelId,
      labelName: label.name,
      labelColor: label.color,
      alreadyAssigned: false,
    };
  }
}
