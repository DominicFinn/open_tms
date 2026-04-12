import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface AcceptQuotePayload {
  quoteId: string;
}

export const ACCEPT_QUOTE = 'quote.accept';

export class AcceptQuoteCommandHandler extends BaseCommandHandler<AcceptQuotePayload, { id: string; orderId: string }> {
  readonly commandType = ACCEPT_QUOTE;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(command: Command<AcceptQuotePayload>, tx: TransactionClient, emit: EmitFn) {
    const quote = await tx.quote.findUnique({
      where: { id: command.payload.quoteId },
      include: { lineItems: true, customer: { select: { name: true } } },
    });

    if (!quote) throw new Error('Quote not found');
    if (quote.status !== 'draft' && quote.status !== 'sent') {
      throw new Error(`Cannot accept quote in status "${quote.status}"`);
    }
    if (new Date() > quote.validUntil) {
      throw new Error('Quote has expired');
    }

    // Create an order from the quote
    const orderNumber = `ORD-Q-${quote.quoteNumber.slice(4)}`;
    const order = await tx.order.create({
      data: {
        orderNumber,
        customerId: quote.customerId,
        status: 'validated',
        deliveryStatus: 'unassigned',
        serviceLevel: quote.serviceLevel,
        originId: quote.originId,
        originValidated: !!quote.originId,
        destinationId: quote.destinationId,
        destinationValidated: !!quote.destinationId,
      },
    });

    // Create revenue charges on the order from quote line items
    for (const item of quote.lineItems) {
      await tx.charge.create({
        data: {
          orgId: command.orgId,
          orderId: order.id,
          chargeType: item.chargeType,
          chargeCategory: 'revenue',
          description: item.description,
          amountCents: item.amountCents * item.quantity,
          currency: item.currency,
          source: 'quote',
          sourceId: quote.id,
          accessorialCode: item.accessorialCode,
          freightClass: item.freightClass,
          ratePerCwt: item.ratePerCwt,
          status: 'approved', // Quote-accepted charges are pre-approved
          approvedBy: command.actorId,
          approvedAt: new Date(),
        },
      });
    }

    // Update quote status
    await tx.quote.update({
      where: { id: quote.id },
      data: { status: 'accepted', orderId: order.id },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.QUOTE_ACCEPTED,
      entityType: 'quote',
      entityId: quote.id,
      payload: {
        quoteId: quote.id,
        quoteNumber: quote.quoteNumber,
        orderId: order.id,
        orderNumber,
        customerId: quote.customerId,
        totalRevenueCents: quote.totalRevenueCents,
      },
    }));

    emit(this.createEvent(command, {
      type: EVENT_TYPES.ORDER_CREATED,
      entityType: 'order',
      entityId: order.id,
      payload: {
        orderReference: orderNumber,
        customerId: quote.customerId,
        status: 'validated',
      },
    }));

    return { id: quote.id, orderId: order.id };
  }
}
