import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export const OPEN_TENDER = 'tender.open';

export class OpenTenderCommandHandler extends BaseCommandHandler<{ id: string }, { id: string }> {
  readonly commandType = OPEN_TENDER;
  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) { super(prisma, eventBus); }

  protected async handle(command: Command<{ id: string }>, tx: TransactionClient, emit: EmitFn) {
    const tender = await tx.tender.update({
      where: { id: command.payload.id },
      data: { status: 'open', openedAt: new Date() },
    });

    await tx.tenderOffer.updateMany({
      where: { tenderId: tender.id, status: 'pending' },
      data: { status: 'sent', sentAt: new Date() },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.TENDER_PUBLISHED,
      entityType: 'tender',
      entityId: tender.id,
      payload: { shipmentId: tender.shipmentId, strategy: tender.strategy },
    }));

    return { id: tender.id };
  }
}
