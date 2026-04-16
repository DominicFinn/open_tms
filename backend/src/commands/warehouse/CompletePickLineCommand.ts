import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface CompletePickLinePayload {
  pickLineId: string;
  pickedQuantity: number;
  /** If less than requested, what to do with the remainder */
  shortPickAction?: 'backorder' | 'cancel_line';
}

export const COMPLETE_PICK_LINE = 'pick_line.complete';

export class CompletePickLineCommandHandler extends BaseCommandHandler<
  CompletePickLinePayload,
  { pickLineId: string; status: string; pickedQuantity: number; short: boolean; taskComplete: boolean }
> {
  readonly commandType = COMPLETE_PICK_LINE;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<CompletePickLinePayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ pickLineId: string; status: string; pickedQuantity: number; short: boolean; taskComplete: boolean }> {
    const p = command.payload;

    const line = await tx.pickLine.findUnique({
      where: { id: p.pickLineId },
      include: { pickTask: true },
    });
    if (!line) throw new Error(`Pick line ${p.pickLineId} not found`);
    if (line.status === 'picked' || line.status === 'skipped') {
      throw new Error(`Line is already ${line.status}`);
    }

    const task = line.pickTask;
    if (task.status === 'completed' || task.status === 'cancelled') {
      throw new Error(`Pick task is ${task.status}`);
    }

    // Auto-start task if pending
    if (task.status === 'pending') {
      await tx.pickTask.update({
        where: { id: task.id },
        data: { status: 'in_progress', startedAt: new Date() },
      });
    }

    const short = p.pickedQuantity < line.requestedQuantity;
    const lineStatus = short ? 'short' : 'picked';

    // Update pick line
    await tx.pickLine.update({
      where: { id: line.id },
      data: {
        pickedQuantity: p.pickedQuantity,
        status: lineStatus,
        shortPickAction: short ? (p.shortPickAction ?? 'backorder') : null,
      },
    });

    // Deduct from inventory
    if (p.pickedQuantity > 0) {
      const invRecord = await tx.inventoryRecord.findUnique({ where: { id: line.inventoryRecordId } });
      if (invRecord) {
        await tx.inventoryRecord.update({
          where: { id: invRecord.id },
          data: {
            quantityOnHand: { decrement: p.pickedQuantity },
            quantityAllocated: { decrement: p.pickedQuantity },
          },
        });

        await tx.inventoryTransaction.create({
          data: {
            inventoryRecordId: invRecord.id,
            transactionType: 'pick',
            quantityChange: -p.pickedQuantity,
            previousQuantity: invRecord.quantityOnHand,
            newQuantity: invRecord.quantityOnHand - p.pickedQuantity,
            referenceType: 'pick_task',
            referenceId: task.id,
            performedBy: command.actorId,
            orgId: command.orgId,
          },
        });
      }
    }

    // Release unneeded allocation for short picks
    if (short) {
      const shortQty = line.requestedQuantity - p.pickedQuantity;

      if (p.shortPickAction === 'cancel_line') {
        // Release the allocation back to available
        await tx.inventoryRecord.update({
          where: { id: line.inventoryRecordId },
          data: {
            quantityAllocated: { decrement: shortQty },
            quantityAvailable: { increment: shortQty },
          },
        });
      }
      // backorder: keep allocated for next wave

      emit(this.createEvent(command, {
        type: EVENT_TYPES.PICK_LINE_SHORT,
        entityType: 'pick_line',
        entityId: line.id,
        payload: {
          pickTaskId: task.id,
          sku: line.sku,
          requested: line.requestedQuantity,
          picked: p.pickedQuantity,
          shortQty,
          action: p.shortPickAction ?? 'backorder',
        },
      }));
    }

    // Update task progress
    const completedLines = await tx.pickLine.count({
      where: { pickTaskId: task.id, status: { in: ['picked', 'short', 'skipped'] } },
    });

    await tx.pickTask.update({
      where: { id: task.id },
      data: { completedLines },
    });

    // Check if task is fully complete
    const taskComplete = completedLines >= task.totalLines;
    if (taskComplete) {
      const hasShorts = await tx.pickLine.count({
        where: { pickTaskId: task.id, status: 'short' },
      });
      await tx.pickTask.update({
        where: { id: task.id },
        data: {
          status: hasShorts > 0 ? 'short_pick' : 'completed',
          completedAt: new Date(),
        },
      });

      emit(this.createEvent(command, {
        type: EVENT_TYPES.PICK_TASK_COMPLETED,
        entityType: 'pick_task',
        entityId: task.id,
        payload: {
          waveId: task.waveId,
          pickType: task.pickType,
          totalLines: task.totalLines,
          completedLines,
          hasShorts: hasShorts > 0,
        },
      }));

      // Check if the entire wave is complete
      if (task.waveId) {
        const remainingTasks = await tx.pickTask.count({
          where: { waveId: task.waveId, status: { notIn: ['completed', 'short_pick', 'cancelled'] } },
        });
        if (remainingTasks === 0) {
          await tx.wave.update({
            where: { id: task.waveId },
            data: { status: 'completed' },
          });
          emit(this.createEvent(command, {
            type: EVENT_TYPES.WAVE_COMPLETED,
            entityType: 'wave',
            entityId: task.waveId,
            payload: { waveId: task.waveId },
          }));
        }
      }
    }

    emit(this.createEvent(command, {
      type: EVENT_TYPES.PICK_LINE_COMPLETED,
      entityType: 'pick_line',
      entityId: line.id,
      payload: {
        pickTaskId: task.id,
        sku: line.sku,
        binId: line.binId,
        requestedQuantity: line.requestedQuantity,
        pickedQuantity: p.pickedQuantity,
        short,
      },
    }));

    return {
      pickLineId: line.id,
      status: lineStatus,
      pickedQuantity: p.pickedQuantity,
      short,
      taskComplete,
    };
  }
}
