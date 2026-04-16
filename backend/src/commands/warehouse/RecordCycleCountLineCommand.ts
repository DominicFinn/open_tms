import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface RecordCycleCountLinePayload {
  lineId: string;
  countedQuantity: number;
  notes?: string;
}

export const RECORD_CYCLE_COUNT_LINE = 'cycle_count.record_line';

export class RecordCycleCountLineCommandHandler extends BaseCommandHandler<
  RecordCycleCountLinePayload,
  { lineId: string; variance: number; countComplete: boolean }
> {
  readonly commandType = RECORD_CYCLE_COUNT_LINE;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<RecordCycleCountLinePayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ lineId: string; variance: number; countComplete: boolean }> {
    const p = command.payload;

    const line = await tx.cycleCountLine.findUnique({
      where: { id: p.lineId },
      include: { cycleCount: true },
    });
    if (!line) throw new Error(`Cycle count line ${p.lineId} not found`);
    if (line.status === 'adjusted') throw new Error('Line already adjusted');

    const count = line.cycleCount;
    if (count.status === 'completed' || count.status === 'cancelled') {
      throw new Error(`Cycle count is ${count.status}`);
    }

    // Auto-start count if planned
    if (count.status === 'planned') {
      await tx.cycleCount.update({
        where: { id: count.id },
        data: { status: 'in_progress', startedAt: new Date() },
      });

      emit(this.createEvent(command, {
        type: EVENT_TYPES.CYCLE_COUNT_STARTED,
        entityType: 'cycle_count',
        entityId: count.id,
        payload: { locationId: count.locationId },
      }));
    }

    const variance = p.countedQuantity - line.expectedQuantity;

    // Update the line
    await tx.cycleCountLine.update({
      where: { id: line.id },
      data: {
        countedQuantity: p.countedQuantity,
        variance,
        status: 'counted',
        countedByUserId: command.actorId,
        countedAt: new Date(),
        notes: p.notes ?? null,
      },
    });

    // Update count progress
    const countedBins = await tx.cycleCountLine.count({
      where: { cycleCountId: count.id, status: { not: 'pending' } },
    });
    const varianceCount = await tx.cycleCountLine.count({
      where: { cycleCountId: count.id, variance: { not: 0 }, countedQuantity: { not: null } },
    });

    await tx.cycleCount.update({
      where: { id: count.id },
      data: { countedBins, varianceCount },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.CYCLE_COUNT_LINE_RECORDED,
      entityType: 'cycle_count_line',
      entityId: line.id,
      payload: {
        cycleCountId: count.id,
        binId: line.binId,
        sku: line.sku,
        expected: line.expectedQuantity,
        counted: p.countedQuantity,
        variance,
      },
    }));

    if (variance !== 0) {
      emit(this.createEvent(command, {
        type: EVENT_TYPES.CYCLE_COUNT_VARIANCE_DETECTED,
        entityType: 'cycle_count_line',
        entityId: line.id,
        payload: {
          cycleCountId: count.id,
          binId: line.binId,
          sku: line.sku,
          expected: line.expectedQuantity,
          counted: p.countedQuantity,
          variance,
        },
      }));
    }

    // Check if all lines are counted
    const countComplete = countedBins >= count.totalBins;
    if (countComplete) {
      await tx.cycleCount.update({
        where: { id: count.id },
        data: { status: 'completed', completedAt: new Date() },
      });

      // Auto-adjust inventory for variances
      const varianceLines = await tx.cycleCountLine.findMany({
        where: { cycleCountId: count.id, variance: { not: 0 }, countedQuantity: { not: null } },
      });

      for (const vLine of varianceLines) {
        if (vLine.inventoryRecordId && vLine.countedQuantity !== null) {
          const invRecord = await tx.inventoryRecord.findUnique({ where: { id: vLine.inventoryRecordId } });
          if (invRecord) {
            const prevQty = invRecord.quantityOnHand;
            await tx.inventoryRecord.update({
              where: { id: invRecord.id },
              data: {
                quantityOnHand: vLine.countedQuantity,
                quantityAvailable: vLine.countedQuantity - invRecord.quantityAllocated - invRecord.quantityOnHold,
                lastCountedAt: new Date(),
              },
            });

            await tx.inventoryTransaction.create({
              data: {
                inventoryRecordId: invRecord.id,
                transactionType: 'cycle_count',
                quantityChange: vLine.variance!,
                previousQuantity: prevQty,
                newQuantity: vLine.countedQuantity,
                reasonCode: 'recount',
                referenceType: 'cycle_count',
                referenceId: count.id,
                performedBy: command.actorId,
                orgId: command.orgId,
              },
            });
          }

          await tx.cycleCountLine.update({
            where: { id: vLine.id },
            data: { status: 'adjusted' },
          });
        }
      }

      // Mark non-variance lines as adjusted too
      await tx.cycleCountLine.updateMany({
        where: { cycleCountId: count.id, status: 'counted', variance: 0 },
        data: { status: 'adjusted' },
      });

      // Update lastCountedAt for all counted records
      const allLines = await tx.cycleCountLine.findMany({
        where: { cycleCountId: count.id, inventoryRecordId: { not: null } },
      });
      const invIds = allLines.map(l => l.inventoryRecordId).filter(Boolean) as string[];
      if (invIds.length > 0) {
        await tx.inventoryRecord.updateMany({
          where: { id: { in: invIds } },
          data: { lastCountedAt: new Date() },
        });
      }

      emit(this.createEvent(command, {
        type: EVENT_TYPES.CYCLE_COUNT_COMPLETED,
        entityType: 'cycle_count',
        entityId: count.id,
        payload: {
          locationId: count.locationId,
          totalBins: count.totalBins,
          varianceCount: varianceLines.length,
          adjustmentsApplied: varianceLines.length,
        },
      }));
    }

    return { lineId: line.id, variance, countComplete };
  }
}
