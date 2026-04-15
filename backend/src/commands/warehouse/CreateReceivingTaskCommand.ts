import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface CreateReceivingTaskPayload {
  locationId: string;
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

    const task = await tx.receivingTask.create({
      data: {
        locationId: p.locationId,
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
