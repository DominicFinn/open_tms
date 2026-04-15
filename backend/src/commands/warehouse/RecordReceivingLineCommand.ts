import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface RecordReceivingLinePayload {
  taskId: string;
  /** If updating an existing line (ASN mode), provide the line ID */
  lineId?: string;
  /** If creating a new line (blind mode), provide item details */
  sku?: string;
  uomCode?: string;
  receivedQuantity: number;
  damagedQuantity?: number;
  trackableUnitId?: string | null;
  lotNumber?: string | null;
  expiryDate?: string | null;
}

export const RECORD_RECEIVING_LINE = 'receiving_line.record';

export class RecordReceivingLineCommandHandler extends BaseCommandHandler<
  RecordReceivingLinePayload,
  { lineId: string; receivedQuantity: number; damagedQuantity: number }
> {
  readonly commandType = RECORD_RECEIVING_LINE;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<RecordReceivingLinePayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ lineId: string; receivedQuantity: number; damagedQuantity: number }> {
    const p = command.payload;

    // Verify task exists and is in-progress
    const task = await tx.receivingTask.findUnique({ where: { id: p.taskId } });
    if (!task) throw new Error(`Receiving task ${p.taskId} not found`);
    if (task.status !== 'in_progress' && task.status !== 'pending') {
      throw new Error(`Task is ${task.status}, cannot record lines`);
    }

    // Auto-start the task if still pending
    if (task.status === 'pending') {
      await tx.receivingTask.update({
        where: { id: p.taskId },
        data: { status: 'in_progress' },
      });

      emit(this.createEvent(command, {
        type: EVENT_TYPES.RECEIVING_TASK_STARTED,
        entityType: 'receiving_task',
        entityId: p.taskId,
        payload: { locationId: task.locationId },
      }));
    }

    let line;

    if (p.lineId) {
      // Update existing line (ASN mode - recording against expected)
      line = await tx.receivingLine.update({
        where: { id: p.lineId },
        data: {
          receivedQuantity: p.receivedQuantity,
          damagedQuantity: p.damagedQuantity ?? 0,
          trackableUnitId: p.trackableUnitId ?? undefined,
          lotNumber: p.lotNumber ?? undefined,
          expiryDate: p.expiryDate ? new Date(p.expiryDate) : undefined,
        },
      });
    } else {
      // Create new line (blind mode)
      if (!p.sku) throw new Error('SKU is required for blind receiving');
      line = await tx.receivingLine.create({
        data: {
          receivingTaskId: p.taskId,
          sku: p.sku,
          uomCode: p.uomCode ?? 'EA',
          expectedQuantity: null,
          receivedQuantity: p.receivedQuantity,
          damagedQuantity: p.damagedQuantity ?? 0,
          trackableUnitId: p.trackableUnitId ?? null,
          lotNumber: p.lotNumber ?? null,
          expiryDate: p.expiryDate ? new Date(p.expiryDate) : null,
          inspectionStatus: 'pending',
        },
      });
    }

    emit(this.createEvent(command, {
      type: EVENT_TYPES.RECEIVING_LINE_RECORDED,
      entityType: 'receiving_line',
      entityId: line.id,
      payload: {
        taskId: p.taskId,
        sku: line.sku,
        receivedQuantity: line.receivedQuantity,
        damagedQuantity: line.damagedQuantity,
        lotNumber: line.lotNumber,
      },
    }));

    return {
      lineId: line.id,
      receivedQuantity: line.receivedQuantity,
      damagedQuantity: line.damagedQuantity,
    };
  }
}
