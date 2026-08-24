/**
 * PackAuditIssueHandler
 *
 * Raises a triage issue for pack-audit variances (warning/fail verdicts)
 * through the sanctioned CREATE_ISSUE command path, then links the issue
 * back onto PackAudit.issueId so the admin list can jump straight to it.
 *
 * Why a handler and not the command: RecordPackAuditCommand used to write
 * the issue directly inside its transaction, which bypassed the issue
 * pipeline (no issue.created event), so pack-audit issues never reached
 * IssueReadModel or the triage board. Issue writes go through the command
 * bus, after commit (see the issues domain rule).
 *
 * Dedup mirrors the issue engine's rule: one open issue per
 * (issueType, source entity). A repeat variance on the same pack task
 * links to the existing open issue instead of raising a duplicate.
 *
 * NOTE for Track 0 Phase 0 (#133): once the issue-type registry accepts
 * non-shipment sources, this handler collapses into a registry entry and
 * the engine takes over. Until then it is the one sanctioned WMS issue
 * raiser.
 */

import { PrismaClient } from '@prisma/client';
import { DomainEvent } from '../DomainEvent.js';
import { IEventHandler } from '../IEventHandler.js';
import { SubscribeOptions } from '../IEventBus.js';
import { ICommandBus } from '../../commands/CommandBus.js';
import { CREATE_ISSUE } from '../../commands/issues/CreateIssueCommand.js';
import { EVENT_TYPES } from '../eventTypes.js';
import crypto from 'crypto';

export const PACK_AUDIT_ISSUE_TYPE = 'pack_audit_variance';

export class PackAuditIssueHandler implements IEventHandler {
  readonly name = 'handler.pack_audit_issue';
  readonly eventPatterns = [EVENT_TYPES.PACK_AUDIT_VARIANCE_DETECTED];
  readonly options: SubscribeOptions = {
    concurrency: 1,
    priority: 15,
  };

  constructor(
    private prisma: PrismaClient,
    private commandBus: ICommandBus,
  ) {}

  async handle(event: DomainEvent): Promise<void> {
    try {
      const p = event.payload as Record<string, any>;
      const packTaskId = p?.packTaskId as string | undefined;
      const verdict = p?.verdict as string | undefined;
      const auditId = event.entityId;
      if (!packTaskId || !verdict || verdict === 'pass') return;

      const issueId = await this.findOrCreateIssue(event, packTaskId, verdict, p);
      if (!issueId) return;

      await this.prisma.packAudit.update({
        where: { id: auditId },
        data: { issueId },
      });
    } catch (err) {
      console.error('[PackAuditIssueHandler] Failed:', (err as Error).message);
    }
  }

  private async findOrCreateIssue(
    event: DomainEvent,
    packTaskId: string,
    verdict: string,
    p: Record<string, any>,
  ): Promise<string | null> {
    // One open issue per (issueType, source entity), same as the engine's
    // dedup rule: a repeat variance escalates attention on the existing
    // issue rather than flooding the board.
    const open = await this.prisma.issue.findFirst({
      where: {
        orgId: event.orgId,
        issueType: PACK_AUDIT_ISSUE_TYPE,
        sourceEntityType: 'pack_task',
        sourceEntityId: packTaskId,
        status: { notIn: ['resolved', 'closed'] },
      },
      select: { id: true },
    });
    if (open) return open.id;

    const variance = Number(p.weightVariancePercent ?? 0);
    const title = verdict === 'fail'
      ? `Pack audit failure on PackTask ${packTaskId.slice(0, 8)}: ${variance.toFixed(1)}% weight variance`
      : `Pack audit warning on PackTask ${packTaskId.slice(0, 8)}: ${variance.toFixed(1)}% weight variance`;
    const description =
      `Expected ${p.expectedWeightGrams}g, actual ${p.actualWeightGrams}g (tolerance ±${p.tolerance}%).` +
      (p.dimWeightVariancePercent != null ? ` Dim weight variance ${Number(p.dimWeightVariancePercent).toFixed(1)}%.` : '') +
      (p.notes ? `\n\nAuditor notes: ${p.notes}` : '');

    const result = await this.commandBus.dispatch({
      type: CREATE_ISSUE,
      orgId: event.orgId,
      actorId: 'pack-audit-monitor',
      payload: {
        title,
        description,
        priority: verdict === 'fail' ? 'high' : 'medium',
        category: 'exception',
        issueType: PACK_AUDIT_ISSUE_TYPE,
        latched: false,
        sourceEntityType: 'pack_task',
        sourceEntityId: packTaskId,
        sourceEventId: event.id,
      },
      metadata: { correlationId: crypto.randomUUID(), source: 'pack-audit-issue-handler' },
    });

    if (!result.success) {
      console.warn(`[PackAuditIssueHandler] Failed to create issue: ${result.error}`);
      return null;
    }
    return (result.data as { id: string } | undefined)?.id ?? null;
  }
}
