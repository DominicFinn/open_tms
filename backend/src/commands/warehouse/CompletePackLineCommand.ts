import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface CompletePackLinePayload {
  packLineId: string;
  packedQuantity: number;
  /** TrackableUnit ID for the outbound package this item is packed into */
  trackableUnitId?: string;
}

export const COMPLETE_PACK_LINE = 'pack_line.complete';

export class CompletePackLineCommandHandler extends BaseCommandHandler<
  CompletePackLinePayload,
  { packLineId: string; status: string; taskComplete: boolean }
> {
  readonly commandType = COMPLETE_PACK_LINE;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<CompletePackLinePayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ packLineId: string; status: string; taskComplete: boolean }> {
    const p = command.payload;

    const line = await tx.packLine.findUnique({
      where: { id: p.packLineId },
      include: { packTask: true },
    });
    if (!line) throw new Error(`Pack line ${p.packLineId} not found`);
    if (line.status === 'packed') throw new Error('Line is already packed');

    const task = line.packTask;
    if (task.status === 'completed' || task.status === 'cancelled') {
      throw new Error(`Pack task is ${task.status}`);
    }

    // Auto-start task if pending
    if (task.status === 'pending') {
      await tx.packTask.update({
        where: { id: task.id },
        data: { status: 'in_progress' },
      });
    }

    // Verify quantity
    const verified = p.packedQuantity === line.expectedQuantity;
    const lineStatus = verified ? 'packed' : 'verified';

    await tx.packLine.update({
      where: { id: line.id },
      data: {
        packedQuantity: p.packedQuantity,
        status: p.packedQuantity > 0 ? 'packed' : 'verified',
        trackableUnitId: p.trackableUnitId ?? line.trackableUnitId,
      },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.PACK_LINE_VERIFIED,
      entityType: 'pack_line',
      entityId: line.id,
      payload: {
        packTaskId: task.id,
        sku: line.sku,
        expectedQuantity: line.expectedQuantity,
        packedQuantity: p.packedQuantity,
        verified,
      },
    }));

    // Check if all lines are done
    const totalLines = await tx.packLine.count({ where: { packTaskId: task.id } });
    const completedLines = await tx.packLine.count({
      where: { packTaskId: task.id, status: { in: ['packed', 'verified'] } },
    });

    const taskComplete = completedLines >= totalLines;
    if (taskComplete) {
      await tx.packTask.update({
        where: { id: task.id },
        data: { status: 'completed' },
      });

      emit(this.createEvent(command, {
        type: EVENT_TYPES.PACK_TASK_COMPLETED,
        entityType: 'pack_task',
        entityId: task.id,
        payload: {
          orderId: task.orderId,
          totalLines,
          pickTaskId: task.pickTaskId,
        },
      }));
    }

    return {
      packLineId: line.id,
      status: p.packedQuantity > 0 ? 'packed' : 'verified',
      taskComplete,
    };
  }
}
