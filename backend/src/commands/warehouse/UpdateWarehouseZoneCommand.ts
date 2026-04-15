import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface UpdateWarehouseZonePayload {
  zoneId: string;
  name?: string;
  zoneType?: string;
  temperatureZone?: string | null;
  hazmatCertified?: boolean;
  maxWeightKg?: number | null;
  maxVolumeCbm?: number | null;
  sortOrder?: number;
  active?: boolean;
}

export const UPDATE_WAREHOUSE_ZONE = 'warehouse_zone.update';

export class UpdateWarehouseZoneCommandHandler extends BaseCommandHandler<
  UpdateWarehouseZonePayload,
  { id: string; name: string }
> {
  readonly commandType = UPDATE_WAREHOUSE_ZONE;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<UpdateWarehouseZonePayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string; name: string }> {
    const { zoneId, ...updates } = command.payload;

    const existing = await tx.warehouseZone.findUnique({ where: { id: zoneId } });
    if (!existing) throw new Error(`Zone ${zoneId} not found`);

    const zone = await tx.warehouseZone.update({
      where: { id: zoneId },
      data: updates,
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.WAREHOUSE_ZONE_UPDATED,
      entityType: 'warehouse_zone',
      entityId: zone.id,
      payload: {
        name: zone.name,
        zoneType: zone.zoneType,
        active: zone.active,
        changes: Object.keys(updates),
      },
    }));

    return { id: zone.id, name: zone.name };
  }
}
