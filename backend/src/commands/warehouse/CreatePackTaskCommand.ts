import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface CreatePackTaskPayload {
  locationId: string;
  orderId: string;
  pickTaskId?: string | null;
  packStationBinId?: string | null;
  /** Lines to pack - typically generated from completed pick lines */
  lines: Array<{
    orderLineItemId: string;
    trackableUnitId: string;
    sku: string;
    expectedQuantity: number;
  }>;
}

export const CREATE_PACK_TASK = 'pack_task.create';

export class CreatePackTaskCommandHandler extends BaseCommandHandler<
  CreatePackTaskPayload,
  { id: string; status: string; lineCount: number }
> {
  readonly commandType = CREATE_PACK_TASK;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<CreatePackTaskPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string; status: string; lineCount: number }> {
    const p = command.payload;

    if (p.lines.length === 0) throw new Error('Pack task must have at least one line');

    const task = await tx.packTask.create({
      data: {
        locationId: p.locationId,
        orderId: p.orderId,
        pickTaskId: p.pickTaskId ?? null,
        packStationBinId: p.packStationBinId ?? null,
        status: 'pending',
        orgId: command.orgId,
      },
    });

    await tx.packLine.createMany({
      data: p.lines.map(l => ({
        packTaskId: task.id,
        orderLineItemId: l.orderLineItemId,
        trackableUnitId: l.trackableUnitId,
        sku: l.sku,
        expectedQuantity: l.expectedQuantity,
        packedQuantity: 0,
        status: 'pending',
      })),
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.PACK_TASK_CREATED,
      entityType: 'pack_task',
      entityId: task.id,
      payload: {
        orderId: p.orderId,
        pickTaskId: p.pickTaskId,
        lineCount: p.lines.length,
      },
    }));

    return { id: task.id, status: 'pending', lineCount: p.lines.length };
  }
}
