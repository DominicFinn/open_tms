/**
 * PackAuditIssueLinkHandler
 *
 * The issue engine now raises pack-audit issues from the registry entry
 * (pack_audit_variance, #133) — this handler only maintains the
 * PackAudit.issueId back-link the admin list uses for jump-to-issue.
 *
 * Two subscriptions close the race between "audit recorded" and "issue
 * raised" without depending on handler ordering:
 *  - issue.created (pack_audit_variance): link every unlinked audit for
 *    that pack task — covers the first raise, which may land after the
 *    variance event was already processed here.
 *  - pack.audit_variance_detected: link this audit to the already-open
 *    issue — covers repeat variances, where the engine escalates the
 *    existing issue and emits no issue.created.
 *
 * Both writes are idempotent (issueId: null guard / repeat set of the
 * same id), so at-least-once delivery is safe.
 */

import { PrismaClient } from '@prisma/client';
import { DomainEvent } from '../DomainEvent.js';
import { IEventHandler } from '../IEventHandler.js';
import { SubscribeOptions } from '../IEventBus.js';
import { EVENT_TYPES } from '../eventTypes.js';

const PACK_AUDIT_ISSUE_TYPE = 'pack_audit_variance';

export class PackAuditIssueLinkHandler implements IEventHandler {
  readonly name = 'handler.pack_audit_issue_link';
  readonly eventPatterns = ['issue.created', EVENT_TYPES.PACK_AUDIT_VARIANCE_DETECTED];
  readonly options: SubscribeOptions = { concurrency: 1, priority: 10 };

  constructor(private prisma: PrismaClient) {}

  async handle(event: DomainEvent): Promise<void> {
    try {
      if (event.type === 'issue.created') {
        await this.linkOnIssueCreated(event);
      } else {
        await this.linkOnVariance(event);
      }
    } catch (err) {
      console.error('[PackAuditIssueLink] Failed:', (err as Error).message);
    }
  }

  private async linkOnIssueCreated(event: DomainEvent): Promise<void> {
    const p = event.payload as { issueType?: string; sourceEntityId?: string };
    if (p?.issueType !== PACK_AUDIT_ISSUE_TYPE || !p.sourceEntityId) return;

    await this.prisma.packAudit.updateMany({
      where: { packTaskId: p.sourceEntityId, orgId: event.orgId, issueId: null },
      data: { issueId: event.entityId },
    });
  }

  private async linkOnVariance(event: DomainEvent): Promise<void> {
    const packTaskId = (event.payload as { packTaskId?: string })?.packTaskId;
    if (!packTaskId) return;

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
    if (!open) return;

    await this.prisma.packAudit.updateMany({
      where: { id: event.entityId, orgId: event.orgId, issueId: null },
      data: { issueId: open.id },
    });
  }
}
