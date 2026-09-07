import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface DeleteReplenishmentRulePayload {
  ruleId: string;
}

export const DELETE_REPLENISHMENT_RULE = 'replenishment_rule.delete';

export class DeleteReplenishmentRuleCommandHandler extends BaseCommandHandler<
  DeleteReplenishmentRulePayload,
  { id: string }
> {
  readonly commandType = DELETE_REPLENISHMENT_RULE;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<DeleteReplenishmentRulePayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string }> {
    const { ruleId } = command.payload;

    const existing = await tx.replenishmentRule.findFirst({
      where: { id: ruleId, orgId: command.orgId },
      select: { id: true, locationId: true, sku: true },
    });
    if (!existing) throw new Error(`Replenishment rule ${ruleId} not found`);

    await tx.replenishmentRule.delete({ where: { id: ruleId } });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.REPLENISHMENT_RULE_DELETED,
      entityType: 'replenishment_rule',
      entityId: ruleId,
      payload: { locationId: existing.locationId, sku: existing.sku },
    }));

    return { id: ruleId };
  }
}
