import { Device, PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';
import { DEVICE_EXTERNAL_ID_TAKEN } from './errors.js';

export interface CreateDevicePayload {
  externalId: string;
  name: string;
  provider?: string;
  model?: string;
  displayId?: string;
}

export const CREATE_DEVICE = 'device.create';

export class CreateDeviceCommandHandler extends BaseCommandHandler<CreateDevicePayload, Device> {
  readonly commandType = CREATE_DEVICE;
  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) { super(prisma, eventBus); }

  protected async handle(command: Command<CreateDevicePayload>, tx: TransactionClient, emit: EmitFn) {
    const p = command.payload;

    // A provider's device id identifies one physical device, so it can only be registered once
    // across the whole platform.
    // tenancy-exempt: externalId is unique platform-wide; the caller only learns the id is taken
    const existing = await tx.device.findUnique({ where: { externalId: p.externalId }, select: { id: true } });
    if (existing) throw new Error(DEVICE_EXTERNAL_ID_TAKEN);

    const device = await tx.device.create({
      data: {
        orgId: command.orgId,
        externalId: p.externalId,
        name: p.name,
        provider: p.provider ?? 'system_loco',
        model: p.model ?? null,
        displayId: p.displayId ?? null,
        status: 'active',
      },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.DEVICE_CREATED,
      entityType: 'device',
      entityId: device.id,
      payload: { externalId: device.externalId, name: device.name, provider: device.provider },
    }));

    return device;
  }
}
