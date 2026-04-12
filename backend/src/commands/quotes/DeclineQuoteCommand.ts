import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface DeclineQuotePayload {
  quoteId: string;
  reason?: string;
}

export const DECLINE_QUOTE = 'quote.decline';

export class DeclineQuoteCommandHandler extends BaseCommandHandler<DeclineQuotePayload, { id: string }> {
  readonly commandType = DECLINE_QUOTE;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(command: Command<DeclineQuotePayload>, tx: TransactionClient, emit: EmitFn) {
    const quote = await tx.quote.findUnique({
      where: { id: command.payload.quoteId },
    });

    if (!quote) throw new Error('Quote not found');
    if (!['draft', 'sent'].includes(quote.status)) {
      throw new Error(`Cannot decline quote in status "${quote.status}"`);
    }

    await tx.quote.update({
      where: { id: quote.id },
      data: { status: 'declined' },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.QUOTE_DECLINED,
      entityType: 'quote',
      entityId: quote.id,
      payload: {
        quoteId: quote.id,
        quoteNumber: quote.quoteNumber,
        customerId: quote.customerId,
        reason: command.payload.reason,
      },
    }));

    return { id: quote.id };
  }
}
