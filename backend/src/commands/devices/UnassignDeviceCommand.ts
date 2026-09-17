import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';
import { DEVICE_NOT_FOUND } from './errors.js';
import { releaseActiveAssignments } from './releaseActiveAssignments.js';

export interface UnassignDevicePayload {
  deviceId: string;
}

export interface UnassignDeviceResult {
  unassigned: true;
  releasedAssignments: number;
}

export const UNASSIGN_DEVICE = 'device.unassign';

export class UnassignDeviceCommandHandler extends BaseCommandHandler<UnassignDevicePayload, UnassignDeviceResult> {
  readonly commandType = UNASSIGN_DEVICE;
  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) { super(prisma, eventBus); }

  protected async handle(command: Command<UnassignDevicePayload>, tx: TransactionClient, emit: EmitFn) {
    const { deviceId } = command.payload;
    const device = await tx.device.findFirst({ where: { id: deviceId, orgId: command.orgId }, select: { id: true } });
    if (!device) throw new Error(DEVICE_NOT_FOUND);

    const released = await releaseActiveAssignments(tx, deviceId);
    for (const assignmentId of released) {
      emit(this.createEvent(command, {
        type: EVENT_TYPES.DEVICE_UNASSIGNED,
        entityType: 'device',
        entityId: deviceId,
        payload: { assignmentId },
      }));
    }

    return { unassigned: true as const, releasedAssignments: released.length };
  }
}
