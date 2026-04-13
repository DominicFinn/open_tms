/**
 * CompleteSOPAuditCommand - submits responses and completes an audit.
 */

import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface AuditResponseInput {
  checklistItemId: string;
  result: string;            // "pass", "fail", "na", "observation"
  notes?: string;
  evidenceRef?: string;
  correctiveAction?: string;
}

export interface CompleteSOPAuditPayload {
  auditId: string;
  responses: AuditResponseInput[];
  findings?: string;
  correctiveActions?: string;
}

export const COMPLETE_SOP_AUDIT = 'sop_audit.complete';

export class CompleteSOPAuditCommandHandler extends BaseCommandHandler<CompleteSOPAuditPayload, { id: string; score: number; passed: boolean }> {
  readonly commandType = COMPLETE_SOP_AUDIT;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<CompleteSOPAuditPayload>,
    tx: TransactionClient,
    emit: EmitFn,
  ): Promise<{ id: string; score: number; passed: boolean }> {
    const { auditId, responses, findings, correctiveActions } = command.payload;

    const audit = await tx.sOPAudit.findFirst({
      where: { id: auditId, orgId: command.orgId },
      include: {
        checklist: {
          include: { items: true },
        },
      },
    });
    if (!audit) {
      throw new Error(`SOP Audit ${auditId} not found`);
    }

    // Create responses
    for (const resp of responses) {
      await tx.sOPAuditResponse.create({
        data: {
          auditId,
          checklistItemId: resp.checklistItemId,
          result: resp.result,
          notes: resp.notes ?? null,
          evidenceRef: resp.evidenceRef ?? null,
          correctiveAction: resp.correctiveAction ?? null,
          respondedById: command.actorId,
          respondedByName: null,
        },
      });
    }

    // Calculate scores
    let passCount = 0;
    let failCount = 0;
    let naCount = 0;
    let hasCriticalFail = false;

    const criticalItemIds = new Set(
      audit.checklist.items.filter(i => i.isCritical).map(i => i.id)
    );

    for (const resp of responses) {
      switch (resp.result) {
        case 'pass': passCount++; break;
        case 'fail':
          failCount++;
          if (criticalItemIds.has(resp.checklistItemId)) {
            hasCriticalFail = true;
          }
          break;
        case 'na': naCount++; break;
      }
    }

    const scorable = passCount + failCount;
    const score = scorable > 0 ? (passCount / scorable) * 100 : 100;
    const passed = !hasCriticalFail && score >= 80;
    const status = passed ? 'completed' : 'failed';

    await tx.sOPAudit.update({
      where: { id: auditId },
      data: {
        status,
        score,
        passCount,
        failCount,
        naCount,
        findings: findings ?? null,
        correctiveActions: correctiveActions ?? null,
        completedAt: new Date(),
      },
    });

    // Update checklist last completed
    await tx.sOPChecklist.update({
      where: { id: audit.checklistId },
      data: {
        lastCompletedAt: new Date(),
        lastCompletedBy: command.actorId,
      },
    });

    const eventType = passed ? EVENT_TYPES.SOP_AUDIT_COMPLETED : EVENT_TYPES.SOP_AUDIT_FAILED;
    emit(this.createEvent(command, {
      type: eventType,
      entityType: 'sop_audit',
      entityId: auditId,
      payload: {
        checklistId: audit.checklistId,
        checklistTitle: audit.checklist.title,
        auditNumber: audit.auditNumber,
        score,
        passCount,
        failCount,
        passed,
      },
    }));

    return { id: auditId, score, passed };
  }
}
