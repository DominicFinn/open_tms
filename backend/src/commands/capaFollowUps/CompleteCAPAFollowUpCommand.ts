/**
 * CompleteCAPAFollowUpCommand - marks a follow-up as completed with outcome.
 */

import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface CompleteCAPAFollowUpPayload {
  followUpId: string;
  notes?: string;
  outcome: string;   // "on_track", "needs_attention", "escalated", "closed_effective", "closed_ineffective"
  actionItems?: string;
}

export const COMPLETE_CAPA_FOLLOW_UP = 'capa_follow_up.complete';

export class CompleteCAPAFollowUpCommandHandler extends BaseCommandHandler<CompleteCAPAFollowUpPayload, { id: string }> {
  readonly commandType = COMPLETE_CAPA_FOLLOW_UP;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<CompleteCAPAFollowUpPayload>,
    tx: TransactionClient,
    emit: EmitFn,
  ): Promise<{ id: string }> {
    const { followUpId, notes, outcome, actionItems } = command.payload;

    const followUp = await tx.cAPAFollowUp.findFirst({
      where: { id: followUpId, orgId: command.orgId },
      include: { capaReport: { select: { reportNumber: true } } },
    });
    if (!followUp) {
      throw new Error(`CAPA follow-up ${followUpId} not found`);
    }

    await tx.cAPAFollowUp.update({
      where: { id: followUpId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        completedById: command.actorId,
        completedByName: null,
        notes: notes ?? followUp.notes,
        outcome,
        actionItems: actionItems ?? followUp.actionItems,
      },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.CAPA_FOLLOW_UP_COMPLETED,
      entityType: 'capa_follow_up',
      entityId: followUpId,
      payload: {
        capaReportId: followUp.capaReportId,
        followUpType: followUp.followUpType,
        outcome,
        reportNumber: followUp.capaReport.reportNumber,
      },
    }));

    return { id: followUpId };
  }
}
