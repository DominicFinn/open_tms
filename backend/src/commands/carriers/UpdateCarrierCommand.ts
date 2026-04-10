import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface UpdateCarrierPayload {
  id: string;
  data: Record<string, unknown>;
}

export const UPDATE_CARRIER = 'carrier.update';

export class UpdateCarrierCommandHandler extends BaseCommandHandler<UpdateCarrierPayload, { id: string }> {
  readonly commandType = UPDATE_CARRIER;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<UpdateCarrierPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string }> {
    const { id, data } = command.payload;
    const updated = await tx.carrier.update({ where: { id }, data: data as any });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.CARRIER_UPDATED,
      entityType: 'carrier',
      entityId: id,
      payload: { name: updated.name, changes: Object.keys(data) },
    }));

    return { id };
  }
}
