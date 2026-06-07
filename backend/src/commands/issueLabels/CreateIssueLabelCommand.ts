import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface CreateIssueLabelPayload {
  name: string;
  color?: string;
}

export interface CreateIssueLabelResult {
  id: string;
  name: string;
  color: string;
}

export const CREATE_ISSUE_LABEL = 'issue_label.create';

export class CreateIssueLabelCommandHandler extends BaseCommandHandler<CreateIssueLabelPayload, CreateIssueLabelResult> {
  readonly commandType = CREATE_ISSUE_LABEL;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<CreateIssueLabelPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<CreateIssueLabelResult> {
    const { name, color } = command.payload;

    const label = await tx.issueLabel.create({
      data: {
        orgId: command.orgId,
        name,
        color: color || '#6B7280',
      },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.ISSUE_LABEL_CREATED,
      entityType: 'issue_label',
      entityId: label.id,
      payload: { name: label.name, color: label.color },
    }));

    return { id: label.id, name: label.name, color: label.color };
  }
}
