import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface CreateWarehouseBinPayload {
  zoneId: string;
  locationId: string;
  aisleId?: string | null;
  label: string;
  binType: string;
  maxWeightKg?: number | null;
  maxVolumeCbm?: number | null;
  maxPalletPositions?: number | null;
  temperatureZone?: string | null;
  hazmatCertified?: boolean;
  level?: number | null;
  walkSequence?: number;
}

export const CREATE_WAREHOUSE_BIN = 'warehouse_bin.create';

export class CreateWarehouseBinCommandHandler extends BaseCommandHandler<
  CreateWarehouseBinPayload,
  { id: string; label: string; binType: string }
> {
  readonly commandType = CREATE_WAREHOUSE_BIN;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<CreateWarehouseBinPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string; label: string; binType: string }> {
    // Verify zone exists
    const zone = await tx.warehouseZone.findUnique({ where: { id: command.payload.zoneId } });
    if (!zone) throw new Error(`Zone ${command.payload.zoneId} not found`);

    // Check label uniqueness within location
    const existing = await tx.warehouseBin.findUnique({
      where: { locationId_label: { locationId: command.payload.locationId, label: command.payload.label } },
    });
    if (existing) throw new Error(`Bin label "${command.payload.label}" already exists at this location`);

    const bin = await tx.warehouseBin.create({
      data: {
        zoneId: command.payload.zoneId,
        locationId: command.payload.locationId,
        aisleId: command.payload.aisleId ?? null,
        label: command.payload.label,
        binType: command.payload.binType,
        maxWeightKg: command.payload.maxWeightKg ?? null,
        maxVolumeCbm: command.payload.maxVolumeCbm ?? null,
        maxPalletPositions: command.payload.maxPalletPositions ?? null,
        temperatureZone: command.payload.temperatureZone ?? null,
        hazmatCertified: command.payload.hazmatCertified ?? false,
        level: command.payload.level ?? null,
        walkSequence: command.payload.walkSequence ?? 0,
        orgId: command.orgId,
      },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.WAREHOUSE_BIN_CREATED,
      entityType: 'warehouse_bin',
      entityId: bin.id,
      payload: {
        zoneId: bin.zoneId,
        locationId: bin.locationId,
        label: bin.label,
        binType: bin.binType,
      },
    }));

    return { id: bin.id, label: bin.label, binType: bin.binType };
  }
}
