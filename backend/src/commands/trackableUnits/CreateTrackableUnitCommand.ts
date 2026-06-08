/**
 * CreateTrackableUnitCommand — adds a handling unit (pallet/carton/drum/etc.)
 * to an existing order. Phase 2 promoted this from a direct-repo call so it
 * emits trackable_unit.created and runs in a single transaction.
 */

import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface CreateTrackableUnitPayload {
  orderId: string;
  identifier: string;
  unitType: string;
  customTypeName?: string;
  barcode?: string;
  notes?: string;
  packagingTypeId?: string | null;
  // Phase 2: per-unit dim/weight overrides
  weight?: number | null;
  weightUnit?: string;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  dimUnit?: string;
  stackable?: boolean;
}

export interface CreateTrackableUnitResult {
  id: string;
  orderId: string;
  sequenceNumber: number;
}

export const CREATE_TRACKABLE_UNIT = 'trackable_unit.create';

export class CreateTrackableUnitCommandHandler extends BaseCommandHandler<CreateTrackableUnitPayload, CreateTrackableUnitResult> {
  readonly commandType = CREATE_TRACKABLE_UNIT;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<CreateTrackableUnitPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<CreateTrackableUnitResult> {
    const p = command.payload;

    // Next sequence number for this order
    const last = await tx.trackableUnit.findFirst({
      where: { orderId: p.orderId },
      orderBy: { sequenceNumber: 'desc' },
      select: { sequenceNumber: true },
    });
    const sequenceNumber = (last?.sequenceNumber ?? 0) + 1;

    const unit = await tx.trackableUnit.create({
      data: {
        orderId: p.orderId,
        identifier: p.identifier,
        unitType: p.unitType,
        customTypeName: p.customTypeName,
        barcode: p.barcode,
        notes: p.notes,
        packagingTypeId: p.packagingTypeId ?? undefined,
        sequenceNumber,
        weight: p.weight ?? undefined,
        weightUnit: p.weightUnit ?? 'kg',
        length: p.length ?? undefined,
        width: p.width ?? undefined,
        height: p.height ?? undefined,
        dimUnit: p.dimUnit ?? 'cm',
        stackable: p.stackable ?? true,
      },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.TRACKABLE_UNIT_CREATED,
      entityType: 'trackable_unit',
      entityId: unit.id,
      payload: {
        orderId: p.orderId,
        identifier: unit.identifier,
        unitType: unit.unitType,
        sequenceNumber,
        packagingTypeId: unit.packagingTypeId,
      },
    }));

    return { id: unit.id, orderId: p.orderId, sequenceNumber };
  }
}
