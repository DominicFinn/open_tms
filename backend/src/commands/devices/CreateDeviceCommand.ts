import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface CreateDevicePayload {
  externalId: string;
  name: string;
  provider?: string;
  model?: string;
  displayId?: string;
  [key: string]: any;
}

export const CREATE_DEVICE = 'device.create';

export class CreateDeviceCommandHandler extends BaseCommandHandler<CreateDevicePayload, { id: string }> {
  readonly commandType = CREATE_DEVICE;
  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) { super(prisma, eventBus); }

  protected async handle(command: Command<CreateDevicePayload>, tx: TransactionClient, emit: EmitFn) {
    const device = await tx.device.create({ data: command.payload as any });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.DEVICE_CREATED,
      entityType: 'device',
      entityId: device.id,
      payload: { externalId: device.externalId, name: device.name, provider: device.provider },
    }));

    return { id: device.id };
  }
}
