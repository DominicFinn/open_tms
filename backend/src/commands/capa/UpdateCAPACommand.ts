/**
 * UpdateCAPACommand — updates an existing CAPA report.
 *
 * Emits specific events when status changes (CAPA_STATUS_CHANGED),
 * when approved (CAPA_APPROVED), or when verified (CAPA_VERIFIED).
 * Falls back to a general CAPA_UPDATED event for other changes.
 */

import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface UpdateCAPAData {
  title?: string;
  status?: string;
  priority?: string;
  description?: string;
  immediateAction?: string;
  containmentAction?: string;
  investigationDetails?: string;
  rootCause?: string;
  rootCauseCategory?: string;
  correctiveAction?: string;
  correctiveActionDueDate?: string;
  correctiveActionCompletedDate?: string;
  preventiveAction?: string;
  preventiveActionDueDate?: string;
  preventiveActionCompletedDate?: string;
  investigatorId?: string;
  investigatorName?: string;
  approverId?: string;
  approverName?: string;
  approvedAt?: string;
  verificationMethod?: string;
  verifiedById?: string;
  verifiedByName?: string;
  verifiedAt?: string;
  effectivenessCheck?: string;
  lessonsLearned?: string;
}

export interface UpdateCAPAPayload {
  id: string;
  data: UpdateCAPAData;
}

export const UPDATE_CAPA = 'capa.update';

export class UpdateCAPACommandHandler extends BaseCommandHandler<UpdateCAPAPayload, { id: string }> {
  readonly commandType = UPDATE_CAPA;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<UpdateCAPAPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string }> {
    const { id, data } = command.payload;
    const previous = await tx.cAPAReport.findUniqueOrThrow({ where: { id } });

    // Convert ISO date strings to Date objects for Prisma
    const updateData: Record<string, unknown> = { ...data, updatedBy: command.actorId };
    if (data.correctiveActionDueDate) updateData.correctiveActionDueDate = new Date(data.correctiveActionDueDate);
    if (data.correctiveActionCompletedDate) updateData.correctiveActionCompletedDate = new Date(data.correctiveActionCompletedDate);
    if (data.preventiveActionDueDate) updateData.preventiveActionDueDate = new Date(data.preventiveActionDueDate);
    if (data.preventiveActionCompletedDate) updateData.preventiveActionCompletedDate = new Date(data.preventiveActionCompletedDate);
    if (data.approvedAt) updateData.approvedAt = new Date(data.approvedAt);
    if (data.verifiedAt) updateData.verifiedAt = new Date(data.verifiedAt);

    const updated = await tx.cAPAReport.update({ where: { id }, data: updateData });

    // Emit status change event if status was modified
    if (data.status && data.status !== previous.status) {
      emit(this.createEvent(command, {
        type: EVENT_TYPES.CAPA_STATUS_CHANGED,
        entityType: 'capa_report',
        entityId: id,
        payload: {
          reportNumber: updated.reportNumber,
          title: updated.title,
          previousStatus: previous.status,
          newStatus: data.status,
        },
      }));
    }

    // Emit approved event if approvedAt was just set
    if (data.approvedAt && !previous.approvedAt) {
      emit(this.createEvent(command, {
        type: EVENT_TYPES.CAPA_APPROVED,
        entityType: 'capa_report',
        entityId: id,
        payload: {
          reportNumber: updated.reportNumber,
          title: updated.title,
          approverId: updated.approverId,
          approverName: updated.approverName,
        },
      }));
    }

    // Emit verified event if verifiedAt was just set
    if (data.verifiedAt && !previous.verifiedAt) {
      emit(this.createEvent(command, {
        type: EVENT_TYPES.CAPA_VERIFIED,
        entityType: 'capa_report',
        entityId: id,
        payload: {
          reportNumber: updated.reportNumber,
          title: updated.title,
          verifiedById: updated.verifiedById,
          verifiedByName: updated.verifiedByName,
          verificationMethod: updated.verificationMethod,
        },
      }));
    }

    // General update event if no specific event was emitted
    if ((!data.status || data.status === previous.status) && !data.approvedAt && !data.verifiedAt) {
      emit(this.createEvent(command, {
        type: EVENT_TYPES.CAPA_UPDATED,
        entityType: 'capa_report',
        entityId: id,
        payload: {
          reportNumber: updated.reportNumber,
          title: updated.title,
          changes: Object.keys(data),
        },
      }));
    }

    return { id };
  }
}
