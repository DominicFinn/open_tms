import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface DeleteAutomationRulePayload {
  id: string;
}

export interface DeleteAutomationRuleResult {
  id: string;
  deleted: boolean;
}

export const DELETE_AUTOMATION_RULE = 'automation_rule.delete';

export class DeleteAutomationRuleCommandHandler extends BaseCommandHandler<DeleteAutomationRulePayload, DeleteAutomationRuleResult> {
  readonly commandType = DELETE_AUTOMATION_RULE;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<DeleteAutomationRulePayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<DeleteAutomationRuleResult> {
    const { id } = command.payload;

    const existing = await tx.automationRule.findUnique({ where: { id } });
    if (!existing) {
      // Idempotent: no row to delete is fine, the route used to swallow this
      // silently. Skip emitting an event so consumers don't see a phantom
      // delete.
      return { id, deleted: false };
    }

    await tx.automationRule.delete({ where: { id } });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.AUTOMATION_RULE_DELETED,
      entityType: 'automation_rule',
      entityId: id,
      payload: { name: existing.name, eventPattern: existing.eventPattern },
    }));

    return { id, deleted: true };
  }
}
