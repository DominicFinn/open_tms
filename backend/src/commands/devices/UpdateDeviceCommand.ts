import { Device, PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';
import { DEVICE_NOT_FOUND } from './errors.js';

export interface DeviceChanges {
  name?: string;
  status?: 'active' | 'inactive' | 'maintenance';
  displayId?: string;
  model?: string;
}

export interface UpdateDevicePayload {
  id: string;
  changes: DeviceChanges;
}

export const UPDATE_DEVICE = 'device.update';

export class UpdateDeviceCommandHandler extends BaseCommandHandler<UpdateDevicePayload, Device> {
  readonly commandType = UPDATE_DEVICE;
  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) { super(prisma, eventBus); }

  protected async handle(command: Command<UpdateDevicePayload>, tx: TransactionClient, emit: EmitFn) {
    const { id, changes } = command.payload;
    const existing = await tx.device.findFirst({ where: { id, orgId: command.orgId }, select: { id: true } });
    if (!existing) throw new Error(DEVICE_NOT_FOUND);

    const data: DeviceChanges = {};
    if (changes.name !== undefined) data.name = changes.name;
    if (changes.status !== undefined) data.status = changes.status;
    if (changes.displayId !== undefined) data.displayId = changes.displayId;
    if (changes.model !== undefined) data.model = changes.model;

    const device = await tx.device.update({ where: { id }, data });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.DEVICE_UPDATED,
      entityType: 'device',
      entityId: device.id,
      payload: { externalId: device.externalId, name: device.name, changes: Object.keys(data) },
    }));

    return device;
  }
}
