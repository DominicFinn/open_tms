import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';
import { loadFacilityForWrite } from '../facilities/resolveFacility.js';

export interface CreateReceivingTaskPayload {
  facilityId: string;
  appointmentId?: string | null;
  inboundShipmentId?: string | null;
  dockBinId?: string | null;
  receivingType: string;    // 'asn' | 'blind'
  crossDock?: boolean;
  assignedToUserId?: string | null;
  /** Pre-populate lines from expected items (ASN-based receiving) */
  expectedLines?: Array<{
    sku: string;
    uomCode?: string;
    expectedQuantity: number;
    orderLineItemId?: string | null;
    lotNumber?: string | null;
    expiryDate?: string | null;
  }>;
}

export const CREATE_RECEIVING_TASK = 'receiving_task.create';

export class CreateReceivingTaskCommandHandler extends BaseCommandHandler<
  CreateReceivingTaskPayload,
  { id: string; status: string; lineCount: number }
> {
  readonly commandType = CREATE_RECEIVING_TASK;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<CreateReceivingTaskPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string; status: string; lineCount: number }> {
    const p = command.payload;

    // An appointment belonging to another tenant would be moved to 'receiving' by the update
    // below, and our task would hang off their booking. Checked against the caller's org rather
    // than trusted from the request body (#220).
    if (p.appointmentId) {
      const appointment = await tx.receivingAppointment.findFirst({
        where: { id: p.appointmentId, orgId: command.orgId },
        select: { id: true },
      });
      if (!appointment) throw new Error(`Appointment ${p.appointmentId} not found`);
    }

    // Phase 2a (#248): the caller names the facility. locationId is still written from the
    // facility's source location until 6c drops the column, and is null in a warehouse-only
    // install.
    const facility = await loadFacilityForWrite(tx, command.orgId, p.facilityId);

    const task = await tx.receivingTask.create({
      data: {
        facilityId: facility.id,
        locationId: facility.sourceLocationId,
        appointmentId: p.appointmentId ?? null,
        inboundShipmentId: p.inboundShipmentId ?? null,
        dockBinId: p.dockBinId ?? null,
        receivingType: p.receivingType,
        crossDock: p.crossDock ?? false,
        assignedToUserId: p.assignedToUserId ?? null,
        status: 'pending',
        orgId: command.orgId,
      },
    });

    // Create expected lines if provided (ASN-based)
    let lineCount = 0;
    if (p.expectedLines && p.expectedLines.length > 0) {
      await tx.receivingLine.createMany({
        data: p.expectedLines.map(line => ({
          receivingTaskId: task.id,
          sku: line.sku,
          uomCode: line.uomCode ?? 'EA',
          expectedQuantity: line.expectedQuantity,
          orderLineItemId: line.orderLineItemId ?? null,
          lotNumber: line.lotNumber ?? null,
          expiryDate: line.expiryDate ? new Date(line.expiryDate) : null,
          receivedQuantity: 0,
          damagedQuantity: 0,
          inspectionStatus: 'pending',
        })),
      });
      lineCount = p.expectedLines.length;
    }

    // If linked to an appointment, update its status
    if (p.appointmentId) {
      await tx.receivingAppointment.update({
        where: { id: p.appointmentId },
        data: { status: 'receiving' },
      });
    }

    emit(this.createEvent(command, {
      type: EVENT_TYPES.RECEIVING_TASK_CREATED,
      entityType: 'receiving_task',
      entityId: task.id,
      payload: {
        locationId: task.locationId,
        receivingType: task.receivingType,
        crossDock: task.crossDock,
        inboundShipmentId: task.inboundShipmentId,
        lineCount,
      },
    }));

    return { id: task.id, status: task.status, lineCount };
  }
}
