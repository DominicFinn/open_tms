import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export const UPDATE_DEVICE = 'device.update';

export class UpdateDeviceCommandHandler extends BaseCommandHandler<{ id: string; data: Record<string, any> }, { id: string }> {
  readonly commandType = UPDATE_DEVICE;
  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) { super(prisma, eventBus); }

  protected async handle(command: Command<{ id: string; data: Record<string, any> }>, tx: TransactionClient, emit: EmitFn) {
    const device = await tx.device.update({
      where: { id: command.payload.id },
      data: command.payload.data,
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.DEVICE_UPDATED,
      entityType: 'device',
      entityId: device.id,
      payload: { externalId: device.externalId, name: device.name, changes: Object.keys(command.payload.data) },
    }));

    return { id: device.id };
  }
}
