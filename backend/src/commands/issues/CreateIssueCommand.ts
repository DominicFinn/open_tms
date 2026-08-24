/**
 * CreateIssueCommand — creates a new triage issue.
 *
 * Can be dispatched manually (dispatcher creates issue) or automatically
 * by event handlers (e.g., on shipment.exception -> auto-create issue).
 */

import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';
import { MANUAL_SIGNAL_SCORE, manualSlaDeadline } from '../../services/issues/issueTypeRegistry.js';

export interface CreateIssuePayload {
  title: string;
  description?: string;
  priority?: string;
  category: string;
  /** Deterministic issue engine: stable Issue Type registry key. */
  issueType?: string;
  /** Latched issues cannot be auto-resolved when the condition clears. */
  latched?: boolean;
  sourceEntityType?: string;
  sourceEntityId?: string;
  sourceEventId?: string;
  assigneeId?: string;
  assigneeName?: string;
  /* Triage scoring — stamped by the Issue Engine when it raises the issue. */
  signalScore?: number;
  signalCount?: number;
  isNoise?: boolean;
  noiseReason?: string | null;
  slaDeadline?: Date | null;
  lastActivityAt?: Date | null;
}

export const CREATE_ISSUE = 'issue.create';

export class CreateIssueCommandHandler extends BaseCommandHandler<CreateIssuePayload, { id: string; title: string }> {
  readonly commandType = CREATE_ISSUE;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<CreateIssuePayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string; title: string }> {
    const p = command.payload;

    /*
     * BUSINESS RULE: a manually-raised issue (no `issueType`) has no Issue Type
     * to inherit triage defaults from, so it would otherwise land with the
     * schema's neutral score and no SLA deadline — invisible to SLA health and
     * mid-pack in signal ranking. Stamp the manual equivalents instead. The
     * Issue Engine always passes these explicitly, so its values win.
     */
    const isManual = !p.issueType;
    const now = new Date();

    const issue = await tx.issue.create({
      data: {
        orgId: command.orgId,
        ...p,
        signalScore: p.signalScore ?? (isManual ? MANUAL_SIGNAL_SCORE : undefined),
        slaDeadline: p.slaDeadline ?? (isManual ? manualSlaDeadline(p.priority ?? 'medium', now) : undefined),
        lastActivityAt: p.lastActivityAt ?? (isManual ? now : undefined),
      },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.ISSUE_CREATED,
      entityType: 'issue',
      entityId: issue.id,
      payload: {
        title: issue.title,
        priority: issue.priority,
        category: issue.category,
        issueType: issue.issueType,
        latched: issue.latched,
        sourceEntityType: issue.sourceEntityType,
        sourceEntityId: issue.sourceEntityId,
        signalScore: issue.signalScore,
        signalCount: issue.signalCount,
        isNoise: issue.isNoise,
        noiseReason: issue.noiseReason,
        slaDeadline: issue.slaDeadline,
        lastActivityAt: issue.lastActivityAt,
      },
    }));

    return { id: issue.id, title: issue.title };
  }
}
