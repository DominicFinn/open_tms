/**
 * MergeUnitsCommand — moves all line items from `sourceUnitId` onto
 * `targetUnitId`, then deletes the source unit. Both must belong to the
 * same order. Per-unit dim/weight overrides on the target are preserved;
 * the source's overrides are discarded with the unit.
 */

import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface MergeUnitsPayload {
  sourceUnitId: string;
  targetUnitId: string;
}

export const MERGE_TRACKABLE_UNITS = 'trackable_unit.merge';

export class MergeTrackableUnitsCommandHandler extends BaseCommandHandler<MergeUnitsPayload, { targetUnitId: string; movedLineItems: number }> {
  readonly commandType = MERGE_TRACKABLE_UNITS;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<MergeUnitsPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ targetUnitId: string; movedLineItems: number }> {
    const { sourceUnitId, targetUnitId } = command.payload;

    if (sourceUnitId === targetUnitId) {
      throw new Error('Cannot merge a unit into itself');
    }

    const [source, target] = await Promise.all([
      tx.trackableUnit.findUniqueOrThrow({
        where: { id: sourceUnitId },
        include: { _count: { select: { lineItems: true } } },
      }),
      tx.trackableUnit.findUniqueOrThrow({ where: { id: targetUnitId } }),
    ]);

    if (source.orderId !== target.orderId) {
      throw new Error(`Cannot merge units from different orders (${source.orderId} vs ${target.orderId})`);
    }

    const moved = await tx.orderLineItem.updateMany({
      where: { trackableUnitId: sourceUnitId },
      data: { trackableUnitId: targetUnitId },
    });

    await tx.trackableUnit.delete({ where: { id: sourceUnitId } });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.TRACKABLE_UNITS_MERGED,
      entityType: 'trackable_unit',
      entityId: targetUnitId,
      payload: {
        orderId: source.orderId,
        sourceUnitId,
        targetUnitId,
        sourceIdentifier: source.identifier,
        targetIdentifier: target.identifier,
        movedLineItems: moved.count,
      },
    }));

    return { targetUnitId, movedLineItems: moved.count };
  }
}
