/**
 * GenerateBarcodeCommand — sets a generated barcode (`TU-{unitId}-{timestamp}`)
 * on a handling unit. Phase 2 promoted from direct repo call so the audit
 * trail captures who triggered it and when.
 */

import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface GenerateBarcodePayload {
  id: string;
}

export const GENERATE_TRACKABLE_UNIT_BARCODE = 'trackable_unit.generate_barcode';

export class GenerateTrackableUnitBarcodeCommandHandler extends BaseCommandHandler<GenerateBarcodePayload, { id: string; barcode: string }> {
  readonly commandType = GENERATE_TRACKABLE_UNIT_BARCODE;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<GenerateBarcodePayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string; barcode: string }> {
    const { id } = command.payload;
    const barcode = `TU-${id}-${Date.now()}`;

    const updated = await tx.trackableUnit.update({
      where: { id },
      data: { barcode },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.TRACKABLE_UNIT_BARCODE_GENERATED,
      entityType: 'trackable_unit',
      entityId: id,
      payload: { orderId: updated.orderId, barcode },
    }));

    return { id, barcode };
  }
}
