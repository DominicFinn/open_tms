import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface UpdateLanePayload {
  id: string;
  data: {
    originId?: string;
    destinationId?: string;
    distance?: number;
    notes?: string;
    status?: string;
    name?: string;
  };
  stops?: Array<{ locationId: string; order: number; notes?: string }>;
}

export const UPDATE_LANE = 'lane.update';

export class UpdateLaneCommandHandler extends BaseCommandHandler<UpdateLanePayload, { id: string }> {
  readonly commandType = UPDATE_LANE;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<UpdateLanePayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string }> {
    const { id, data, stops } = command.payload;

    const updated = await tx.lane.update({ where: { id }, data: data as any });

    // Replace stops if provided
    if (stops) {
      await tx.laneStop.deleteMany({ where: { laneId: id } });
      if (stops.length > 0) {
        await tx.laneStop.createMany({
          data: stops.map((s) => ({ ...s, laneId: id })),
        });
      }
    }

    emit(this.createEvent(command, {
      type: EVENT_TYPES.LANE_UPDATED,
      entityType: 'lane',
      entityId: id,
      payload: { name: updated.name, changes: Object.keys(data) },
    }));

    return { id };
  }
}
