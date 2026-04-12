import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface CreateChargePayload {
  shipmentId?: string;
  orderId?: string;
  chargeType: string;
  chargeCategory: 'revenue' | 'cost';
  description: string;
  amountCents: number;
  currency?: string;
  source?: string;
  sourceId?: string;
  accessorialCode?: string;
  freightClass?: string;
  nmfcCode?: string;
  ratedWeight?: number;
  ratePerCwt?: number;
}

export const CREATE_CHARGE = 'charge.create';

export class CreateChargeCommandHandler extends BaseCommandHandler<CreateChargePayload, { id: string }> {
  readonly commandType = CREATE_CHARGE;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(command: Command<CreateChargePayload>, tx: TransactionClient, emit: EmitFn) {
    const { payload } = command;

    if (!payload.shipmentId && !payload.orderId) {
      throw new Error('A charge must be linked to a shipment or order');
    }

    // Enforce same-currency on shipment charges
    if (payload.shipmentId) {
      const existing = await tx.charge.findFirst({
        where: { shipmentId: payload.shipmentId },
        select: { currency: true },
      });
      if (existing && (payload.currency ?? 'USD') !== existing.currency) {
        throw new Error(`All charges on a shipment must use the same currency (existing: ${existing.currency})`);
      }
    }

    const charge = await tx.charge.create({
      data: {
        orgId: command.orgId,
        shipmentId: payload.shipmentId,
        orderId: payload.orderId,
        chargeType: payload.chargeType,
        chargeCategory: payload.chargeCategory,
        description: payload.description,
        amountCents: payload.amountCents,
        currency: payload.currency ?? 'USD',
        source: payload.source ?? 'manual',
        sourceId: payload.sourceId,
        accessorialCode: payload.accessorialCode,
        freightClass: payload.freightClass,
        nmfcCode: payload.nmfcCode,
        ratedWeight: payload.ratedWeight,
        ratePerCwt: payload.ratePerCwt,
        status: 'pending',
        createdBy: command.actorId,
      },
    });

    // Recalculate shipment financial summary
    if (payload.shipmentId) {
      await this.recalculateShipmentSummary(tx, payload.shipmentId, command.orgId);
    }

    emit(this.createEvent(command, {
      type: EVENT_TYPES.CHARGE_CREATED,
      entityType: 'charge',
      entityId: charge.id,
      payload: {
        chargeId: charge.id,
        shipmentId: payload.shipmentId,
        orderId: payload.orderId,
        chargeType: payload.chargeType,
        chargeCategory: payload.chargeCategory,
        amountCents: payload.amountCents,
        currency: charge.currency,
        source: charge.source,
      },
    }));

    return { id: charge.id };
  }

  private async recalculateShipmentSummary(tx: TransactionClient, shipmentId: string, orgId: string) {
    const charges = await tx.charge.findMany({
      where: { shipmentId, status: { not: 'written_off' } },
    });

    const revenueCents = charges
      .filter(c => c.chargeCategory === 'revenue')
      .reduce((sum, c) => sum + c.amountCents, 0);

    const costCents = charges
      .filter(c => c.chargeCategory === 'cost')
      .reduce((sum, c) => sum + c.amountCents, 0);

    const approvedRevenue = charges
      .filter(c => c.chargeCategory === 'revenue' && ['approved', 'invoiced'].includes(c.status))
      .reduce((sum, c) => sum + c.amountCents, 0);

    const approvedCost = charges
      .filter(c => c.chargeCategory === 'cost' && ['approved', 'invoiced'].includes(c.status))
      .reduce((sum, c) => sum + c.amountCents, 0);

    const currency = charges.length > 0 ? charges[0].currency : 'USD';

    await tx.shipmentFinancialSummary.upsert({
      where: { shipmentId },
      create: {
        shipmentId,
        orgId,
        expectedRevenueCents: revenueCents,
        expectedCostCents: costCents,
        expectedMarginCents: revenueCents - costCents,
        actualRevenueCents: approvedRevenue,
        actualCostCents: approvedCost,
        actualMarginCents: approvedRevenue - approvedCost,
        currency,
      },
      update: {
        expectedRevenueCents: revenueCents,
        expectedCostCents: costCents,
        expectedMarginCents: revenueCents - costCents,
        actualRevenueCents: approvedRevenue,
        actualCostCents: approvedCost,
        actualMarginCents: approvedRevenue - approvedCost,
        currency,
      },
    });
  }
}
