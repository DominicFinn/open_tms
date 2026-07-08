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
} from '../../services/issues/issueTypeRegistry.js';

/** Shared mapping from a signal's severity band onto an issue priority. */
const SEVERITY_TO_PRIORITY: Record<string, IssuePriority> = {
  minor: 'low',
  warning: 'medium',
  critical: 'high',
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
    const entityId = this.entityId(event);
    const priority = this.signalPriority(event, type);

    // 1. Append the signal to the ledger (feeds the accumulator + the graphs).
    const signal = await this.prisma.issueSignal.create({
      data: {
        orgId,
        issueType: type.key,
        eventType: event.type,
        sourceEntityType: 'shipment',
        sourceEntityId: entityId,
        priority,
        sourceEventId: event.id,
        occurredAt: new Date(event.timestamp),
      },
    });

    // 2. If an issue is already open for this (type, entity), attach + escalate.
    const open = await this.findOpenIssue(type.key, entityId);
    if (open) {
      await this.prisma.issueSignal.update({ where: { id: signal.id }, data: { issueId: open.id } });
      if (priorityRank(priority) > priorityRank(open.priority)) {
        await this.dispatchUpdate(open.id, orgId, { priority: maxPriority(open.priority, priority) });
      }
      return;
    }

    // 3. Raise rule: immediate on severity floor, else N signals within the window.
    if (!(await this.shouldRaise(type, entityId, priority))) return;

    // 4. Create via the command bus, then attach the contributing signals.
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
        sourceEntityType: 'shipment',
        sourceEntityId: entityId,
        sourceEventId: event.id,
      },
      metadata: { correlationId: randomUUID(), source: 'system' },
    });

    const issueId = result.success ? (result.data as { id: string } | undefined)?.id : undefined;
    if (!issueId) {
      console.warn(`[IssueEngine] Failed to create ${type.key} issue: ${result.error}`);
      return;
    }
    const since = new Date(Date.now() - type.raise.windowMinutes * 60_000);
    await this.prisma.issueSignal.updateMany({
      where: { issueType: type.key, sourceEntityId: entityId, issueId: null, occurredAt: { gte: since } },
      data: { issueId },
    });
  }

  private async handleRecovery(event: DomainEvent, type: IssueTypeDef): Promise<void> {
    const entityId = this.entityId(event);
    const open = await this.findOpenIssue(type.key, entityId);
    if (!open) return;

    // Latched issues never auto-resolve — "it happened", must be investigated.
    if (type.latched) return;

    await this.dispatchUpdate(open.id, event.orgId, {
      status: 'resolved',
      resolution: `Auto-resolved by the issue engine: ${type.name} condition cleared.`,
    });
  }

  private findOpenIssue(issueType: string, sourceEntityId: string) {
    return this.prisma.issue.findFirst({
      where: { issueType, sourceEntityId, status: { in: OPEN_STATUSES } },
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

  /** All current types are shipment-scoped; prefer payload.shipmentId, fall back to entityId. */
  private entityId(event: DomainEvent): string {
    return ((event.payload as { shipmentId?: string })?.shipmentId) ?? event.entityId;
  }

  private signalPriority(event: DomainEvent, type: IssueTypeDef): IssuePriority {
    if (type.ignoreSignalSeverity) return type.defaultPriority;
    const severity = (event.payload as { severity?: string })?.severity;
    return (severity && SEVERITY_TO_PRIORITY[severity]) || type.defaultPriority;
  }

  private buildTitle(event: DomainEvent, type: IssueTypeDef): string {
    const p = (event.payload as { shipmentReference?: string; reference?: string }) || {};
    const ref = p.shipmentReference || p.reference || event.entityId;
    return `${type.name}: shipment ${ref}`;
  }

  private buildDescription(event: DomainEvent, type: IssueTypeDef, priority: string): string {
    const p = (event.payload as Record<string, unknown>) || {};
    const ref = (p.shipmentReference as string) || (p.reference as string) || event.entityId;
    const bits = [`${type.name} detected for shipment ${ref}.`, `Priority: ${priority}.`];
    if (p.severity) bits.push(`Severity: ${p.severity}.`);
    if (p.bufferMinutes != null) bits.push(`Buffer: ${p.bufferMinutes} min.`);
    if (p.blockingStage) bits.push(`Blocking stage: ${p.blockingStage}.`);
    if (p.delayMinutes != null) bits.push(`Delay: ${p.delayMinutes} min.`);
    if (p.excursionType) bits.push(`Excursion: ${p.excursionType}.`);
    return bits.join(' ');
  }
}
