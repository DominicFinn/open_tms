import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export const SYNC_CONSOLIDATION_PROGRESS = 'consolidation.sync_progress';

const DONE = new Set(['completed', 'skipped']);
const REACHED = new Set(['arrived', 'in_progress', 'completed']);

/**
 * BUSINESS RULE: a run stop is done when every shipment stop it serves is done, and reached once
 * any of them is. Tracking happens on each shipment (#329), so the run only mirrors them.
 */
export function stopStatusFrom(linked: string[]): string {
  if (linked.length > 0 && linked.every((s) => DONE.has(s))) return 'completed';
  if (linked.some((s) => REACHED.has(s))) return 'arrived';
  return 'pending';
}

/**
 * BUSINESS RULE: once ready, the run is in progress as soon as any of its shipments or stops is
 * moving, and complete when every shipment is complete. Draft, complete and cancelled runs are
 * only ever changed by hand.
 */
export function runStatusFrom(current: string, shipmentStatuses: string[], stopStatuses: string[]): string {
  if (current !== 'ready' && current !== 'in_progress') return current;
  if (shipmentStatuses.length > 0 && shipmentStatuses.every((s) => s === 'complete')) return 'complete';
  const moving = shipmentStatuses.some((s) => s === 'in_progress' || s === 'complete') || stopStatuses.some((s) => s !== 'pending');
  return moving ? 'in_progress' : current;
}

/** Recomputes a consolidation's stop statuses and status from its shipments. */
export class SyncConsolidationProgressCommandHandler extends BaseCommandHandler<{ id: string }, { changed: boolean }> {
  readonly commandType = SYNC_CONSOLIDATION_PROGRESS;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(command: Command<{ id: string }>, tx: TransactionClient, emit: EmitFn): Promise<{ changed: boolean }> {
    const { orgId } = command;
    const { id } = command.payload;

    const run = await tx.consolidation.findFirst({
      where: { id, orgId, archived: false },
      select: {
        status: true,
        stops: { select: { id: true, status: true, shipmentStops: { select: { status: true } } } },
        shipments: { select: { shipment: { select: { status: true } } } },
      },
    });
    if (!run) return { changed: false };

    const stopChanges = run.stops
      .map((s) => ({ id: s.id, from: s.status, to: stopStatusFrom(s.shipmentStops.map((ss) => ss.status)) }))
      .filter((c) => c.from !== c.to);
    for (const c of stopChanges) {
      await tx.consolidationStop.update({ where: { id: c.id, consolidationId: id, consolidation: { orgId } }, data: { status: c.to } });
    }

    const stopStatuses = run.stops.map((s) => stopChanges.find((c) => c.id === s.id)?.to ?? s.status);
    const status = runStatusFrom(run.status, run.shipments.map((m) => m.shipment.status), stopStatuses);
    if (status !== run.status) {
      await tx.consolidation.update({ where: { id, orgId }, data: { status } });
      emit(this.createEvent(command, {
        type: EVENT_TYPES.CONSOLIDATION_STATUS_CHANGED,
        entityType: 'consolidation',
        entityId: id,
        payload: { from: run.status, to: status, automatic: true },
      }));
    }
    if (stopChanges.length > 0) {
      emit(this.createEvent(command, {
        type: EVENT_TYPES.CONSOLIDATION_STOPS_UPDATED,
        entityType: 'consolidation',
        entityId: id,
        payload: { stops: stopChanges.map(({ id: stopId, to }) => ({ stopId, status: to })) },
      }));
    }
    return { changed: stopChanges.length > 0 || status !== run.status };
  }
}
