import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface UpdateWarehouseBinPayload {
  binId: string;
  label?: string;
  binType?: string;
  maxWeightKg?: number | null;
  maxVolumeCbm?: number | null;
  maxPalletPositions?: number | null;
  temperatureZone?: string | null;
  hazmatCertified?: boolean;
  level?: number | null;
  walkSequence?: number;
  active?: boolean;
}

export const UPDATE_WAREHOUSE_BIN = 'warehouse_bin.update';

export class UpdateWarehouseBinCommandHandler extends BaseCommandHandler<
  UpdateWarehouseBinPayload,
  { id: string; label: string }
> {
  readonly commandType = UPDATE_WAREHOUSE_BIN;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<UpdateWarehouseBinPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string; label: string }> {
    const { binId, ...updates } = command.payload;

    const existing = await tx.warehouseBin.findUnique({ where: { id: binId } });
    if (!existing) throw new Error(`Bin ${binId} not found`);

    // If label is changing, check uniqueness
    if (updates.label && updates.label !== existing.label) {
      const duplicate = await tx.warehouseBin.findUnique({
        where: { locationId_label: { locationId: existing.locationId, label: updates.label } },
      });
      if (duplicate) throw new Error(`Bin label "${updates.label}" already exists at this location`);
    }

    const bin = await tx.warehouseBin.update({
      where: { id: binId },
      data: updates,
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.WAREHOUSE_BIN_UPDATED,
      entityType: 'warehouse_bin',
      entityId: bin.id,
      payload: {
        label: bin.label,
        binType: bin.binType,
        active: bin.active,
        changes: Object.keys(updates),
      },
    }));

    return { id: bin.id, label: bin.label };
  }
}
