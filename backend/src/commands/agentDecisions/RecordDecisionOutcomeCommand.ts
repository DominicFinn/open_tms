/**
 * RecordDecisionOutcomeCommand — records the outcome of an agent decision.
 *
 * Called by human reviewers (or automated feedback systems) to mark
 * whether a decision was correct, incorrect, or partially correct.
 * This data feeds the automation discovery pipeline.
 */

import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface RecordDecisionOutcomePayload {
  id: string;
  outcomeStatus: string; // correct, incorrect, partially_correct
  outcomeNotes?: string;
}

export const RECORD_DECISION_OUTCOME = 'agent_decision.record_outcome';

export class RecordDecisionOutcomeCommandHandler extends BaseCommandHandler<
  RecordDecisionOutcomePayload,
  { id: string }
> {
  readonly commandType = RECORD_DECISION_OUTCOME;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<RecordDecisionOutcomePayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string }> {
    const { id, outcomeStatus, outcomeNotes } = command.payload;

    await tx.agentDecision.findUniqueOrThrow({ where: { id } });

    const updated = await tx.agentDecision.update({
      where: { id },
      data: {
        outcomeStatus,
        outcomeNotes: outcomeNotes ?? undefined,
        outcomeRecordedAt: new Date(),
        outcomeRecordedBy: command.actorId,
      },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.AGENT_DECISION_OUTCOME_RECORDED,
      entityType: 'agent_decision',
      entityId: id,
      payload: {
        outcomeStatus: updated.outcomeStatus,
        outcomeNotes: updated.outcomeNotes,
        reviewedBy: command.actorId,
      },
    }));

    return { id };
  }
}
