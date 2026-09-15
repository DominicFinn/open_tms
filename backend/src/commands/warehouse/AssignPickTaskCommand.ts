import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface AssignPickTaskPayload {
  taskId: string;
  assignedToUserId: string;
}

export const ASSIGN_PICK_TASK = 'pick_task.assign';

export class AssignPickTaskCommandHandler extends BaseCommandHandler<
  AssignPickTaskPayload,
  { id: string; status: string }
> {
  readonly commandType = ASSIGN_PICK_TASK;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<AssignPickTaskPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string; status: string }> {
    const { taskId, assignedToUserId } = command.payload;

    // Re-read inside the transaction, scoped by org: two supervisors can assign the same task at
    // once, and the route previously read it with no tenant filter at all.
    const existing = await tx.pickTask.findFirst({
      where: { id: taskId, orgId: command.orgId },
      select: { id: true, status: true, assignedToUserId: true },
    });
    if (!existing) throw new Error(`Pick task ${taskId} not found`);

    // BUSINESS RULE: a finished pick cannot be handed to someone else. Reassigning one already in
    // progress is allowed, since a picker can be pulled off a job mid-walk.
    if (existing.status === 'completed' || existing.status === 'cancelled') {
      throw new Error(`Cannot assign a pick task in status "${existing.status}"`);
    }

    const updated = await tx.pickTask.update({
      where: { id: taskId },
      data: { assignedToUserId, status: 'assigned' },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.PICK_TASK_ASSIGNED,
      entityType: 'pick_task',
      entityId: updated.id,
      payload: {
        waveId: updated.waveId,
        assignedToUserId,
        previousAssigneeId: existing.assignedToUserId,
        previousStatus: existing.status,
      },
    }));

    return { id: updated.id, status: updated.status };
  }
}
