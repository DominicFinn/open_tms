import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';
import { QuoteLineItemInput } from './CreateQuoteCommand.js';

export interface ReviseQuotePayload {
  originalQuoteId: string;
  lineItems: QuoteLineItemInput[];
  markupPercent?: number;
  validDays?: number;
  notes?: string;
}

export const REVISE_QUOTE = 'quote.revise';

export class ReviseQuoteCommandHandler extends BaseCommandHandler<ReviseQuotePayload, { id: string; quoteNumber: string; version: number }> {
  readonly commandType = REVISE_QUOTE;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(command: Command<ReviseQuotePayload>, tx: TransactionClient, emit: EmitFn) {
    const { payload } = command;

    // Get the original quote
    const original = await tx.quote.findUnique({
      where: { id: payload.originalQuoteId },
      include: { customer: { select: { id: true, name: true } } },
    });

    if (!original) throw new Error('Original quote not found');
    if (['accepted', 'expired'].includes(original.status)) {
      throw new Error(`Cannot revise a quote in status "${original.status}"`);
    }

    if (payload.lineItems.length === 0) {
      throw new Error('At least one line item is required');
    }

    // Supersede the original
    await tx.quote.update({
      where: { id: original.id },
      data: { status: 'superseded' },
    });

    // Generate new quote number (same base, incremented version)
    const newVersion = original.version + 1;
    const quoteNumber = `${original.quoteNumber}v${newVersion}`;

    // Calculate financials
    const totalCostCents = payload.lineItems
      .filter(l => l.chargeType !== 'discount')
      .reduce((sum, l) => sum + l.amountCents * (l.quantity ?? 1), 0);

    const markupPercent = payload.markupPercent ?? 15;
    const markupAmount = Math.round(totalCostCents * markupPercent / 100);
    const totalRevenueCents = totalCostCents + markupAmount;
    const marginCents = totalRevenueCents - totalCostCents;
    const marginPercent = totalCostCents > 0
      ? Math.round((marginCents / totalRevenueCents) * 10000) / 100
      : 0;

    const validDays = payload.validDays ?? 30;
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + validDays);

    const revised = await tx.quote.create({
      data: {
        orgId: command.orgId,
        quoteNumber,
        version: newVersion,
        parentQuoteId: original.id,
        customerId: original.customerId,
        originId: original.originId,
        destinationId: original.destinationId,
        serviceLevel: original.serviceLevel,
        equipmentType: original.equipmentType,
        totalRevenueCents,
        totalCostCents,
        marginCents,
        marginPercent,
        currency: original.currency,
        validFrom: new Date(),
        validUntil,
        notes: payload.notes ?? original.notes,
        createdBy: command.actorId,
        status: 'draft',
        lineItems: {
          create: payload.lineItems.map(item => ({
            chargeType: item.chargeType,
            description: item.description,
            amountCents: item.amountCents,
            currency: original.currency,
            accessorialCode: item.accessorialCode,
            freightClass: item.freightClass,
            weight: item.weight,
            ratePerCwt: item.ratePerCwt,
            quantity: item.quantity ?? 1,
          })),
        },
      },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.QUOTE_CREATED,
      entityType: 'quote',
      entityId: revised.id,
      payload: {
        quoteId: revised.id,
        quoteNumber,
        customerId: original.customerId,
        customerName: original.customer.name,
        totalRevenueCents,
        totalCostCents,
        marginPercent,
        serviceLevel: original.serviceLevel,
        parentQuoteId: original.id,
        version: newVersion,
      },
    }));

    return { id: revised.id, quoteNumber, version: newVersion };
  }
}
