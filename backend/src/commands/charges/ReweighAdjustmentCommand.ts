import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface ReweighAdjustmentPayload {
  shipmentId: string;
  declaredWeightLbs: number;
  actualWeightLbs: number;
  declaredClass?: string;
  actualClass?: string;
  originalChargeCents: number;
  adjustedChargeCents: number;
  carrierId?: string;
}

export const REWEIGH_ADJUSTMENT = 'charge.reweigh_adjustment';

export class ReweighAdjustmentCommandHandler extends BaseCommandHandler<ReweighAdjustmentPayload, { costChargeId: string; revenueChargeId: string }> {
  readonly commandType = REWEIGH_ADJUSTMENT;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(command: Command<ReweighAdjustmentPayload>, tx: TransactionClient, emit: EmitFn) {
    const { payload } = command;

    const adjustmentCents = payload.adjustedChargeCents - payload.originalChargeCents;
    if (adjustmentCents === 0) {
      throw new Error('No adjustment needed — actual and declared charges are the same');
    }

    const classChanged = payload.declaredClass && payload.actualClass && payload.declaredClass !== payload.actualClass;
    const weightChanged = payload.declaredWeightLbs !== payload.actualWeightLbs;

    const parts: string[] = [];
    if (weightChanged) {
      parts.push(`weight ${payload.declaredWeightLbs} → ${payload.actualWeightLbs} lbs`);
    }
    if (classChanged) {
      parts.push(`class ${payload.declaredClass} → ${payload.actualClass}`);
    }
    const description = `Re-weigh/re-class adjustment: ${parts.join(', ')}`;

    // Create the cost adjustment charge (what we owe the carrier additionally)
    const costCharge = await tx.charge.create({
      data: {
        orgId: command.orgId,
        shipmentId: payload.shipmentId,
        chargeType: 'adjustment',
        chargeCategory: 'cost',
        description,
        amountCents: adjustmentCents,
        currency: 'USD',
        source: 'adjustment',
        freightClass: payload.actualClass,
        ratedWeight: payload.actualWeightLbs,
        status: 'pending',
        createdBy: command.actorId,
      },
    });

    // Create matching revenue adjustment (pass through to customer)
    const revenueCharge = await tx.charge.create({
      data: {
        orgId: command.orgId,
        shipmentId: payload.shipmentId,
        chargeType: 'adjustment',
        chargeCategory: 'revenue',
        description: `${description} — passed to customer`,
        amountCents: adjustmentCents,
        currency: 'USD',
        source: 'adjustment',
        sourceId: costCharge.id,
        freightClass: payload.actualClass,
        ratedWeight: payload.actualWeightLbs,
        status: 'pending',
        createdBy: command.actorId,
      },
    });

    // Recalculate shipment summary
    const charges = await tx.charge.findMany({
      where: { shipmentId: payload.shipmentId, status: { not: 'written_off' } },
    });

    const revenueCents = charges.filter(c => c.chargeCategory === 'revenue').reduce((s, c) => s + c.amountCents, 0);
    const costCents = charges.filter(c => c.chargeCategory === 'cost').reduce((s, c) => s + c.amountCents, 0);
    const approvedRevenue = charges.filter(c => c.chargeCategory === 'revenue' && ['approved', 'invoiced'].includes(c.status)).reduce((s, c) => s + c.amountCents, 0);
    const approvedCost = charges.filter(c => c.chargeCategory === 'cost' && ['approved', 'invoiced'].includes(c.status)).reduce((s, c) => s + c.amountCents, 0);

    await tx.shipmentFinancialSummary.upsert({
      where: { shipmentId: payload.shipmentId },
      create: {
        shipmentId: payload.shipmentId, orgId: command.orgId,
        expectedRevenueCents: revenueCents, expectedCostCents: costCents, expectedMarginCents: revenueCents - costCents,
        actualRevenueCents: approvedRevenue, actualCostCents: approvedCost, actualMarginCents: approvedRevenue - approvedCost,
        currency: 'USD',
      },
      update: {
        expectedRevenueCents: revenueCents, expectedCostCents: costCents, expectedMarginCents: revenueCents - costCents,
        actualRevenueCents: approvedRevenue, actualCostCents: approvedCost, actualMarginCents: approvedRevenue - approvedCost,
      },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.CHARGE_CREATED,
      entityType: 'charge',
      entityId: costCharge.id,
      payload: {
        chargeId: costCharge.id,
        shipmentId: payload.shipmentId,
        chargeType: 'adjustment',
        chargeCategory: 'cost',
        amountCents: adjustmentCents,
        currency: 'USD',
        source: 'adjustment',
      },
    }));

    return { costChargeId: costCharge.id, revenueChargeId: revenueCharge.id };
  }
}
