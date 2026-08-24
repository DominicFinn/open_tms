/**
 * IssueEngineHandler — the deterministic heart of the Issues subsystem.
 *
 * Subscribes to every trigger + recovery event declared by the Issue Type
 * registry. For a trigger it appends a signal to the IssueSignal ledger, then
 * applies the type's raise rule ("N signals in a window OR a signal at/above the
 * severity floor") with a single dedup rule — one open issue per (issueType,
 * source entity). A matching event on an already-open issue escalates it (bumps
 * priority) rather than creating a duplicate. For a recovery event it
 * auto-resolves the open issue if the type is unlatched; latched issues are left
 * open for investigation.
 *
 * All issue writes go through the command bus (CREATE_ISSUE / UPDATE_ISSUE) so
 * downstream side effects (notifications, projection, SLA evals) fire uniformly.
 * The signal ledger is infrastructure and is written directly.
 *
 * Runs single-threaded (concurrency 1) so the read-then-create accumulator/dedup
 * is race-free within a worker.
 */

import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { DomainEvent } from '../DomainEvent.js';
import { IEventHandler } from '../IEventHandler.js';
import { ICommandBus } from '../../commands/CommandBus.js';
import { CREATE_ISSUE } from '../../commands/issues/CreateIssueCommand.js';
import { UPDATE_ISSUE } from '../../commands/issues/UpdateIssueCommand.js';
import {
  IssueTypeDef,
  IssuePriority,
  issueTypesForTriggerEvent,
  issueTypesForRecoveryEvent,
  allTriggerEvents,
  allRecoveryEvents,
  priorityRank,
  maxPriority,
  computeSignalScore,
  isNoise,
  noiseReasonFor,
  slaDeadlineFor,
} from '../../services/issues/issueTypeRegistry.js';

/**
 * Shared mapping from a signal's severity band onto an issue priority.
 * Pack audits report `verdict` rather than `severity`; both feed this map.
 */
const SEVERITY_TO_PRIORITY: Record<string, IssuePriority> = {
  minor: 'low',
  minor_delay: 'low',
  warning: 'medium',
  critical: 'high',
  fail: 'high',
};

const OPEN_STATUSES = ['open', 'in_progress'];
const ENGINE_ACTOR = 'system:issue-engine';

export class IssueEngineHandler implements IEventHandler {
  readonly name = 'issue.engine';
  readonly eventPatterns: string[];
  readonly options = { concurrency: 1 };

  constructor(
    private prisma: PrismaClient,
    private commandBus: ICommandBus,
  ) {
    this.eventPatterns = [...allTriggerEvents(), ...allRecoveryEvents()];
  }

  async handle(event: DomainEvent): Promise<void> {
    try {
      for (const type of issueTypesForTriggerEvent(event.type)) {
        await this.handleTrigger(event, type);
      }
      for (const type of issueTypesForRecoveryEvent(event.type)) {
        await this.handleRecovery(event, type);
      }
    } catch (err) {
      console.error(`[IssueEngine] Error processing ${event.type}:`, err);
    }
  }

  private async handleTrigger(event: DomainEvent, type: IssueTypeDef): Promise<void> {
    const orgId = event.orgId;
    const entityId = this.entityId(event, type);
    const priority = this.signalPriority(event, type);

    // 1. Append the signal to the ledger (feeds the accumulator + the graphs).
    const signal = await this.prisma.issueSignal.create({
      data: {
        orgId,
        issueType: type.key,
        eventType: event.type,
        sourceEntityType: type.sourceEntityType,
        sourceEntityId: entityId,
        priority,
        sourceEventId: event.id,
        occurredAt: new Date(event.timestamp),
      },
    });

    // 2. If an issue is already open for this (type, entity), attach + escalate.
    const open = await this.findOpenIssue(orgId, type.key, entityId);
    if (open) {
      await this.prisma.issueSignal.update({ where: { id: signal.id }, data: { issueId: open.id } });

      // Corroboration: each additional signal raises confidence, which can lift
      // an issue back out of noise. Recomputed from the ledger rather than
      // incremented, so a replayed event can't inflate the score.
      const signalCount = await this.prisma.issueSignal.count({ where: { issueId: open.id } });
      const score = computeSignalScore(type, signalCount);
      const update: Record<string, unknown> = {
        signalCount,
        signalScore: score,
        isNoise: isNoise(type, score),
        noiseReason: isNoise(type, score) ? noiseReasonFor(type, score, signalCount) : null,
        lastActivityAt: new Date(),
      };
      if (priorityRank(priority) > priorityRank(open.priority)) {
        update.priority = maxPriority(open.priority, priority);
      }
      await this.dispatchUpdate(open.id, orgId, update);
      return;
    }

    // 3. Raise rule: immediate on severity floor, else N signals within the window.
    if (!(await this.shouldRaise(type, entityId, priority))) return;

    // 4. Score the issue from the signals that justified raising it.
    const since = new Date(Date.now() - type.raise.windowMinutes * 60_000);
    const contributing = await this.prisma.issueSignal.count({
      where: { issueType: type.key, sourceEntityId: entityId, occurredAt: { gte: since } },
    });
    const score = computeSignalScore(type, contributing);
    const noise = isNoise(type, score);
    const raisedAt = new Date();

    // 5. Create via the command bus, then attach the contributing signals.
    const result = await this.commandBus.dispatch({
      type: CREATE_ISSUE,
      orgId,
      actorId: ENGINE_ACTOR,
      payload: {
        title: this.buildTitle(event, type),
        description: this.buildDescription(event, type, priority),
        priority,
        category: type.category,
        issueType: type.key,
        latched: type.latched,
        sourceEntityType: type.sourceEntityType,
        sourceEntityId: entityId,
        sourceEventId: event.id,
        signalScore: score,
        signalCount: contributing,
        isNoise: noise,
        noiseReason: noise ? noiseReasonFor(type, score, contributing) : null,
        slaDeadline: slaDeadlineFor(type, raisedAt),
        lastActivityAt: raisedAt,
      },
      metadata: { correlationId: randomUUID(), source: 'system' },
    });

    const issueId = result.success ? (result.data as { id: string } | undefined)?.id : undefined;
    if (!issueId) {
      console.warn(`[IssueEngine] Failed to create ${type.key} issue: ${result.error}`);
      return;
    }
    await this.prisma.issueSignal.updateMany({
      where: { issueType: type.key, sourceEntityId: entityId, issueId: null, occurredAt: { gte: since } },
      data: { issueId },
    });
  }

  private async handleRecovery(event: DomainEvent, type: IssueTypeDef): Promise<void> {
    const entityId = this.entityId(event, type);
    const open = await this.findOpenIssue(event.orgId, type.key, entityId);
    if (!open) return;

    // Latched issues never auto-resolve — "it happened", must be investigated.
    if (type.latched) return;

    await this.dispatchUpdate(open.id, event.orgId, {
      status: 'resolved',
      resolution: `Auto-resolved by the issue engine: ${type.name} condition cleared.`,
    });
  }

  private findOpenIssue(orgId: string, issueType: string, sourceEntityId: string) {
    return this.prisma.issue.findFirst({
      where: { orgId, issueType, sourceEntityId, status: { in: OPEN_STATUSES } },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async shouldRaise(type: IssueTypeDef, entityId: string, priority: string): Promise<boolean> {
    const floor = type.raise.priorityFloor;
    if (floor && priorityRank(priority) >= priorityRank(floor)) return true;
    const since = new Date(Date.now() - type.raise.windowMinutes * 60_000);
    const count = await this.prisma.issueSignal.count({
      where: { issueType: type.key, sourceEntityId: entityId, occurredAt: { gte: since } },
    });
    return count >= type.raise.thresholdCount;
  }

  private async dispatchUpdate(
    id: string,
    orgId: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    await this.commandBus.dispatch({
      type: UPDATE_ISSUE,
      orgId,
      actorId: ENGINE_ACTOR,
      payload: { id, data },
      metadata: { correlationId: randomUUID(), source: 'system' },
    });
  }

  /**
   * Resolve the source entity the issue attaches to, via the type's declared
   * payload key. Falls back to event.entityId, which is NOT always right (a
   * pack audit event's entityId is the audit row) — types whose emitting
   * entity differs from the source entity must declare entityIdField.
   */
  private entityId(event: DomainEvent, type: IssueTypeDef): string {
    const payload = (event.payload ?? {}) as Record<string, unknown>;
    return (payload[type.entityIdField] as string | undefined) ?? event.entityId;
  }

  private signalPriority(event: DomainEvent, type: IssueTypeDef): IssuePriority {
    if (type.ignoreSignalSeverity) return type.defaultPriority;
    const p = (event.payload as { severity?: string; verdict?: string }) ?? {};
    const band = p.severity ?? p.verdict;
    return (band && SEVERITY_TO_PRIORITY[band]) || type.defaultPriority;
  }

  private buildTitle(event: DomainEvent, type: IssueTypeDef): string {
    const p = (event.payload as { shipmentReference?: string; reference?: string }) || {};
    const entityId = this.entityId(event, type);
    const ref = p.shipmentReference || p.reference || entityId.slice(0, 8);
    return `${type.name}: ${type.sourceEntityType.replace(/_/g, ' ')} ${ref}`;
  }

  private buildDescription(event: DomainEvent, type: IssueTypeDef, priority: string): string {
    const p = (event.payload as Record<string, unknown>) || {};
    const entityId = this.entityId(event, type);
    const ref = (p.shipmentReference as string) || (p.reference as string) || entityId.slice(0, 8);
    const label = type.sourceEntityType.replace(/_/g, ' ');
    const bits = [`${type.name} detected for ${label} ${ref}.`, `Priority: ${priority}.`];
    if (p.severity) bits.push(`Severity: ${p.severity}.`);
    if (p.verdict) bits.push(`Verdict: ${p.verdict}.`);
    if (p.bufferMinutes != null) bits.push(`Buffer: ${p.bufferMinutes} min.`);
    if (p.blockingStage) bits.push(`Blocking stage: ${p.blockingStage}.`);
    if (p.delayMinutes != null) bits.push(`Delay: ${p.delayMinutes} min.`);
    if (p.excursionType) bits.push(`Excursion: ${p.excursionType}.`);
    if (p.expectedWeightGrams != null && p.actualWeightGrams != null) {
      bits.push(`Expected ${p.expectedWeightGrams}g, actual ${p.actualWeightGrams}g (tolerance ±${p.tolerance}%).`);
    }
    if (p.notes) bits.push(`Auditor notes: ${p.notes}`);
    return bits.join(' ');
  }
}
