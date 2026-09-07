import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface InspectReceivingLinePayload {
  lineId: string;
  inspectionStatus: string;
}

export const INSPECT_RECEIVING_LINE = 'receiving_line.inspect';

export class InspectReceivingLineCommandHandler extends BaseCommandHandler<
  InspectReceivingLinePayload,
  { id: string; inspectionStatus: string }
> {
  readonly commandType = INSPECT_RECEIVING_LINE;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<InspectReceivingLinePayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string; inspectionStatus: string }> {
    const p = command.payload;

    // ReceivingLine carries no orgId of its own, so it is scoped through its task.
    const existing = await tx.receivingLine.findFirst({
      where: { id: p.lineId, receivingTask: { orgId: command.orgId } },
      select: { id: true, inspectionStatus: true, receivingTaskId: true, sku: true },
    });
    if (!existing) throw new Error(`Receiving line ${p.lineId} not found`);

    const line = await tx.receivingLine.update({
      where: { id: p.lineId },
      data: { inspectionStatus: p.inspectionStatus },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.RECEIVING_LINE_INSPECTED,
      entityType: 'receiving_line',
      entityId: line.id,
      payload: {
        receivingTaskId: line.receivingTaskId,
        sku: line.sku,
        previousStatus: existing.inspectionStatus,
        inspectionStatus: line.inspectionStatus,
      },
    }));

    return { id: line.id, inspectionStatus: line.inspectionStatus };
  }
}
