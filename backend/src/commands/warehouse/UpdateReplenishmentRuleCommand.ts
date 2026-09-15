import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface UpdateReplenishmentRulePayload {
  ruleId: string;
  minQuantity?: number;
  maxQuantity?: number;
  active?: boolean;
}

export const UPDATE_REPLENISHMENT_RULE = 'replenishment_rule.update';

export class UpdateReplenishmentRuleCommandHandler extends BaseCommandHandler<
  UpdateReplenishmentRulePayload,
  { id: string }
> {
  readonly commandType = UPDATE_REPLENISHMENT_RULE;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<UpdateReplenishmentRulePayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string }> {
    const { ruleId, ...updates } = command.payload;

    const existing = await tx.replenishmentRule.findFirst({
      where: { id: ruleId, orgId: command.orgId },
    });
    if (!existing) throw new Error(`Replenishment rule ${ruleId} not found`);

    // BUSINESS RULE: replenishment tops a bin up from minQuantity to maxQuantity, so a max below
    // the min can never be satisfied. Checked against the merged values, not just the sent ones,
    // since a request that moves only one of the pair can still invert the band.
    const min = updates.minQuantity ?? existing.minQuantity;
    const max = updates.maxQuantity ?? existing.maxQuantity;
    if (max < min) throw new Error('maxQuantity must be at least minQuantity');

    await tx.replenishmentRule.update({ where: { id: ruleId }, data: updates });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.REPLENISHMENT_RULE_UPDATED,
      entityType: 'replenishment_rule',
      entityId: ruleId,
      payload: { locationId: existing.locationId, changes: Object.keys(updates) },
    }));

    return { id: ruleId };
  }
}
