/**
 * DeleteTrackableUnitCommand — cascade-deletes a handling unit + its line
 * items via Prisma's `onDelete: Cascade` on OrderLineItem.trackableUnit.
 */

import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface DeleteTrackableUnitPayload {
  id: string;
}

export const DELETE_TRACKABLE_UNIT = 'trackable_unit.delete';

export class DeleteTrackableUnitCommandHandler extends BaseCommandHandler<DeleteTrackableUnitPayload, { id: string }> {
  readonly commandType = DELETE_TRACKABLE_UNIT;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<DeleteTrackableUnitPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string }> {
    const { id } = command.payload;

    const existing = await tx.trackableUnit.findUniqueOrThrow({
      where: { id },
      include: { _count: { select: { lineItems: true } } },
    });

    await tx.trackableUnit.delete({ where: { id } });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.TRACKABLE_UNIT_DELETED,
      entityType: 'trackable_unit',
      entityId: id,
      payload: {
        orderId: existing.orderId,
        identifier: existing.identifier,
        cascadedLineItems: existing._count.lineItems,
      },
    }));

    return { id };
  }
}
