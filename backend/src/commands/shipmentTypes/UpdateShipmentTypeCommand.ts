import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface UpdateShipmentTypePayload {
  id: string;
  data: {
    name?: string;
    icon?: string;
    color?: string;
    description?: string | null;
    defaults?: Record<string, unknown>;
    requiredFields?: string[];
  };
}

export const UPDATE_SHIPMENT_TYPE = 'shipment_type.update';

export class UpdateShipmentTypeCommandHandler extends BaseCommandHandler<UpdateShipmentTypePayload, { id: string }> {
  readonly commandType = UPDATE_SHIPMENT_TYPE;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<UpdateShipmentTypePayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string }> {
    const { id, data } = command.payload;
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.icon !== undefined) updateData.icon = data.icon;
    if (data.color !== undefined) updateData.color = data.color;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.defaults !== undefined) updateData.defaults = data.defaults as any;
    if (data.requiredFields !== undefined) updateData.requiredFields = data.requiredFields;

    const updated = await tx.shipmentType.update({ where: { id }, data: updateData });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.SHIPMENT_TYPE_UPDATED,
      entityType: 'shipment_type',
      entityId: id,
      payload: { name: updated.name, changes: Object.keys(updateData) },
    }));

    return { id };
  }
}
