/**
 * StartSOPAuditCommand - starts a new audit instance for a checklist.
 */

import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface StartSOPAuditPayload {
  checklistId: string;
  auditorId?: string;
  auditorName?: string;
}

export const START_SOP_AUDIT = 'sop_audit.start';

export class StartSOPAuditCommandHandler extends BaseCommandHandler<StartSOPAuditPayload, { id: string; auditNumber: string }> {
  readonly commandType = START_SOP_AUDIT;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<StartSOPAuditPayload>,
    tx: TransactionClient,
    emit: EmitFn,
  ): Promise<{ id: string; auditNumber: string }> {
    const { checklistId, auditorId, auditorName } = command.payload;

    const checklist = await tx.sOPChecklist.findFirst({
      where: { id: checklistId, orgId: command.orgId },
    });
    if (!checklist) {
      throw new Error(`SOP Checklist ${checklistId} not found`);
    }

    // Generate audit number: AUDIT-YYYYMMDD-NNN
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000);
    const count = await tx.sOPAudit.count({
      where: {
        orgId: command.orgId,
        createdAt: { gte: todayStart, lt: todayEnd },
      },
    });
    const auditNumber = `AUDIT-${dateStr}-${String(count + 1).padStart(3, '0')}`;

    const audit = await tx.sOPAudit.create({
      data: {
        orgId: command.orgId,
        checklistId,
        auditNumber,
        status: 'in_progress',
        auditorId: auditorId ?? command.actorId,
        auditorName: auditorName ?? null,
      },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.SOP_AUDIT_STARTED,
      entityType: 'sop_audit',
      entityId: audit.id,
      payload: {
        checklistId,
        checklistTitle: checklist.title,
        auditNumber,
        auditorName: auditorName ?? auditorName,
      },
    }));

    return { id: audit.id, auditNumber };
  }
}
