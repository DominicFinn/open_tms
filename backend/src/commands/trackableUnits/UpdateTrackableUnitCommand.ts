/**
 * UpdateTrackableUnitCommand — Phase 2: customers can override per-unit
 * dims/weight/stackable for mixed-SKU pallets where the lines' aggregate
 * doesn't match the actual handling-unit footprint.
 */

import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface UpdateTrackableUnitPayload {
  id: string;
  data: {
    identifier?: string;
    customTypeName?: string | null;
    barcode?: string | null;
    notes?: string | null;
    packagingTypeId?: string | null;
    weight?: number | null;
    weightUnit?: string;
    length?: number | null;
    width?: number | null;
    height?: number | null;
    dimUnit?: string;
    stackable?: boolean;
    condition?: string;
  };
}

export const UPDATE_TRACKABLE_UNIT = 'trackable_unit.update';

export class UpdateTrackableUnitCommandHandler extends BaseCommandHandler<UpdateTrackableUnitPayload, { id: string }> {
  readonly commandType = UPDATE_TRACKABLE_UNIT;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<UpdateTrackableUnitPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string }> {
    const { id, data } = command.payload;

    const previous = await tx.trackableUnit.findUniqueOrThrow({ where: { id } });
    const updated = await tx.trackableUnit.update({ where: { id }, data });

    const changes: Record<string, { before: unknown; after: unknown }> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && (previous as any)[key] !== value) {
        changes[key] = { before: (previous as any)[key], after: value };
      }
    }

    emit(this.createEvent(command, {
      type: EVENT_TYPES.TRACKABLE_UNIT_UPDATED,
      entityType: 'trackable_unit',
      entityId: id,
      payload: { orderId: updated.orderId, identifier: updated.identifier, changes },
    }));

    return { id };
  }
}
