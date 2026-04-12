/**
 * CreateSOPChecklistCommand - creates a new SOP/GDP audit checklist template.
 */

import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface SOPChecklistItemInput {
  sortOrder: number;
  section?: string;
  question: string;
  guidance?: string;
  evidenceRequired?: boolean;
  isCritical?: boolean;
}

export interface CreateSOPChecklistPayload {
  title: string;
  description?: string;
  sopReference?: string;
  category: string;
  frequency?: string;
  nextDueDate?: string;
  items: SOPChecklistItemInput[];
}

export const CREATE_SOP_CHECKLIST = 'sop_checklist.create';

export class CreateSOPChecklistCommandHandler extends BaseCommandHandler<CreateSOPChecklistPayload, { id: string }> {
  readonly commandType = CREATE_SOP_CHECKLIST;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<CreateSOPChecklistPayload>,
    tx: TransactionClient,
    emit: EmitFn,
  ): Promise<{ id: string }> {
    const { title, description, sopReference, category, frequency, nextDueDate, items } = command.payload;

    const checklist = await tx.sOPChecklist.create({
      data: {
        orgId: command.orgId,
        title,
        description: description ?? null,
        sopReference: sopReference ?? null,
        category,
        frequency: frequency ?? 'annual',
        status: 'active',
        nextDueDate: nextDueDate ? new Date(nextDueDate) : null,
        createdBy: command.actorId,
        items: {
          create: items.map(item => ({
            sortOrder: item.sortOrder,
            section: item.section ?? null,
            question: item.question,
            guidance: item.guidance ?? null,
            evidenceRequired: item.evidenceRequired ?? false,
            isCritical: item.isCritical ?? false,
          })),
        },
      },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.SOP_CHECKLIST_CREATED,
      entityType: 'sop_checklist',
      entityId: checklist.id,
      payload: {
        title,
        category,
        itemCount: items.length,
      },
    }));

    return { id: checklist.id };
  }
}
