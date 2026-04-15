import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface CompleteReceivingPayload {
  taskId: string;
}

export const COMPLETE_RECEIVING = 'receiving_task.complete';

export class CompleteReceivingCommandHandler extends BaseCommandHandler<
  CompleteReceivingPayload,
  { id: string; status: string; totalReceived: number; totalDamaged: number; putawayTasksCreated: number }
> {
  readonly commandType = COMPLETE_RECEIVING;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<CompleteReceivingPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string; status: string; totalReceived: number; totalDamaged: number; putawayTasksCreated: number }> {
    const task = await tx.receivingTask.findUnique({
      where: { id: command.payload.taskId },
      include: { lines: true },
    });
    if (!task) throw new Error(`Receiving task ${command.payload.taskId} not found`);
    if (task.status === 'completed') throw new Error('Task is already completed');
    if (task.status === 'cancelled') throw new Error('Task is cancelled');

    // Tally up totals
    const totalReceived = task.lines.reduce((sum: number, l: any) => sum + l.receivedQuantity, 0);
    const totalDamaged = task.lines.reduce((sum: number, l: any) => sum + l.damagedQuantity, 0);

    // Mark task as completed
    await tx.receivingTask.update({
      where: { id: task.id },
      data: { status: 'completed' },
    });

    // Mark appointment as completed if linked
    if (task.appointmentId) {
      await tx.receivingAppointment.update({
        where: { id: task.appointmentId },
        data: { status: 'completed' },
      });
    }

    // Generate putaway tasks for received units that have trackableUnitIds
    let putawayTasksCreated = 0;
    const linesWithUnits = task.lines.filter((l: any) => l.trackableUnitId && l.receivedQuantity > 0);

    if (linesWithUnits.length > 0 && !task.crossDock) {
      // Find a putaway target using rules, or fall back to first bulk bin
      const rules = await tx.putawayRule.findMany({
        where: { locationId: task.locationId, active: true },
        orderBy: { priority: 'asc' },
      });

      // Simple fallback: find first available bulk storage bin
      const fallbackBin = await tx.warehouseBin.findFirst({
        where: {
          locationId: task.locationId,
          active: true,
          zone: { zoneType: 'bulk_storage', active: true },
        },
        orderBy: { walkSequence: 'asc' },
      });

      for (const line of linesWithUnits) {
        // Try to match a rule
        let targetBinId: string | null = null;

        for (const rule of rules) {
          if (this.matchesRule(rule, line)) {
            const bin = await this.resolveRuleTarget(tx, rule);
            if (bin) {
              targetBinId = bin.id;
              break;
            }
          }
        }

        if (!targetBinId && fallbackBin) {
          targetBinId = fallbackBin.id;
        }

        if (targetBinId) {
          await tx.putawayTask.create({
            data: {
              locationId: task.locationId,
              receivingTaskId: task.id,
              trackableUnitId: (line as any).trackableUnitId,
              sourceBinId: task.dockBinId ?? null,
              targetBinId,
              status: 'pending',
              putawayType: 'directed',
              orgId: command.orgId,
            },
          });

          emit(this.createEvent(command, {
            type: EVENT_TYPES.PUTAWAY_TASK_CREATED,
            entityType: 'putaway_task',
            entityId: (line as any).trackableUnitId,
            payload: {
              locationId: task.locationId,
              trackableUnitId: (line as any).trackableUnitId,
              targetBinId,
              receivingTaskId: task.id,
            },
          }));

          putawayTasksCreated++;
        }
      }
    }

    emit(this.createEvent(command, {
      type: EVENT_TYPES.RECEIVING_TASK_COMPLETED,
      entityType: 'receiving_task',
      entityId: task.id,
      payload: {
        locationId: task.locationId,
        receivingType: task.receivingType,
        totalReceived,
        totalDamaged,
        lineCount: task.lines.length,
        putawayTasksCreated,
        crossDock: task.crossDock,
      },
    }));

    return {
      id: task.id,
      status: 'completed',
      totalReceived,
      totalDamaged,
      putawayTasksCreated,
    };
  }

  private matchesRule(rule: any, line: any): boolean {
    if (rule.skuPattern) {
      const regex = new RegExp('^' + rule.skuPattern.replace(/\*/g, '.*') + '$', 'i');
      if (!regex.test(line.sku)) return false;
    }
    if (rule.unitType && line.unitType !== rule.unitType) return false;
    return true;
  }

  private async resolveRuleTarget(tx: TransactionClient, rule: any) {
    if (rule.targetType === 'specific_bin' && rule.targetBinId) {
      return tx.warehouseBin.findFirst({ where: { id: rule.targetBinId, active: true } });
    }
    if (rule.targetZoneId) {
      return tx.warehouseBin.findFirst({
        where: { zoneId: rule.targetZoneId, active: true },
        orderBy: { walkSequence: 'asc' },
      });
    }
    return null;
  }
}
