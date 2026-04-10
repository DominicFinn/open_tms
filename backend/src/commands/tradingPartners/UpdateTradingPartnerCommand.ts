import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export const UPDATE_TRADING_PARTNER = 'trading_partner.update';

export class UpdateTradingPartnerCommandHandler extends BaseCommandHandler<{ id: string; data: Record<string, any> }, { id: string }> {
  readonly commandType = UPDATE_TRADING_PARTNER;
  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) { super(prisma, eventBus); }

  protected async handle(command: Command<{ id: string; data: Record<string, any> }>, tx: TransactionClient, emit: EmitFn) {
    const partner = await tx.tradingPartner.update({
      where: { id: command.payload.id },
      data: command.payload.data,
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.TRADING_PARTNER_UPDATED,
      entityType: 'trading_partner',
      entityId: partner.id,
      payload: { name: partner.name, changes: Object.keys(command.payload.data) },
    }));

    return { id: partner.id };
  }
}
