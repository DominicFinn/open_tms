import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';
import { alignShipmentStops, ConsolidationRuleError, loadDraftConsolidation, shipmentUpdatedEvents } from './consolidationMembership.js';

export interface ReorderConsolidationStopsPayload {
  id: string;
  /** Every stop on the run, in the new order. */
  stopIds: string[];
}

export const REORDER_CONSOLIDATION_STOPS = 'consolidation.reorder_stops';

/** Why `stopIds` isn't a valid order for `stops`, or null when it is. */
export function reorderProblem(stops: Array<{ id: string; stopType: string }>, stopIds: string[]): string | null {
  const known = new Set(stops.map((s) => s.id));
  if (stopIds.length !== stops.length || new Set(stopIds).size !== stopIds.length || stopIds.some((s) => !known.has(s))) {
    return 'The new order must list every stop on the consolidation once.';
  }
  // Other stops (#345) can go anywhere; only pickups and drops are held to their order.
  const types = stopIds.map((sid) => stops.find((s) => s.id === sid)!.stopType).filter((t) => t !== 'other');
  const firstDrop = types.indexOf('delivery');
  if (firstDrop !== -1 && types.slice(firstDrop).includes('pickup')) {
    return 'Every pickup has to come before every drop.';
  }
  return null;
}

/** Sets the order the run visits its stops (draft only), and each shipment's stops to match. */
export class ReorderConsolidationStopsCommandHandler extends BaseCommandHandler<ReorderConsolidationStopsPayload, { changedShipmentIds: string[] }> {
  readonly commandType = REORDER_CONSOLIDATION_STOPS;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<ReorderConsolidationStopsPayload>,
    tx: TransactionClient,
    emit: EmitFn,
  ): Promise<{ changedShipmentIds: string[] }> {
    const { orgId } = command;
    const { id, stopIds } = command.payload;

    await loadDraftConsolidation(tx, orgId, id);
    const stops = await tx.consolidationStop.findMany({
      where: { consolidationId: id, consolidation: { orgId } },
      select: { id: true, stopType: true },
    });
    const problem = reorderProblem(stops, stopIds);
    if (problem) throw new ConsolidationRuleError(problem);

    for (const [i, stopId] of stopIds.entries()) {
      await tx.consolidationStop.update({ where: { id: stopId, consolidationId: id, consolidation: { orgId } }, data: { sequenceNumber: i + 1 } });
    }
    const changedShipmentIds = await alignShipmentStops(tx, orgId, id);

    emit(this.createEvent(command, {
      type: EVENT_TYPES.CONSOLIDATION_STOPS_REORDERED,
      entityType: 'consolidation',
      entityId: id,
      payload: { stopIds, changedShipmentIds },
    }));
    for (const e of shipmentUpdatedEvents(changedShipmentIds, ['stops'], id)) emit(this.createEvent(command, e));
    return { changedShipmentIds };
  }
}
