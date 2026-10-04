import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface UpdateConsolidationPayload {
  id: string;
  carrierId?: string | null;
  notes?: string | null;
}

export const UPDATE_CONSOLIDATION = 'consolidation.update';

export class UpdateConsolidationCommandHandler extends BaseCommandHandler<UpdateConsolidationPayload, { id: string }> {
  readonly commandType = UPDATE_CONSOLIDATION;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<UpdateConsolidationPayload>,
    tx: TransactionClient,
    emit: EmitFn,
  ): Promise<{ id: string }> {
    const { orgId } = command;
    const { id, carrierId, notes } = command.payload;

    const existing = await tx.consolidation.findFirst({ where: { id, orgId }, select: { id: true } });
    if (!existing) throw new Error('Consolidation not found');
    if (carrierId) {
      const carrier = await tx.carrier.findFirst({ where: { id: carrierId, orgId }, select: { id: true } });
      if (!carrier) throw new Error('Carrier not found');
    }

    const data: { carrierId?: string | null; notes?: string | null } = {};
    if (carrierId !== undefined) data.carrierId = carrierId;
    if (notes !== undefined) data.notes = notes;
    await tx.consolidation.update({ where: { id, orgId }, data });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.CONSOLIDATION_UPDATED,
      entityType: 'consolidation',
      entityId: id,
      payload: { changes: Object.keys(data) },
    }));

    return { id };
  }
}
