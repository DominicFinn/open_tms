import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface QuoteLineItemInput {
  chargeType: string;
  description: string;
  amountCents: number;
  accessorialCode?: string;
  freightClass?: string;
  weight?: number;
  ratePerCwt?: number;
  quantity?: number;
}

export interface CreateQuotePayload {
  customerId: string;
  originId?: string;
  destinationId?: string;
  serviceLevel?: string;
  equipmentType?: string;
  lineItems: QuoteLineItemInput[];
  markupPercent?: number;
  validDays?: number;
  notes?: string;
}

export const CREATE_QUOTE = 'quote.create';

export class CreateQuoteCommandHandler extends BaseCommandHandler<CreateQuotePayload, { id: string; quoteNumber: string }> {
  readonly commandType = CREATE_QUOTE;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(command: Command<CreateQuotePayload>, tx: TransactionClient, emit: EmitFn) {
    const { payload } = command;

    // Validate customer
    const customer = await tx.customer.findUnique({
      where: { id: payload.customerId },
      select: { id: true, name: true },
    });
    if (!customer) throw new Error('Customer not found');

    if (payload.lineItems.length === 0) {
      throw new Error('At least one line item is required');
    }

    // Generate quote number
    const latest = await tx.quote.findFirst({
      where: { orgId: command.orgId },
      orderBy: { quoteNumber: 'desc' },
      select: { quoteNumber: true },
    });
    const seq = latest ? parseInt(latest.quoteNumber.slice(4), 10) + 1 : 1;
    const quoteNumber = `QTE-${String(seq).padStart(4, '0')}`;

    // Calculate financials
    const totalCostCents = payload.lineItems
      .filter(l => l.chargeType !== 'discount')
      .reduce((sum, l) => sum + l.amountCents * (l.quantity ?? 1), 0);

    const markupPercent = payload.markupPercent ?? 15; // Default 15% markup
    const markupAmount = Math.round(totalCostCents * markupPercent / 100);
    const totalRevenueCents = totalCostCents + markupAmount;
    const marginCents = totalRevenueCents - totalCostCents;
    const marginPercent = totalCostCents > 0
      ? Math.round((marginCents / totalRevenueCents) * 10000) / 100
      : 0;

    const validDays = payload.validDays ?? 30;
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + validDays);

    const quote = await tx.quote.create({
      data: {
        orgId: command.orgId,
        quoteNumber,
        customerId: payload.customerId,
        originId: payload.originId,
        destinationId: payload.destinationId,
        serviceLevel: payload.serviceLevel ?? 'FTL',
        equipmentType: payload.equipmentType,
        totalRevenueCents,
        totalCostCents,
        marginCents,
        marginPercent,
        currency: 'USD',
        validFrom: new Date(),
        validUntil,
        notes: payload.notes,
        createdBy: command.actorId,
        status: 'draft',
        lineItems: {
          create: payload.lineItems.map(item => ({
            chargeType: item.chargeType,
            description: item.description,
            amountCents: item.amountCents,
            currency: 'USD',
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
      entityId: quote.id,
      payload: {
        quoteId: quote.id,
        quoteNumber,
        customerId: payload.customerId,
        customerName: customer.name,
        totalRevenueCents,
        totalCostCents,
        marginPercent,
        serviceLevel: payload.serviceLevel ?? 'FTL',
      },
    }));

    return { id: quote.id, quoteNumber };
  }
}
