/**
 * PromoteDecisionCommand — marks a decision pattern as promoted to automation.
 *
 * When a decision pattern has been validated enough times (correct outcomes),
 * it can be "graduated" into a deterministic automation rule. This command
 * flags the decision as promoted for tracking purposes.
 */

import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface PromoteDecisionPayload {
  id: string;
}

export const PROMOTE_DECISION = 'agent_decision.promote';

export class PromoteDecisionCommandHandler extends BaseCommandHandler<
  PromoteDecisionPayload,
  { id: string }
> {
  readonly commandType = PROMOTE_DECISION;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<PromoteDecisionPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string }> {
    const { id } = command.payload;

    const updated = await tx.agentDecision.update({
      where: { id },
      data: {
        promotedToAutomation: true,
        promotedAt: new Date(),
      },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.AGENT_DECISION_PROMOTED,
      entityType: 'agent_decision',
      entityId: id,
      payload: {
        agentType: updated.agentType,
        actionType: updated.actionType,
      },
    }));

    return { id };
  }
}
