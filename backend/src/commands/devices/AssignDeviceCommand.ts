import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface AssignDevicePayload {
  deviceId: string;
  shipmentId?: string;
  trackableUnitId?: string;
}

export const ASSIGN_DEVICE = 'device.assign';

export class AssignDeviceCommandHandler extends BaseCommandHandler<AssignDevicePayload, { id: string }> {
  readonly commandType = ASSIGN_DEVICE;
  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) { super(prisma, eventBus); }

  protected async handle(command: Command<AssignDevicePayload>, tx: TransactionClient, emit: EmitFn) {
    // Deactivate existing assignments
    await tx.deviceAssignment.updateMany({
      where: { deviceId: command.payload.deviceId, active: true },
      data: { active: false, unassignedAt: new Date() },
    });

    const assignment = await tx.deviceAssignment.create({
      data: {
        deviceId: command.payload.deviceId,
        shipmentId: command.payload.shipmentId,
        trackableUnitId: command.payload.trackableUnitId,
        active: true,
      },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.DEVICE_ASSIGNED,
      entityType: 'device',
      entityId: command.payload.deviceId,
      payload: {
        assignmentId: assignment.id,
        shipmentId: command.payload.shipmentId,
        trackableUnitId: command.payload.trackableUnitId,
      },
    }));

    return { id: assignment.id };
  }
}
