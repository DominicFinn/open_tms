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

    // findFirst with orgId rather than findUnique by bare id: one tenant must not be able to
    // rename another's bin (#220).
    const existing = await tx.warehouseBin.findFirst({ where: { id: binId, orgId: command.orgId } });
    if (!existing) throw new Error(`Bin ${binId} not found`);

    // If label is changing, check uniqueness. Scoped by facility now that locationId is nullable
    // (#245); the compound unique on (locationId, label) cannot serve a warehouse-only install,
    // and it never carried orgId either.
    if (updates.label && updates.label !== existing.label) {
      const duplicate = await tx.warehouseBin.findFirst({
        where: {
          label: updates.label,
          orgId: command.orgId,
          ...(existing.facilityId
            ? { facilityId: existing.facilityId }
            : { locationId: existing.locationId }),
        },
      });
      if (duplicate) throw new Error(`Bin label "${updates.label}" already exists at this facility`);
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
