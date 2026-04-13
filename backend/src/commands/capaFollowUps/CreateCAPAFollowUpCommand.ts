/**
 * CreateCAPAFollowUpCommand - creates a follow-up note for a CAPA report.
 * Supports 30/60/90 day reviews and ad-hoc notes.
 */

import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface CreateCAPAFollowUpPayload {
  capaReportId: string;
  followUpType: string;       // "30_day", "60_day", "90_day", "ad_hoc", "effectiveness_check"
  dueDate: string;            // ISO date
  notes?: string;
  actionItems?: string;
  assigneeId?: string;
  assigneeName?: string;
}

export const CREATE_CAPA_FOLLOW_UP = 'capa_follow_up.create';

export class CreateCAPAFollowUpCommandHandler extends BaseCommandHandler<CreateCAPAFollowUpPayload, { id: string }> {
  readonly commandType = CREATE_CAPA_FOLLOW_UP;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<CreateCAPAFollowUpPayload>,
    tx: TransactionClient,
    emit: EmitFn,
  ): Promise<{ id: string }> {
    const { capaReportId, followUpType, dueDate, notes, actionItems, assigneeId, assigneeName } = command.payload;

    // Verify the CAPA report exists and belongs to the org
    const capa = await tx.cAPAReport.findFirst({
      where: { id: capaReportId, orgId: command.orgId },
    });
    if (!capa) {
      throw new Error(`CAPA report ${capaReportId} not found`);
    }

    const followUp = await tx.cAPAFollowUp.create({
      data: {
        orgId: command.orgId,
        capaReportId,
        followUpType,
        dueDate: new Date(dueDate),
        notes: notes ?? null,
        actionItems: actionItems ?? null,
        assigneeId: assigneeId ?? null,
        assigneeName: assigneeName ?? null,
        createdBy: command.actorId,
      },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.CAPA_FOLLOW_UP_CREATED,
      entityType: 'capa_follow_up',
      entityId: followUp.id,
      payload: {
        capaReportId,
        followUpType,
        dueDate,
        reportNumber: capa.reportNumber,
      },
    }));

    return { id: followUp.id };
  }
}
