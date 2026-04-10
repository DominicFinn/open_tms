import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export const AWARD_TENDER = 'tender.award';

export class AwardTenderCommandHandler extends BaseCommandHandler<{ tenderId: string; bidId: string }, { id: string }> {
  readonly commandType = AWARD_TENDER;
  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) { super(prisma, eventBus); }

  protected async handle(command: Command<{ tenderId: string; bidId: string }>, tx: TransactionClient, emit: EmitFn) {
    const bid = await tx.tenderBid.findUniqueOrThrow({ where: { id: command.payload.bidId } });

    const tender = await tx.tender.update({
      where: { id: command.payload.tenderId },
      data: { status: 'awarded', awardedAt: new Date() },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.TENDER_AWARDED,
      entityType: 'tender',
      entityId: tender.id,
      payload: { bidId: bid.id, carrierId: bid.carrierId, rate: bid.rate },
    }));

    return { id: tender.id };
  }
}
