import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface AssignPutawayTaskPayload {
  taskId: string;
  assignedToUserId: string;
}

export const ASSIGN_PUTAWAY_TASK = 'putaway_task.assign';

export class AssignPutawayTaskCommandHandler extends BaseCommandHandler<
  AssignPutawayTaskPayload,
  { id: string; status: string; assignedToUserId: string }
> {
  readonly commandType = ASSIGN_PUTAWAY_TASK;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<AssignPutawayTaskPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string; status: string; assignedToUserId: string }> {
    const task = await tx.putawayTask.findUnique({ where: { id: command.payload.taskId } });
    if (!task) throw new Error(`Putaway task ${command.payload.taskId} not found`);
    if (task.status === 'completed' || task.status === 'cancelled') {
      throw new Error(`Task is ${task.status}, cannot assign`);
    }

    const updated = await tx.putawayTask.update({
      where: { id: task.id },
      data: {
        assignedToUserId: command.payload.assignedToUserId,
        status: 'assigned',
      },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.PUTAWAY_TASK_ASSIGNED,
      entityType: 'putaway_task',
      entityId: task.id,
      payload: {
        assignedToUserId: command.payload.assignedToUserId,
        trackableUnitId: task.trackableUnitId,
        targetBinId: task.targetBinId,
      },
    }));

    return { id: updated.id, status: updated.status, assignedToUserId: updated.assignedToUserId! };
  }
}
