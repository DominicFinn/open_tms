import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface CreateWarehouseZonePayload {
  locationId: string;
  name: string;
  zoneType: string;
  temperatureZone?: string | null;
  hazmatCertified?: boolean;
  maxWeightKg?: number | null;
  maxVolumeCbm?: number | null;
  sortOrder?: number;
}

export const CREATE_WAREHOUSE_ZONE = 'warehouse_zone.create';

export class CreateWarehouseZoneCommandHandler extends BaseCommandHandler<
  CreateWarehouseZonePayload,
  { id: string; name: string; zoneType: string }
> {
  readonly commandType = CREATE_WAREHOUSE_ZONE;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<CreateWarehouseZonePayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string; name: string; zoneType: string }> {
    const zone = await tx.warehouseZone.create({
      data: {
        locationId: command.payload.locationId,
        name: command.payload.name,
        zoneType: command.payload.zoneType,
        temperatureZone: command.payload.temperatureZone ?? null,
        hazmatCertified: command.payload.hazmatCertified ?? false,
        maxWeightKg: command.payload.maxWeightKg ?? null,
        maxVolumeCbm: command.payload.maxVolumeCbm ?? null,
        sortOrder: command.payload.sortOrder ?? 0,
        orgId: command.orgId,
      },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.WAREHOUSE_ZONE_CREATED,
      entityType: 'warehouse_zone',
      entityId: zone.id,
      payload: {
        locationId: zone.locationId,
        name: zone.name,
        zoneType: zone.zoneType,
        temperatureZone: zone.temperatureZone,
        hazmatCertified: zone.hazmatCertified,
      },
    }));

    return { id: zone.id, name: zone.name, zoneType: zone.zoneType };
  }
}
