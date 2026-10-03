import { DeviceAssignment, PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';
import {
  ASSIGNMENT_TARGET_NOT_FOUND,
  ASSIGNMENT_TARGET_REQUIRED,
  DEVICE_NOT_FOUND,
} from './errors.js';
import { releaseActiveAssignments } from './releaseActiveAssignments.js';

export type DeviceAssignmentPurpose = 'cargo_condition' | 'security' | 'location' | 'general';

export interface AssignDevicePayload {
  deviceId: string;
  shipmentId?: string;
  orderId?: string;
  trackableUnitId?: string;
  purpose?: DeviceAssignmentPurpose;
}

export const ASSIGN_DEVICE = 'device.assign';

export class AssignDeviceCommandHandler extends BaseCommandHandler<AssignDevicePayload, DeviceAssignment> {
  readonly commandType = ASSIGN_DEVICE;
  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) { super(prisma, eventBus); }

  protected async handle(command: Command<AssignDevicePayload>, tx: TransactionClient, emit: EmitFn) {
    const p = command.payload;
    const orgId = command.orgId;
    if (!p.shipmentId && !p.orderId && !p.trackableUnitId) throw new Error(ASSIGNMENT_TARGET_REQUIRED);

    const device = await tx.device.findFirst({ where: { id: p.deviceId, orgId }, select: { id: true } });
    if (!device) throw new Error(DEVICE_NOT_FOUND);
    if (!(await targetsBelongToOrg(tx, orgId, p))) throw new Error(ASSIGNMENT_TARGET_NOT_FOUND);

    const released = await releaseActiveAssignments(tx, orgId, p.deviceId);
    for (const assignmentId of released) {
      emit(this.createEvent(command, {
        type: EVENT_TYPES.DEVICE_UNASSIGNED,
        entityType: 'device',
        entityId: p.deviceId,
        payload: { assignmentId },
      }));
    }

    const assignment = await tx.deviceAssignment.create({
      data: {
        deviceId: p.deviceId,
        shipmentId: p.shipmentId ?? null,
        orderId: p.orderId ?? null,
        trackableUnitId: p.trackableUnitId ?? null,
        purpose: p.purpose ?? null,
        active: true,
      },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.DEVICE_ASSIGNED,
      entityType: 'device',
      entityId: p.deviceId,
      payload: {
        assignmentId: assignment.id,
        shipmentId: assignment.shipmentId,
        orderId: assignment.orderId,
        trackableUnitId: assignment.trackableUnitId,
        purpose: assignment.purpose,
      },
    }));

    return assignment;
  }
}

async function targetsBelongToOrg(tx: TransactionClient, orgId: string, p: AssignDevicePayload): Promise<boolean> {
  if (p.shipmentId) {
    const shipment = await tx.shipment.findFirst({ where: { id: p.shipmentId, orgId }, select: { id: true } });
    if (!shipment) return false;
  }
  if (p.orderId) {
    const order = await tx.order.findFirst({ where: { id: p.orderId, orgId }, select: { id: true } });
    if (!order) return false;
  }
  if (p.trackableUnitId) {
    // Trackable units carry no orgId; they belong to the org of their order.
    const unit = await tx.trackableUnit.findFirst({
      where: { id: p.trackableUnitId, order: { orgId } },
      select: { id: true },
    });
    if (!unit) return false;
  }
  return true;
}
