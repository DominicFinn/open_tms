import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface UpdateIssueLabelPayload {
  id: string;
  data: { name?: string; color?: string };
}

export interface UpdateIssueLabelResult {
  id: string;
  name: string;
  color: string;
}

export const UPDATE_ISSUE_LABEL = 'issue_label.update';

export class UpdateIssueLabelCommandHandler extends BaseCommandHandler<UpdateIssueLabelPayload, UpdateIssueLabelResult> {
  readonly commandType = UPDATE_ISSUE_LABEL;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<UpdateIssueLabelPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<UpdateIssueLabelResult> {
    const { id, data } = command.payload;

    const label = await tx.issueLabel.update({
      where: { id },
      data,
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.ISSUE_LABEL_UPDATED,
      entityType: 'issue_label',
      entityId: id,
      payload: { name: label.name, color: label.color, changes: Object.keys(data) },
    }));

    return { id: label.id, name: label.name, color: label.color };
  }
}
