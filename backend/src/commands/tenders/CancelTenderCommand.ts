import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export const CANCEL_TENDER = 'tender.cancel';

export class CancelTenderCommandHandler extends BaseCommandHandler<{ id: string }, { id: string }> {
  readonly commandType = CANCEL_TENDER;
  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) { super(prisma, eventBus); }

  protected async handle(command: Command<{ id: string }>, tx: TransactionClient, emit: EmitFn) {
    const tender = await tx.tender.update({
      where: { id: command.payload.id },
      data: { status: 'cancelled', closedAt: new Date() },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.TENDER_CANCELLED,
      entityType: 'tender',
      entityId: tender.id,
      payload: { shipmentId: tender.shipmentId },
    }));

    return { id: tender.id };
  }
}
